import { C2DLookup, SymbolID } from "@armyc2.c5isr.renderer/mil-sym-ts-web";
import { catalogOf, searchCatalog, type CatalogEntry } from "./catalog.js";
import { basicIdOf } from "./sidc.js";
import { isWarfightingSet } from "./coverage.js";
import {
  MAP_ARMY_LABELS,
  MAP_ARMY_STRUCTURAL,
} from "./data/mapArmyCatalog.js";

/**
 * Which symbols each side has that the other does not, symbol by symbol.
 *
 * `coverage.ts` answers "how many"; this answers "which", and it is a different kind of
 * claim. A ratio can be argued about — is a sector modifier a symbol? — but a named
 * symbol that one library draws and the other cannot is a fact about the two libraries,
 * and it is the thing anyone choosing between them actually needs.
 *
 * ### It is a real crosswalk, not a name match
 *
 * The renderer ships `C2DLookup.getDCode(sidc2525C)`, the official 2525C → 2525D
 * conversion table: a 15-character letter-based code in, a 2525D code out, or null where
 * the standard's own migration table has no successor for it. That is what makes this
 * measurable at all. Matching on names would have been guesswork — "Armor" against
 * "Armor/Armored/Mechanized/Self-Propelled/ Tracked" — and guesswork is exactly what a
 * comparison must not be built on.
 *
 * ### The two directions are not symmetrical, and the asymmetry is honest
 *
 * **2525C → 2525D** is a lookup: every one of map.army's 911 drawable keys is asked, and
 * the ones the table refuses are symbols map.army draws that this demo cannot.
 *
 * **2525D → 2525C** has no table shipped. So the reverse is derived from the forward
 * direction instead: every 2525D entity that no 2525C key maps *onto*. That is a weaker
 * statement than "2525C has no such symbol" — the migration table could simply be
 * incomplete — so it is reported as "not reachable from map.army's catalog", which is
 * what it actually measures.
 */

/** A 2525C table key, made into the 15-character SIDC `C2DLookup` expects. */
function sidc2525cOf(key: string): string {
  // Friend and Present fill the two placeholders. Which values they are does not matter
  // to the entity lookup — the affiliation and status are separate fields on both sides
  // — but they have to be *something*, because the table is keyed by whole codes.
  const scheme = key[0] ?? "S";
  const dimension = key[2] ?? "-";
  const functionId = key.slice(4, 10).padEnd(6, "-");
  return `${scheme}F${dimension}P${functionId}-----`;
}

/** Words that carry no distinguishing information in a symbol's name. */
const NOISE = new Set([
  "and",
  "or",
  "of",
  "the",
  "other",
  "type",
  "unknown",
  "general",
  "equipment",
  "unit",
  "units",
  "facility",
  "station",
  "vehicle",
]);

/**
 * The best 2525D entity for a 2525C name, whole phrase first and then word by word.
 *
 * The whole-phrase pass alone was too strict to be useful, and its failures were
 * *misleading* rather than merely incomplete: `searchCatalog` requires every word to
 * match, so "Airport / Airbase" found nothing — 2525D writes it `Airport/Air Base`, two
 * words where 2525C has one — and the key landed in the "no equivalent anywhere" bucket
 * despite `20121301` existing. A bucket that contains a symbol I had already verified by
 * hand is a bucket nobody should be shown.
 *
 * So it falls back to single words, longest first, because a longer word is the more
 * distinctive one: "Submarine Ballistic Missile (Ssbn)" is answered by `submarine`.
 * Noise words are skipped or every unmatched name would resolve to whatever "equipment"
 * hits first.
 */
function bestNameMatch(
  catalog: ReturnType<typeof catalogOf>,
  name: string,
): CatalogEntry | null {
  const whole = searchCatalog(catalog, {
    text: name,
    symbolSet: "",
    geometry: "",
    limit: 1,
  }).rows[0];
  if (whole) {
    return whole;
  }
  const words = name
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((word) => word.length >= 4 && !NOISE.has(word))
    .sort((a, b) => b.length - a.length);
  for (const word of words) {
    const hit = searchCatalog(catalog, {
      text: word,
      symbolSet: "",
      geometry: "",
      limit: 1,
    }).rows[0];
    if (hit) {
      return hit;
    }
  }
  return null;
}

export interface CrosswalkRow {
  /** milsymbol's table key, e.g. `S-G-UCI---`. */
  key: string;
  /** What map.army calls it. */
  name: string;
  /** The 2525C SIDC that was looked up. */
  sidc2525c: string;
  /** The 2525D code the conversion table returned, or null. */
  code2525d: string | null;
  /** The 2525D entity that code names, if the demo's catalog holds it. */
  entity: CatalogEntry | null;
  /**
   * For a key the table could not convert: the best 2525D entity matching its **name**,
   * or null if even that finds nothing.
   *
   * **Weaker evidence than the column beside it, and labelled as such wherever it is
   * shown.** `code2525d` comes from the standard's own migration table; this is a text
   * search over the other standard's nomenclature, which can agree by coincidence
   * ("Government" is an Air entity and an installation) and can miss a real equivalent
   * that was renamed.
   *
   * It is here because without it the crosswalk's headline is wrong. 182 of map.army's
   * 911 keys have no successor in the table, which reads as "182 symbols map.army draws
   * that this cannot" — and that is not what it means. Twenty were checked by hand and
   * seventeen have a plain 2525D equivalent the table simply does not point at: Postal,
   * Liaison, Iceberg, Hovercraft, Electric Power, Ammunition Ship, Submarine Tender and
   * ten more. The table never maps into Land Installations at all, though 2525D holds
   * `20121301 Airport/Air Base` — which is exactly the key that made this worth checking.
   */
  nameMatch: CatalogEntry | null;
}

export interface Crosswalk {
  /** Every drawable 2525C key, with what it maps to. */
  rows: readonly CrosswalkRow[];
  /** Keys the conversion table has no 2525D successor for. */
  unmapped: readonly CrosswalkRow[];
  /**
   * Keys the table maps to a code whose entity is not in the 2525D catalog.
   *
   * Distinct from `unmapped`: the table answered, and the answer names something
   * `MSLookup` does not hold. Usually a code outside the warfighting sets.
   */
  mappedButMissing: readonly CrosswalkRow[];
  /** Keys that resolve to a 2525D entity this demo can draw. */
  mapped: readonly CrosswalkRow[];
  /** Unmapped keys whose name finds a 2525D entity anyway — see `nameMatch`. */
  unmappedWithNameMatch: readonly CrosswalkRow[];
  /** Unmapped keys with no 2525D entity under the table *or* the name. */
  unmappedAndUnnamed: readonly CrosswalkRow[];
  /** How many distinct 2525D entities those keys collapse onto. */
  distinctTargets: number;
  /**
   * 2525C keys per 2525D entity, on average, among the mapped ones.
   *
   * **The measured version of `coverage.ts`'s whole argument.** 1.77 means 2525C spends
   * nearly two function ids where 2525D spends one entity and puts the difference in the
   * sector modifiers. Twenty-three separate 2525C keys land on one 2525D entity
   * (`01110300`, the unmanned-aircraft entity); twenty-two land on Army Aviation.
   */
  keysPerEntity: number;
  /**
   * Warfighting 2525D entities no 2525C key maps onto — see the docblock on why this is
   * phrased as reachability rather than as absence.
   */
  unreachable: readonly CatalogEntry[];
  /** Those, grouped by symbol set, biggest first. */
  unreachableBySet: readonly { code: string; name: string; count: number }[];
}

let cached: Crosswalk | null = null;

export function crosswalk(version: number): Crosswalk {
  if (cached) {
    return cached;
  }
  const lookup = C2DLookup.getInstance();
  const catalog = catalogOf(version);
  const byBasicId = new Map(
    catalog.entries.map((entry) => [entry.basicId, entry]),
  );
  const structural = new Set(MAP_ARMY_STRUCTURAL);

  const rows: CrosswalkRow[] = [];
  const targets = new Set<string>();

  for (const [key, name] of Object.entries(MAP_ARMY_LABELS)) {
    // The sixteen structural nodes are excluded for the same reason `coverage.ts`
    // excludes them: they draw no icon, so "can the other library draw it" has no
    // answer to give.
    if (structural.has(key)) {
      continue;
    }
    const sidc2525c = sidc2525cOf(key);
    let code2525d: string | null = null;
    try {
      // Documented as returning null on no match; typed as returning a string. Both the
      // empty string and a code of the wrong length are treated as "no match", because
      // a library that says null and types string may also say "".
      const converted = lookup.getDCode(sidc2525c, false);
      code2525d =
        typeof converted === "string" && converted.length >= 20
          ? converted
          : null;
    } catch {
      code2525d = null;
    }
    const entity =
      code2525d === null
        ? null
        : (byBasicId.get(basicIdOf(code2525d)) ?? null);
    if (entity) {
      targets.add(entity.basicId);
    }
    // Only for the keys the table refused — for the rest the table has already given a
    // better answer, and a name search that disagreed with it would be noise.
    const nameMatch = code2525d === null ? bestNameMatch(catalog, name) : null;
    rows.push({ key, name, sidc2525c, code2525d, entity, nameMatch });
  }

  const unreachable = catalog.entries.filter(
    (entry) =>
      isWarfightingSet(entry.symbolSet) && !targets.has(entry.basicId),
  );
  const bySet = new Map<string, { name: string; count: number }>();
  for (const entry of unreachable) {
    const seen = bySet.get(entry.symbolSet);
    if (seen) {
      seen.count += 1;
    } else {
      bySet.set(entry.symbolSet, { name: entry.symbolSetName, count: 1 });
    }
  }

  const unmapped = rows.filter((row) => row.code2525d === null);
  const mapped = rows.filter((row) => row.entity !== null);
  cached = {
    rows,
    unmapped,
    mappedButMissing: rows.filter(
      (row) => row.code2525d !== null && row.entity === null,
    ),
    mapped,
    unmappedWithNameMatch: unmapped.filter((row) => row.nameMatch !== null),
    unmappedAndUnnamed: unmapped.filter((row) => row.nameMatch === null),
    distinctTargets: targets.size,
    keysPerEntity: targets.size === 0 ? 0 : mapped.length / targets.size,
    unreachable,
    unreachableBySet: [...bySet.entries()]
      .map(([code, { name, count }]) => ({ code, name, count }))
      .sort((a, b) => b.count - a.count),
  };
  return cached;
}

/**
 * The 2525D symbol sets that have no counterpart in 2525C at all.
 *
 * Not derived from the crosswalk — derived from the standards. 2525C has no cyberspace
 * symbology and no dismounted-individual set; both were introduced in 2525D, so every
 * entity in them is new rather than merely unreachable. Stated separately because it is
 * a much stronger claim than the crosswalk's, and it is the part of the answer to "what
 * does mil-sym-ts have that map.army does not" that does not depend on a migration
 * table being complete.
 */
export const SETS_NEW_IN_2525D: readonly { code: string; why: string }[] = [
  { code: "27", why: "Dismounted Individuals — introduced in 2525D" },
  { code: "60", why: "Cyberspace — introduced in 2525E" },
  { code: "64", why: "Cyberspace Equipment — introduced in 2525E" },
  {
    code: "11",
    why: "Land Civilian Unit / Organization — 2525C has civilian ground units, but not as its own set",
  },
];

export function symbolIdVersionOf(code: string): number {
  return SymbolID.getVersion(code);
}
