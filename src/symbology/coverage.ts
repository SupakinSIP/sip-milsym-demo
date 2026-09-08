import { SVGLookup } from "@armyc2.c5isr.renderer/mil-sym-ts-web";
import { STANDARDS, standardOf } from "./sidc.js";
import {
  canRender,
  catalogOf,
  drawableCountOf,
  type Catalog,
  type CatalogEntry,
} from "./catalog.js";

/**
 * How much of the symbology each renderer actually carries.
 *
 * This is what the project is for. `map.army` draws MIL-STD-2525C through `milsymbol`
 * from a catalog generated at build time; this demo draws 2525D/E and APP-6(D)/(E)
 * through mil-sym-ts from the renderer's own tables. The question is which of the two
 * covers more, and the honest answer needs three things this module supplies: the counts
 * measured rather than quoted, a like-for-like comparison rather than a total against a
 * total, and the reasons the two totals are not directly comparable stated up front.
 *
 * ### The one number to be careful with
 *
 * A "symbol" here is a **base symbol**: a symbol set plus a six-digit entity code, which
 * is one row of the renderer's lookup tables and one entry in `map.army`'s catalog. It is
 * *not* the number of pictures either library can draw — every base symbol is multiplied
 * by seven affiliations, six statuses, eight HQ/task-force/dummy values and
 * twenty-eight echelon-or-mobility values, before the two sector modifiers. Quoting that
 * product would be a bigger number and a meaningless one. Base symbols is the
 * comparison both sides can be counted the same way on.
 */

/* ------------------------------------------------------- the map.army baseline */

/**
 * `map.army`'s catalog, quoted from the artefact rather than from its documentation.
 *
 * Read out of `sip-map-army/packages/symbols/src/generated/warfighting.ts`:
 * `WARFIGHTING_COUNT = 927` and `WARFIGHTING_STRUCTURAL` holding sixteen keys. Copied as
 * constants rather than imported, because this demo is a separate project with no
 * dependency on that repository — and stated with the file it came from so it can be
 * re-checked when that catalog is regenerated.
 *
 * ### Two things about that 927
 *
 * **Sixteen of them draw nothing.** `WARFIGHTING_STRUCTURAL` is the tree's joints —
 * "Air", "Ground", "Unit", "Sea Surface" — categories that render as the bare
 * affiliation frame. They are legitimately in a *picker*, which is what the catalog is
 * for, but they are not symbols, so the comparable figure is 911.
 *
 * **It is coding scheme `S` only.** 2525C splits its symbology across schemes: `S`
 * warfighting, `G` tactical graphics (control measures), `W` weather, `O` MOOTW,
 * `I` signals intelligence. `map.army`'s generated catalog covers `S`, so the whole of
 * the control-measure and METOC symbology is outside it — which is most of what makes
 * the totals below differ, and is the reason this module reports a restricted comparison
 * as well as a raw one.
 */
export const MAP_ARMY_BASELINE = {
  standard: "MIL-STD-2525C",
  renderer: "milsymbol 3.0.4",
  /** Every node of the generated tree, including the sixteen that draw no icon. */
  catalogNodes: 927,
  /** The tree's joints — categories that render as a bare frame. */
  structuralNodes: 16,
  /** What is left: nodes that draw an actual symbol. */
  drawableSymbols: 911,
  /** The one coding scheme that catalog covers. */
  codingScheme: "S (warfighting)",
  source:
    "sip-map-army/packages/symbols/src/generated/warfighting.ts — WARFIGHTING_COUNT, WARFIGHTING_STRUCTURAL",

  /* ------------------------------------------- the tactical-graphics family */

  /**
   * Every icon-part key milsymbol can draw, across all coding schemes.
   *
   * Quoted from `sip-map-army/packages/symbols/src/graphics.ts`, whose docblock reports
   * the measurement: "harvesting every key milsymbol draws yields 1324 of them, and
   * **thirteen** are scheme `G`". So 927 of the 1,324 are the warfighting scheme its
   * catalog ships.
   */
  milsymbolTotalKeys: 1324,
  /**
   * How many of those are tactical graphics — 2525C's scheme `G`.
   *
   * **Thirteen: one bridge and twelve stability-operations incident points, all of them
   * point symbols.** Not one boundary, phase line, fortification, obstacle or minefield.
   * That is not a gap in map.army; it is a property of the renderer it draws with, and
   * that file says so in its own words: "the renderer this repository draws with does not
   * draw tactical graphics as a family".
   */
  milsymbolSchemeGKeys: 13,
  /**
   * What map.army does instead: a hand-authored table of graphics.
   *
   * Twenty-one rows, each a **name and an abbreviation** attached to geometry the
   * operator draws themselves — a phase line is a line the operator drew, labelled `PL`
   * at both ends. The meaning is carried in the document; the artwork is not the
   * standard's. Worth stating precisely, because "map.army has no control measures" would
   * be wrong: it has the vocabulary for twenty-one of them without the symbology.
   */
  tacticalGraphics: 21,
  graphicsSource:
    "sip-map-army/packages/symbols/src/graphics.ts — TACTICAL_GRAPHICS, and its docblock's own measurement",
} as const;

/* ------------------------------------------------- warfighting-equivalent sets */

/**
 * The 2525D symbol sets that 2525C's warfighting scheme covers.
 *
 * **This list is the whole of the like-for-like comparison, so it is worth arguing.**
 * 2525C organises symbology by *coding scheme* and 2525D by *symbol set*, and the two
 * do not line up one to one — so comparing `map.army`'s 911 against this demo's 2,256
 * compares a warfighting catalog against a warfighting catalog plus every control
 * measure, every weather front and every sea-state marker. That is not a coverage
 * difference, it is a scope difference, and reporting it as the former would be the
 * mistake this file exists to prevent.
 *
 * Included: air, space and their missiles, land units, civilian units, land equipment,
 * installations, dismounted individuals, sea surface, subsurface, mine warfare, SIGINT
 * and cyberspace. Those are things on the ground with an affiliation and an echelon —
 * scheme `S`'s subject.
 *
 * Excluded, and why:
 *
 * - **25 Control Measure** — 2525C scheme `G`. Boundaries, phase lines, fire support
 *   areas. `map.army` draws these; they are just not in the catalog this baseline comes
 *   from, and most are lines and areas rather than points.
 * - **45 Atmospheric, 46 Oceanographic, 47 Meteorological Space** — 2525C scheme `W`.
 * - **40 Activities** — 2525C scheme `O` (MOOTW). Civil disturbances, fires, incidents.
 *
 * SIGINT is a judgement call: 2525C gives it its own scheme `I`, and 2525D folds it into
 * symbol sets 50-54 which behave like every other warfighting set. It is 25 entities
 * either way, so the answer does not turn on it — but it is counted in, and said so.
 */
const WARFIGHTING_SETS = new Set([
  "01", // Air
  "02", // Air Missile
  "05", // Space
  "06", // Space Missile
  "10", // Land Unit
  "11", // Land Civilian Unit / Organization
  "15", // Land Equipment
  "20", // Land Installations
  "27", // Dismounted Individuals
  "30", // Sea Surface
  "35", // Sea Subsurface
  "36", // Mine Warfare
  "50", // Space SIGINT
  "51", // Air SIGINT
  "52", // Land SIGINT
  "53", // Sea Surface SIGINT
  "54", // Sea Subsurface SIGINT
  "60", // Cyberspace
  "64", // Cyberspace Equipment
]);

const EXCLUDED_SETS: Readonly<Record<string, string>> = {
  "25": "2525C scheme G — tactical graphics / control measures",
  "40": "2525C scheme O — MOOTW / activities",
  "45": "2525C scheme W — weather",
  "46": "2525C scheme W — oceanographic",
  "47": "2525C scheme W — meteorological space",
};

export function isWarfightingSet(symbolSet: string): boolean {
  return WARFIGHTING_SETS.has(symbolSet);
}

/* --------------------------------------------- the sector modifiers, and why they count */

/**
 * The sector-modifier icons a version can draw, as their lookup ids.
 *
 * **This is the answer to why the base-entity comparison makes mil-sym-ts look thinner
 * than it is, and it is the most important thing in this file.**
 *
 * 2525C puts a symbol's whole specificity in one function id, so "Infantry" and
 * "Infantry, Airborne" and "Infantry, Mountain" are three separate rows of milsymbol's
 * icon-part tables — and `map.army`'s 927 is a count of those rows. 2525D splits the same
 * information in two: the *entity* at digits 11-16 and up to two *sector modifiers* at
 * digits 17-20, drawn inside the frame above and below the icon. "Infantry, Airborne" is
 * entity `121100` plus modifier-1 `01`, which is one row in `MSLookup` and one in
 * `SVGLookup` — two icon parts, not one row.
 *
 * So counting `MSLookup` rows against milsymbol's icon-part keys counts one library's
 * entities against the other's entities *and* variants. Both numbers are real; the
 * comparison is not. Adding the modifier icons is what makes it one.
 *
 * ### Read out of the renderer's own tables, with the format verified
 *
 * `SVGLookup`'s tables are keyed by id, and a modifier's id is five characters: symbol
 * set, two-digit modifier code, then `1` or `2` for which sector it is drawn in.
 * Confirmed against `SymbolID.getMod1ID`/`getMod2ID`, which return exactly that for a
 * composed SIDC — modifier 1 = 65 on a land unit gives `10651`, modifier 2 = 65 gives
 * `10652`, and both ids are present as keys.
 *
 * ### Two things this reaches for that are not public API
 *
 * The per-version tables are static fields with a leading underscore
 * (`SVGLookup._SVGLookupD` and friends) and there is no exported way to enumerate them —
 * `getSVGLInfo(id, version)` answers for an id you already have. So this reads them
 * directly, guarded: if a future version renames them, `modifierIcons` comes back zero
 * and the panel says the count is unavailable rather than reporting a wrong one.
 *
 * The NATO tables are **deltas** — `_SVGLookup6D` holds 123 modifier ids of which 91 are
 * not in `_SVGLookupD` — so an APP-6 version's set is the union of its family's table and
 * its own. `getSVGLInfo` resolves a D-family id under every version, which is what makes
 * the union the right reading rather than a guess.
 */
type TableName = "_SVGLookupD" | "_SVGLookupE" | "_SVGLookup6D" | "_SVGLookup6E";

const MODIFIER_TABLES: Readonly<Record<string, readonly TableName[]>> = {
  "2525D": ["_SVGLookupD"],
  "2525E": ["_SVGLookupE"],
  APP6D: ["_SVGLookupD", "_SVGLookup6D"],
  APP6E: ["_SVGLookupE", "_SVGLookup6E"],
};

/** A modifier id is `set(2) + code(2) + sector(1)`, all digits. */
const MODIFIER_ID = /^\d{5}$/;

function modifierIdsOf(standardId: string): Set<string> {
  const ids = new Set<string>();
  for (const table of MODIFIER_TABLES[standardId] ?? []) {
    const held: unknown = (SVGLookup as unknown as Record<string, unknown>)[
      table
    ];
    if (!(held instanceof Map)) {
      continue;
    }
    for (const key of held.keys()) {
      if (typeof key === "string" && MODIFIER_ID.test(key)) {
        ids.add(key);
      }
    }
  }
  return ids;
}

export function exclusionReasonOf(symbolSet: string): string | null {
  return EXCLUDED_SETS[symbolSet] ?? null;
}

/* ----------------------------------------------------------------- the report */

export interface StandardCoverage {
  id: string;
  label: string;
  version: number;
  /** Rows the tables returned, including any the tables repeat. */
  rows: number;
  /** Distinct base symbols — `rows` less the duplicates. */
  symbols: number;
  /** How many rows were a repeat of a base symbol already listed. */
  duplicateRows: number;
  point: number;
  line: number;
  area: number;
  /** Distinct base symbols in the warfighting-equivalent sets. */
  warfighting: number;
  /**
   * Of those, the ones with artwork of their own — the figure map.army's 911 compares to.
   *
   * **This subtraction was missing at first and the comparison was generous to this side
   * because of it.** map.army excludes its sixteen structural nodes because they draw a
   * bare frame; mil-sym-ts has the same kind of row and many more of them — 159 in 2525D,
   * of which 115 return nothing at all from `RenderSVG` and the rest draw the frame with
   * no icon in it. Counting all 878 warfighting entities against their 911 *drawable* ones
   * compares category headers against symbols. See `canRender` in `catalog.ts`.
   */
  warfightingDrawable: number;
  /** Entities with no artwork anywhere in this version, across every symbol set. */
  notDrawable: number;
  symbolSets: number;
  /** Sector-modifier icons this version can draw — see `modifierIdsOf`. */
  modifierIcons: number;
  /** Of those, the ones belonging to a warfighting-equivalent symbol set. */
  warfightingModifierIcons: number;
  /**
   * Drawable entities plus modifier icons — the figure comparable to milsymbol's
   * icon-part keys, which is what `map.army`'s 927 counts.
   */
  warfightingIconParts: number;
}

export interface CoverageReport {
  standards: readonly StandardCoverage[];
  /** Base symbols present in at least one of the four standards. */
  unionSymbols: number;
  unionPoint: number;
  unionLine: number;
  unionArea: number;
  unionWarfighting: number;
  unionSymbolSets: number;
  /** Base symbols present in all four. */
  commonToAll: number;
  /** Base symbols present in exactly one, by standard id. */
  exclusive: Readonly<Record<string, number>>;
  /** Every symbol set in the union, with its size and whether it counts as warfighting. */
  sets: readonly {
    code: string;
    name: string;
    count: number;
    warfighting: boolean;
    excludedBecause: string | null;
  }[];
  baseline: typeof MAP_ARMY_BASELINE;
}

interface UnionRow {
  entry: CatalogEntry;
  standards: Set<string>;
}

/**
 * Count everything, once.
 *
 * Walks all four catalogs, which are themselves memoised, and is memoised in turn
 * because the panel re-renders on every store change and this is the most expensive
 * read in the demo.
 *
 * ### The duplicate rows are reported, not silently dropped
 *
 * `MSLookup.getIDList` repeats a base symbol in two of the four versions — 2525E lists
 * `25132200` and `10000000` twice, APP-6(E) those two and `25141200` — with byte-identical
 * names and paths. Deduplicating without saying so would mean this module's totals never
 * matched a number anyone got by counting `getIDList` directly, and the difference would
 * look like a bug here. So both figures are carried: `rows` is what the tables return and
 * `symbols` is what is actually in them.
 */
let cached: CoverageReport | null = null;

export function coverageReport(): CoverageReport {
  if (cached) {
    return cached;
  }
  const union = new Map<string, UnionRow>();
  const standards: StandardCoverage[] = [];

  for (const standard of STANDARDS) {
    const catalog: Catalog = catalogOf(standard.version);
    const seen = new Map<string, CatalogEntry>();
    let duplicateRows = 0;

    for (const entry of catalog.entries) {
      if (seen.has(entry.basicId)) {
        duplicateRows += 1;
        continue;
      }
      seen.set(entry.basicId, entry);
      const row = union.get(entry.basicId);
      if (row) {
        row.standards.add(standard.id);
      } else {
        union.set(entry.basicId, {
          entry,
          standards: new Set([standard.id]),
        });
      }
    }

    const distinct = [...seen.values()];
    const modifiers = modifierIdsOf(standard.id);
    const warfightingModifiers = [...modifiers].filter((id) =>
      isWarfightingSet(id.slice(0, 2)),
    ).length;
    const warfightingEntries = distinct.filter((e) =>
      isWarfightingSet(e.symbolSet),
    );
    const warfighting = warfightingEntries.length;
    const warfightingDrawable = warfightingEntries.filter((e) =>
      canRender(e.basicId, standard.version),
    ).length;
    standards.push({
      id: standard.id,
      label: standard.label,
      version: standard.version,
      rows: catalog.entries.length,
      symbols: distinct.length,
      duplicateRows,
      point: distinct.filter((e) => e.geometry === "point").length,
      line: distinct.filter((e) => e.geometry === "line").length,
      area: distinct.filter((e) => e.geometry === "area").length,
      warfighting,
      warfightingDrawable,
      notDrawable: distinct.length - drawableCountOf(standard.version),
      symbolSets: catalog.symbolSets.length,
      modifierIcons: modifiers.size,
      warfightingModifierIcons: warfightingModifiers,
      warfightingIconParts: warfightingDrawable + warfightingModifiers,
    });
  }

  const rows = [...union.values()];
  const setCounts = new Map<string, { name: string; count: number }>();
  const exclusive: Record<string, number> = {};
  for (const row of rows) {
    const set = setCounts.get(row.entry.symbolSet);
    if (set) {
      set.count += 1;
    } else {
      setCounts.set(row.entry.symbolSet, {
        name: row.entry.symbolSetName,
        count: 1,
      });
    }
    if (row.standards.size === 1) {
      const only = [...row.standards][0]!;
      exclusive[only] = (exclusive[only] ?? 0) + 1;
    }
  }

  cached = {
    standards,
    unionSymbols: rows.length,
    unionPoint: rows.filter((r) => r.entry.geometry === "point").length,
    unionLine: rows.filter((r) => r.entry.geometry === "line").length,
    unionArea: rows.filter((r) => r.entry.geometry === "area").length,
    unionWarfighting: rows.filter((r) => isWarfightingSet(r.entry.symbolSet))
      .length,
    unionSymbolSets: setCounts.size,
    commonToAll: rows.filter((r) => r.standards.size === STANDARDS.length)
      .length,
    exclusive,
    sets: [...setCounts.entries()]
      .map(([code, { name, count }]) => ({
        code,
        name,
        count,
        warfighting: isWarfightingSet(code),
        excludedBecause: exclusionReasonOf(code),
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    baseline: MAP_ARMY_BASELINE,
  };
  return cached;
}

/**
 * The headline, on the two bases the two libraries can both be counted on.
 *
 * ### Two ratios, because there are two honest questions
 *
 * `entityRatio` counts base entities against `map.army`'s 911, and it comes out **below
 * one** — 878 for 2525D. Reported rather than buried: it is the number anyone comparing
 * the two catalogs by their obvious size will get, and if this panel showed only the
 * flattering figure the first person to count `MSLookup` rows would be right to distrust
 * everything else on it.
 *
 * `iconPartRatio` adds the sector modifiers, and it is the comparison that means
 * something. `map.army`'s 927 is a count of milsymbol's **icon-part keys**, and 2525D
 * expresses as `entity + modifier` exactly what 2525C expresses as a distinct function
 * id — so entities alone is the wrong half of the answer. See `modifierIdsOf`.
 *
 * Neither is "how many pictures can be drawn". That is entities × modifier-1 ×
 * modifier-2 × affiliations × statuses × echelons, which is a big number and a
 * meaningless one.
 */
export function headlineComparison(standardId: string): {
  standardLabel: string;
  entities: number;
  modifierIcons: number;
  iconParts: number;
  theirs: number;
  entityRatio: number;
  iconPartRatio: number;
  ourTotal: number;
  /** False when the renderer's internal tables could not be read at all. */
  modifiersCounted: boolean;
} {
  const report = coverageReport();
  const standard = report.standards.find((s) => s.id === standardId);
  const chosen = standard ?? report.standards[0]!;
  const theirs = MAP_ARMY_BASELINE.drawableSymbols;
  return {
    standardLabel: standardOf(chosen.id).label,
    entities: chosen.warfightingDrawable,
    modifierIcons: chosen.warfightingModifierIcons,
    iconParts: chosen.warfightingIconParts,
    theirs,
    entityRatio: chosen.warfightingDrawable / theirs,
    iconPartRatio: chosen.warfightingIconParts / theirs,
    ourTotal: chosen.symbols,
    modifiersCounted: chosen.modifierIcons > 0,
  };
}
