import {
  DrawRules,
  MilStdIconRenderer,
  MSLookup,
} from "@armyc2.c5isr.renderer/mil-sym-ts-web";
import { DRAW_RULE_TEXT, type DrawRuleText } from "./data/drawRules.js";
import { composeSidc, DEFAULT_FIELDS } from "./sidc.js";

/**
 * Which symbols exist, and what each one is in the standard's terms.
 *
 * In `sip-map-army` this question belongs to a **different package** from drawing —
 * `@map-army/symbols`, which generates its tables from the published 2525C charts with
 * a script and checks them into the repo, because milsymbol has no catalog of its own
 * to ask. That separation is worth keeping in mind while reading this file, because
 * mil-sym-ts changes the answer: the renderer *is* the catalog. `MSLookup` holds every
 * entity of every version it can draw, so there is nothing to generate, nothing to
 * check in, and no way for the list and the artwork to disagree — the failure mode a
 * generated table has to be guarded against.
 *
 * So this is the one layer of the reference architecture the demo collapses, and it
 * collapses because the underlying library made it redundant, not to save work.
 */

export interface CatalogEntry {
  /** Symbol set (2 digits) + entity code (6 digits) — what `MSLookup` is keyed by. */
  basicId: string;
  symbolSet: string;
  symbolSetName: string;
  /** The entity's name, e.g. "Infantry". */
  name: string;
  /**
   * Where it sits, e.g. "Land Unit / Movement and Maneuver".
   *
   * **The name is not in it.** `MSInfo.getPath()` returns the branches above the
   * entity and a trailing separator — `"Land Unit / Movement and Maneuver / "` — so the
   * readable label is the path *plus* the name, and searching the path alone would
   * never match the word the operator actually typed.
   */
  path: string;
  /** "point", "line" or "area". */
  geometry: string;
  /**
   * How many control points this graphic needs, and at most accepts.
   *
   * From the renderer's own tables, and load-bearing for the drawing tool rather than
   * decoration: a phase line takes two or more, a rectangular target area takes exactly
   * three, a circular one takes a single point plus a radius in Field AM. Without these
   * the tool would have to guess when a shape is finished, and guessing wrong means the
   * renderer refuses the geometry after the operator has already drawn it.
   *
   * `maxPoints` is often very large — the tables use a big number for "as many as you
   * like" — so it is a cap to respect, not a target to fill.
   */
  minPoints: number;
  maxPoints: number;
  /**
   * The standard's **anchor point rule** for this graphic, by number and by name.
   *
   * `MSInfo.getDrawRule()` and `DrawRules`' constants. This is the field that decides what
   * the operator's clicks *mean*, and getting it wrong draws a wrong picture out of
   * correct code — see `drawRuleTextOf`.
   */
  drawRule: number;
  drawRuleName: string;
  /** Lowercased `path`, held so a keystroke in the search box is not a re-lowercase. */
  haystack: string;
}

export interface Catalog {
  version: number;
  entries: readonly CatalogEntry[];
  /** The symbol sets present in this version, in numeric order, for the filter. */
  symbolSets: readonly { code: string; name: string; count: number }[];
}

const catalogs = new Map<number, Catalog>();

/**
 * `DrawRules`' constant values to their names, built once.
 *
 * The class exposes ninety `static readonly` numbers and no reverse lookup, so the map is
 * built by walking its own property names — which is also how the generated rule table is
 * keyed, so the two meet at a name rather than at a number that could shift between
 * library versions.
 */
const drawRuleNames = new Map<number, string>();
for (const name of Object.getOwnPropertyNames(DrawRules)) {
  const value = (DrawRules as unknown as Record<string, unknown>)[name];
  if (typeof value === "number") {
    drawRuleNames.set(value, name);
  }
}

function drawRuleNameOf(rule: number): string {
  return drawRuleNames.get(rule) ?? `rule ${rule}`;
}

/**
 * What the operator's clicks mean for this graphic, in the standard's own words.
 *
 * **This is the answer to a question the demo got wrong.** Every multipoint graphic was
 * drawn by collecting clicks and passing them straight through as a path — right for the
 * area and line rules, wrong for the rest. `AXIS2`, which is Main Attack, reads:
 *
 * > Point 1 defines the tip of the arrowhead. Point N-1 defines the rear of the symbol.
 * > Point N defines the back of the arrowhead. … Points 1 through N-1 determine the
 * > symbol's center line and Point N determines the width.
 *
 * So clicks collected tail-first drew the arrow **backwards**, with the final click eaten
 * as a width. The geometry was the renderer's and was correct for the points it was
 * given; the points were this demo's and were wrong. Measured: with the last point
 * offset perpendicular from the tip, the drawn width comes out at exactly twice that
 * offset, symmetric about the centre line.
 *
 * 67 distinct rules are in play across 2525D's 415 line and area entities, so the tool
 * **shows** the rule rather than encoding 67 gestures: the operator clicks in the order
 * the standard specifies, with that order on screen while they do it.
 */
export function drawRuleTextOf(name: string): DrawRuleText | null {
  return DRAW_RULE_TEXT[name] ?? null;
}

/**
 * Every base symbol the renderer knows for a version.
 *
 * Memoised per version because building it walks a few thousand table rows, and the
 * standard picker flips between four versions — the same reasoning as `renderSymbol`'s
 * memo, one layer up. Nothing invalidates it: the tables are compiled into the library
 * and cannot change while the page is open.
 */
export function catalogOf(version: number): Catalog {
  const cached = catalogs.get(version);
  if (cached) {
    return cached;
  }
  const lookup = MSLookup.getInstance();
  const entries: CatalogEntry[] = [];
  const counts = new Map<string, { name: string; count: number }>();

  for (const basicId of lookup.getIDList(version)) {
    const info = lookup.getMSLInfo(basicId, version);
    if (!info) {
      continue;
    }
    const basic = info.getBasicSymbolID() || basicId;
    // The path is a "/"-separated hierarchy with a trailing separator, and its first
    // segment is the symbol set's own name. Read from it rather than from a table of set
    // names, so an unnamed set degrades to its number instead of to a wrong label.
    const segments = info
      .getPath()
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);
    const path = segments.join(" / ");
    const symbolSet = basic.slice(0, 2);
    const symbolSetName = segments[0] ?? `Symbol set ${symbolSet}`;
    const name = info.getName() || segments.at(-1) || basic;
    entries.push({
      basicId: basic,
      symbolSet,
      symbolSetName,
      name,
      path,
      geometry: (info.getGeometry() || "point").toLowerCase(),
      minPoints: info.getMinPointCount(),
      maxPoints: info.getMaxPointCount(),
      drawRule: info.getDrawRule(),
      drawRuleName: drawRuleNameOf(info.getDrawRule()),
      haystack: `${path} ${name} ${basic}`.toLowerCase(),
    });
    const seen = counts.get(symbolSet);
    if (seen) {
      seen.count += 1;
    } else {
      counts.set(symbolSet, { name: symbolSetName, count: 1 });
    }
  }

  // By path and then by name, because the path no longer ends in the name: sorting on
  // it alone would leave every entity of a branch in whatever order the table held them.
  entries.sort(
    (a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name),
  );
  const catalog: Catalog = {
    version,
    entries,
    symbolSets: [...counts.entries()]
      .map(([code, { name, count }]) => ({ code, name, count }))
      .sort((a, b) => a.code.localeCompare(b.code)),
  };
  catalogs.set(version, catalog);
  return catalog;
}

/**
 * Which amplifiers the standard says apply to this symbol.
 *
 * `MSInfo.getModifiers()` answers it per entity, and the answer is genuinely different
 * per entity: an infantry unit has twenty-four fields, of which a unique designation
 * and a higher formation are two; an aircraft has fourteen, and "higher formation" is
 * not among them. Returned as a `Set` because the only question asked of it is
 * membership, once per input in the panel.
 *
 * This has no counterpart in `sip-map-army` at all, and it is the second thing the
 * lookup tables buy that a generated table did not: over there every symbol offers
 * every amplifier, because there was nothing to ask. Here the panel can show the
 * operator the fields the standard actually gives this symbol and mark the rest.
 */
export function modifiersOf(basicId: string, version: number): Set<string> {
  const info = MSLookup.getInstance().getMSLInfo(basicId, version);
  return new Set(info ? info.getModifiers() : []);
}

/**
 * Whether the renderer has actual artwork for an entity, or only a frame to put it in.
 *
 * **The honest coverage number, and the direct analogue of map.army's sixteen structural
 * nodes.** `MilStdIconRenderer.CanRender` is the library's own answer, and it says no for
 * 159 of 2525D's 2,019 entities — "Air / Unspecified", "Activities / Incident",
 * "Land Unit / Unspecified": the tree's joints, which draw as the bare affiliation frame
 * because a category is not a thing on a map. Same reason map.army subtracts its
 * sixteen, and the same subtraction has to be made on this side or the comparison is
 * generous to it by 159.
 *
 * It is not free — it composes a code and consults the draw rules — so the results are
 * memoised per version, and the gallery filters on it rather than re-asking per repaint.
 */
const drawable = new Map<number, Set<string>>();

function drawableSetOf(version: number): Set<string> {
  const cached = drawable.get(version);
  if (cached) {
    return cached;
  }
  const renderer = MilStdIconRenderer.getInstance();
  const empty = new Map<string, string>();
  const ids = new Set<string>();
  for (const entry of catalogOf(version).entries) {
    const sidc = composeSidc(entry.basicId, {
      ...DEFAULT_FIELDS,
      version,
    });
    if (renderer.CanRender(sidc, empty)) {
      ids.add(entry.basicId);
    }
  }
  drawable.set(version, ids);
  return ids;
}

/** Whether this entity has artwork of its own in this version. */
export function canRender(basicId: string, version: number): boolean {
  return drawableSetOf(version).has(basicId);
}

/** How many entities in this version have artwork of their own. */
export function drawableCountOf(version: number): number {
  return drawableSetOf(version).size;
}

export interface SearchQuery {
  text: string;
  symbolSet: string;
  /** "point" restricts to what a single-point marker can actually draw. */
  geometry: string;
  limit: number;
}

/**
 * English abbreviations, expanded before matching.
 *
 * **Small, and every row is checked against the tables rather than assumed.** The
 * standard writes its nomenclature out in full — "Headquarters", not "HQ" — and spells
 * acronyms in parentheses only where it happens to. So a search for `hq` found one row
 * ("Earthquake Epicenter", by substring) and `sam` found none at all, which reads as a
 * catalog with nothing in it rather than as a query the index could not answer. That is
 * the specific way a coverage comparison gets the wrong answer.
 *
 * `map.army` has the same mechanism and much more of it — a Thai alias table with a cited
 * source per term, plus a lexicon that reads the affiliation and echelon out of the query.
 * This is the English-only slice of the same idea, which is all a coverage proof needs.
 *
 * Expansions are matched *in addition* to the typed word, never instead of it, so typing
 * a real word that happens to be an abbreviation loses nothing.
 */
const ABBREVIATIONS: Readonly<Record<string, readonly string[]>> = {
  /* Abbreviations: the acronym an operator types for a name the standard writes out. */
  hq: ["headquarters"],
  ad: ["air defense"],
  ada: ["air defense"],
  sam: ["air defense missile"],
  apc: ["armored personnel carrier"],
  ifv: ["infantry fighting vehicle"],
  afv: ["armored fighting vehicle"],
  cp: ["command post"],
  eod: ["explosive ordnance disposal"],
  ew: ["electronic warfare"],
  fa: ["field artillery"],
  inf: ["infantry"],
  int: ["intelligence"],
  mp: ["military police"],
  msl: ["missile"],
  recce: ["reconnaissance"],
  recon: ["reconnaissance"],
  sof: ["special operations"],
  sp: ["self propelled"],
  tk: ["tank"],
  uav: ["unmanned aircraft"],
  uas: ["unmanned aircraft"],
  usv: ["unmanned surface"],
  uuv: ["unmanned underwater"],
  atgm: ["antitank missile"],
  mlrs: ["rocket"],
  med: ["medical"],
  engr: ["engineer"],
  sig: ["signal"],
  arty: ["artillery"],
  mech: ["mechanized"],
  abn: ["airborne"],
  amph: ["amphibious"],
  av: ["aviation"],
  /* Synonyms: a word in common use that names something the standard calls another
     thing. These broaden rather than rescue — 2525D does have a "Howitzer" entity, and
     `howitzer` finds it without any help; the row is here so the query also reaches the
     Field Artillery *unit* that a howitzer belongs to, which is what an operator asking
     for one on a map usually wants. */
  howitzer: ["artillery"],
  chopper: ["helicopter"],
  helo: ["helicopter", "rotary wing"],
  jet: ["fixed wing"],
  logistics: ["supply"],
  log: ["supply"],
};

/** Words too short or too common to rank on. Kept out of the initialisms as well. */
const NOISE = new Set(["and", "or", "of", "the", "a", "for", "with", "to", "in", "on"]);

function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((word) => word.length > 0);
}

/**
 * A name's initials, so a query can be the acronym the standard did not print.
 *
 * "Air Defense Missile Launcher" indexes `adml`; "Armored Engineer Recon Vehicle (AERV)"
 * already carries `aerv` as a word, and gets `aerv` from its initials too. Noise words
 * are skipped, so "Rearm, Refuel and Resupply Point" is `rrrp` and not `rrarp`.
 *
 * Only whole-name initials, and only for two words or more. Every subsequence would turn
 * a four-word name into fifteen index entries and make short queries match everything —
 * which is the failure this is meant to fix, arrived at from the other side.
 */
function initialsOf(name: string): string {
  const words = wordsOf(name).filter((word) => !NOISE.has(word));
  return words.length >= 2 ? words.map((word) => word[0]!).join("") : "";
}

/**
 * What one query word is worth against one entry.
 *
 * Ordered by how much the match tells you, which is the whole of the fix: substring
 * matching alone put "Tanker" and "Antitank Obstacles" above "Tank" for the query
 * `tank`, and an operator reading that list concludes the catalog has no tank in it.
 *
 * The name outranks the path, because the path is shared by every entity in a branch and
 * would otherwise flood the results with a category's whole contents.
 */
function scoreWord(entry: IndexedEntry, word: string): number {
  let best = 0;
  if (entry.nameLower === word) {
    return 1000;
  }
  if (entry.basicId.startsWith(word) && word.length >= 3) {
    best = Math.max(best, 900);
  }
  if (entry.initials === word) {
    best = Math.max(best, 700);
  }
  for (const token of entry.nameWords) {
    if (token === word) {
      best = Math.max(best, 600);
    } else if (token.startsWith(word)) {
      best = Math.max(best, 300);
    } else if (word.length >= 4 && token.includes(word)) {
      // Four characters before a match may land in the middle of a word, because a
      // shorter one lands in the middle of something unrelated: `hq` inside
      // "Eart*hq*uake Epicenter" was the second result for a query about headquarters.
      best = Math.max(best, 120);
    }
  }
  if (best >= 300) {
    return best;
  }
  for (const token of entry.pathWords) {
    if (token === word) {
      best = Math.max(best, 200);
    } else if (token.startsWith(word)) {
      best = Math.max(best, 90);
    }
  }
  return best;
}

interface IndexedEntry extends CatalogEntry {
  nameLower: string;
  nameWords: readonly string[];
  pathWords: readonly string[];
  initials: string;
}

const indexes = new Map<number, readonly IndexedEntry[]>();

/**
 * The search index, built once per version.
 *
 * Tokenising on every keystroke was affordable and tokenising once is simply better;
 * what makes it worth a cache is that the words are needed *per query word*, so a
 * two-word query over 2,019 entries would otherwise split the same strings twice.
 */
function indexOf(catalog: Catalog): readonly IndexedEntry[] {
  const cached = indexes.get(catalog.version);
  if (cached) {
    return cached;
  }
  const built = catalog.entries.map((entry) => ({
    ...entry,
    nameLower: entry.name.toLowerCase(),
    // Slash-separated alternates are one name in the tables —
    // "Armor/Armored/Mechanized/Self-Propelled/ Tracked" — and every reading of it has
    // to be typable, which the split gives for free.
    nameWords: wordsOf(entry.name),
    pathWords: wordsOf(entry.path),
    initials: initialsOf(entry.name),
  }));
  indexes.set(catalog.version, built);
  return built;
}

/**
 * The rows the browser shows, best first.
 *
 * Every word of the query has to match something — so "inf land" finds land-unit
 * infantry and "recon air" finds the aircraft — and the rows are then ordered by how
 * well they matched. Requiring the words in sequence would make the operator guess at
 * the standard's own phrasing, which is the thing they are searching *because* they do
 * not know it.
 *
 * `total` counts every match and the rows are capped, because every tile is a rendered
 * SVG. With ranking the cap costs much less than it did: what gets cut is now the tail
 * rather than an arbitrary slice, and the count of what was left out is reported.
 */
export function searchCatalog(
  catalog: Catalog,
  query: SearchQuery,
): { rows: readonly CatalogEntry[]; total: number } {
  const words = wordsOf(query.text);
  const scored: { entry: IndexedEntry; score: number }[] = [];
  let total = 0;

  for (const entry of indexOf(catalog)) {
    if (query.symbolSet !== "" && entry.symbolSet !== query.symbolSet) {
      continue;
    }
    if (query.geometry !== "" && entry.geometry !== query.geometry) {
      continue;
    }
    let score = 0;
    let matchedEvery = true;
    for (const word of words) {
      let wordScore = scoreWord(entry, word);
      for (const expansion of ABBREVIATIONS[word] ?? []) {
        // **Every word of the phrase has to match, and the phrase scores its weakest
        // part.** Scoring the strongest instead was the first attempt and it was much
        // worse than no expansion at all: `sam` → "air defense missile" matched anything
        // saying *air*, and 150 rows came back for a query whose answer is two. A
        // multi-word expansion is a phrase, so it is matched as one.
        //
        // Alternative phrases still OR against each other — `helo` is a helicopter *or*
        // a rotary wing — because those are two names for one thing.
        let phrase = Infinity;
        for (const part of wordsOf(expansion)) {
          phrase = Math.min(phrase, scoreWord(entry, part));
        }
        // An expansion is worth less than the word itself: a row that says what was
        // typed should never rank below one that says what it was taken to mean.
        if (phrase > 0 && phrase !== Infinity) {
          wordScore = Math.max(wordScore, phrase - 150);
        }
      }
      if (wordScore <= 0) {
        matchedEvery = false;
        break;
      }
      score += wordScore;
    }
    if (!matchedEvery) {
      continue;
    }
    total += 1;
    scored.push({ entry, score });
  }

  // With nothing typed every row scores zero, and sorting on that would replace the
  // hierarchy with an alphabet — so an empty query is left in the catalog's own order,
  // which is what makes the unfiltered list browsable by branch.
  if (words.length > 0) {
    scored.sort(
      (a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name),
    );
  }
  return { rows: scored.slice(0, query.limit).map((row) => row.entry), total };
}
