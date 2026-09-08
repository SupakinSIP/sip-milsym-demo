import { SymbolID } from "@armyc2.c5isr.renderer/mil-sym-ts-web";

/**
 * The SIDC as a set of fields the operator picks, and one string the renderer eats.
 *
 * This is the file with no counterpart in `@map-army/symbology`, and the reason is
 * the standard, not the code. 2525C's SIDC is fifteen **letters** whose meaning is
 * positional and irregular, so `@map-army/symbols` generates a table of whole codes
 * from the published charts and the app picks rows out of it. 2525D's is twenty
 * **digits** in eight named fields, every one of which is independently settable — so
 * the composition can be a function instead of a table, and picking "friendly,
 * planned, battalion, headquarters" is eight edits to one string rather than a lookup
 * that may have no row.
 *
 * `SymbolID`'s own setters do the splicing. They are positional and pure — string in,
 * string out — so this module stays as DOM-free and side-effect-free as the package it
 * is modelled on, and there is no second copy of "the echelon lives at digits 9-10"
 * anywhere in the demo.
 */

/* ------------------------------------------------------------------ the standards */

/**
 * A symbology standard, and the version number the renderer's tables are keyed by.
 *
 * The demo draws the four the C5ISR renderer carries. 2525C is deliberately absent:
 * it is milsymbol's standard and `sip-map-army` already draws it — the point here is
 * the *other* renderer, not a second answer to the same question.
 */
export interface Standard {
  id: string;
  label: string;
  version: number;
  note: string;
}

export const STANDARDS: readonly Standard[] = [
  {
    id: "2525D",
    label: "MIL-STD-2525D ch.1",
    version: SymbolID.Version_2525Dch1,
    note: "US, 20-digit numeric SIDC. The baseline the versions below are a delta against.",
  },
  {
    id: "2525E",
    label: "MIL-STD-2525E ch.1",
    version: SymbolID.Version_2525Ech1,
    note: "US. Adds the Cyberspace symbol sets and folds the five SIGINT sets into one.",
  },
  {
    id: "APP6D",
    label: "NATO APP-6(D)",
    // `Version_APP6D` (10) and not `Version_APP6Dch2` (12), and that is a gap in the
    // library rather than a preference. Asked for version 12, `MSLookup.getIDList`
    // returns all 2,019 ids and `getMSLInfo` then returns nothing for **every one of
    // them** — so a catalog built on it comes out empty while every call looks like it
    // succeeded. Version 10 is populated (1,866 entities). Measured in a browser, not
    // read off the type declarations; `scripts/smoke-browser.ts` is the check.
    version: SymbolID.Version_APP6D,
    note: "NATO sibling of 2525D. Same artwork for most entities, its own for a subset.",
  },
  {
    id: "APP6E",
    label: "NATO APP-6(E) ch.2",
    version: SymbolID.Version_APP6Ech2,
    note: "NATO sibling of 2525E. Smaller catalog — it drops the US-only entities.",
  },
] as const;

export const DEFAULT_STANDARD_ID = "2525D";

export function standardOf(id: string): Standard {
  return STANDARDS.find((s) => s.id === id) ?? STANDARDS[0]!;
}

/* ---------------------------------------------------------------- the field values */

export interface FieldOption {
  code: number;
  label: string;
  /** Which of several unrelated vocabularies this value belongs to (digits 9-10). */
  group?: string;
}

/** Digit 4. The one field an operator changes more than any other. */
export const AFFILIATIONS: readonly FieldOption[] = [
  { code: SymbolID.StandardIdentity_Affiliation_Friend, label: "Friend" },
  {
    code: SymbolID.StandardIdentity_Affiliation_Hostile_Faker,
    label: "Hostile / faker",
  },
  { code: SymbolID.StandardIdentity_Affiliation_Neutral, label: "Neutral" },
  { code: SymbolID.StandardIdentity_Affiliation_Unknown, label: "Unknown" },
  { code: SymbolID.StandardIdentity_Affiliation_Pending, label: "Pending" },
  {
    code: SymbolID.StandardIdentity_Affiliation_AssumedFriend,
    label: "Assumed friend",
  },
  {
    code: SymbolID.StandardIdentity_Affiliation_Suspect_Joker,
    label: "Suspect / joker",
  },
] as const;

/** Digit 3 — whether what is drawn is real, an exercise, or a simulation. */
export const CONTEXTS: readonly FieldOption[] = [
  { code: SymbolID.StandardIdentity_Context_Reality, label: "Reality" },
  { code: SymbolID.StandardIdentity_Context_Exercise, label: "Exercise" },
  { code: SymbolID.StandardIdentity_Context_Simulation, label: "Simulation" },
] as const;

/** Digit 7. */
export const STATUSES: readonly FieldOption[] = [
  { code: SymbolID.Status_Present, label: "Present" },
  {
    code: SymbolID.Status_Planned_Anticipated_Suspect,
    label: "Planned / anticipated",
  },
  { code: SymbolID.Status_Present_FullyCapable, label: "Fully capable" },
  { code: SymbolID.Status_Present_Damaged, label: "Damaged" },
  { code: SymbolID.Status_Present_Destroyed, label: "Destroyed" },
  { code: SymbolID.Status_Present_FullToCapacity, label: "Full to capacity" },
] as const;

/** Digit 8 — headquarters, task force, feint/dummy, and their combinations. */
export const HQTFDS: readonly FieldOption[] = [
  { code: SymbolID.HQTFD_Unknown, label: "None" },
  { code: SymbolID.HQTFD_Headquarters, label: "Headquarters" },
  { code: SymbolID.HQTFD_TaskForce, label: "Task force" },
  { code: SymbolID.HQTFD_TaskForce_Headquarters, label: "Task force HQ" },
  { code: SymbolID.HQTFD_FeintDummy, label: "Feint / dummy" },
  { code: SymbolID.HQTFD_FeintDummy_Headquarters, label: "Feint/dummy HQ" },
  { code: SymbolID.HQTFD_FeintDummy_TaskForce, label: "Feint/dummy task force" },
  {
    code: SymbolID.HQTFD_FeintDummy_TaskForce_Headquarters,
    label: "Feint/dummy task force HQ",
  },
] as const;

/**
 * Digits 9-10 — one field carrying three unrelated vocabularies.
 *
 * Echelon, mobility and towed array never apply to the same symbol, but they share the
 * two digits, so the picker groups them rather than pretending they are one ordered
 * scale. `group` is what the `optgroup` is built from.
 */
export const AMPLIFIER_DESCRIPTORS: readonly FieldOption[] = [
  { code: SymbolID.Echelon_Unknown, label: "None", group: "None" },
  { code: SymbolID.Echelon_Team_Crew, label: "Team / crew", group: "Echelon" },
  { code: SymbolID.Echelon_Squad, label: "Squad", group: "Echelon" },
  { code: SymbolID.Echelon_Section, label: "Section", group: "Echelon" },
  {
    code: SymbolID.Echelon_Platoon_Detachment,
    label: "Platoon / detachment",
    group: "Echelon",
  },
  {
    code: SymbolID.Echelon_Company_Battery_Troop,
    label: "Company / battery / troop",
    group: "Echelon",
  },
  {
    code: SymbolID.Echelon_Battalion_Squadron,
    label: "Battalion / squadron",
    group: "Echelon",
  },
  {
    code: SymbolID.Echelon_Regiment_Group,
    label: "Regiment / group",
    group: "Echelon",
  },
  { code: SymbolID.Echelon_Brigade, label: "Brigade", group: "Echelon" },
  { code: SymbolID.Echelon_Division, label: "Division", group: "Echelon" },
  { code: SymbolID.Echelon_Corps_MEF, label: "Corps / MEF", group: "Echelon" },
  { code: SymbolID.Echelon_Army, label: "Army", group: "Echelon" },
  {
    code: SymbolID.Echelon_ArmyGroup_Front,
    label: "Army group / front",
    group: "Echelon",
  },
  {
    code: SymbolID.Echelon_Region_Theater,
    label: "Region / theater",
    group: "Echelon",
  },
  { code: SymbolID.Echelon_Region_Command, label: "Command", group: "Echelon" },
  { code: 31, label: "Wheeled, limited cross-country", group: "Mobility" },
  { code: 32, label: "Wheeled, cross-country", group: "Mobility" },
  { code: 33, label: "Tracked", group: "Mobility" },
  { code: 34, label: "Wheeled and tracked", group: "Mobility" },
  { code: 35, label: "Towed", group: "Mobility" },
  { code: 36, label: "Rail", group: "Mobility" },
  { code: 37, label: "Pack animals", group: "Mobility" },
  { code: 41, label: "Over-snow prime mover", group: "Mobility" },
  { code: 42, label: "Sled", group: "Mobility" },
  { code: 51, label: "Barge", group: "Mobility" },
  { code: 52, label: "Amphibious", group: "Mobility" },
  { code: 61, label: "Short towed array", group: "Towed array" },
  { code: 62, label: "Long towed array", group: "Towed array" },
] as const;

/* -------------------------------------------------------------------- composition */

/**
 * The eight fields that turn a catalog entry into the code the renderer draws.
 *
 * Every one of them is a *frame* decision — what shape is drawn around the icon and
 * what is drawn on it — as opposed to the lettering, which is `Amplifiers`. The split
 * matters to the memo: these change the SIDC string, so they are already in its key by
 * being in it, and the amplifiers have to be added to it by hand.
 */
export interface SidcFields {
  version: number;
  context: number;
  affiliation: number;
  status: number;
  hqtfd: number;
  amplifierDescriptor: number;
  modifier1: number;
  modifier2: number;
}

export const DEFAULT_FIELDS: SidcFields = {
  version: SymbolID.Version_2525Dch1,
  context: SymbolID.StandardIdentity_Context_Reality,
  affiliation: SymbolID.StandardIdentity_Affiliation_Friend,
  status: SymbolID.Status_Present,
  hqtfd: SymbolID.HQTFD_Unknown,
  amplifierDescriptor: SymbolID.Echelon_Unknown,
  modifier1: 0,
  modifier2: 0,
};

/**
 * A base symbol (symbol set + entity code) plus the operator's field choices, as a
 * 20-digit SIDC.
 *
 * ### The base id is not a prefix of the code
 *
 * `MSLookup` keys its tables by an **eight-character** id — two digits of symbol set
 * followed by six of entity — and those two halves are *not adjacent* in a SIDC: the
 * set is at digits 5-6 and the entity at 11-16, with status, HQTFD and the echelon
 * between them. So the id is taken apart and spliced in through `setSymbolSet` and
 * `setEntityCode` rather than padded out into a code.
 *
 * This is the demo's one real bug so far, and it is recorded because it was invisible:
 * padding `"10121100"` to twenty digits produces a **valid, renderable** SIDC — version
 * 10, symbol set 21, entity 000000 — so every tile drew a plausible bare frame of the
 * right affiliation and nothing looked broken until the entity codes were read back out
 * of the composed string.
 */
export function composeSidc(basicId: string, fields: SidcFields): string {
  const padded = basicId.padStart(8, "0");
  let sidc = "0".repeat(20);
  sidc = SymbolID.setSymbolSet(sidc, Number(padded.slice(0, 2)));
  sidc = SymbolID.setEntityCode(sidc, Number(padded.slice(2, 8)));
  sidc = SymbolID.setVersion(sidc, fields.version);
  sidc = SymbolID.setContext(sidc, fields.context);
  sidc = SymbolID.setAffiliation(sidc, fields.affiliation);
  sidc = SymbolID.setStatus(sidc, fields.status);
  sidc = SymbolID.setHQTFD(sidc, fields.hqtfd);
  sidc = SymbolID.setAmplifierDescriptor(sidc, fields.amplifierDescriptor);
  sidc = SymbolID.setModifier1(sidc, fields.modifier1);
  sidc = SymbolID.setModifier2(sidc, fields.modifier2);
  return sidc;
}

/** Read the fields back out of a code — what the properties panel is populated from. */
export function fieldsOf(sidc: string): SidcFields {
  return {
    version: SymbolID.getVersion(sidc),
    context: SymbolID.getContext(sidc),
    affiliation: SymbolID.getAffiliation(sidc),
    status: SymbolID.getStatus(sidc),
    hqtfd: SymbolID.getHQTFD(sidc),
    amplifierDescriptor: SymbolID.getAmplifierDescriptor(sidc),
    modifier1: SymbolID.getModifier1(sidc),
    modifier2: SymbolID.getModifier2(sidc),
  };
}

/** The base symbol a code was composed from — symbol set and entity, nothing else. */
export function basicIdOf(sidc: string): string {
  return sidc.slice(4, 6) + sidc.slice(10, 16);
}

/**
 * Whether this symbol is drawn with a staff — the one SIDC condition the *marker
 * layer* cares about rather than the renderer.
 *
 * A staffed symbol is anchored at the foot of its staff rather than the middle of its
 * frame (see `markerOffset`), which is the difference between a command post standing
 * on its coordinate and standing in a patch of sky above it. Digit 8's four
 * HQ-bearing values are the whole test.
 */
export function isHeadquarters(sidc: string): boolean {
  const hqtfd = SymbolID.getHQTFD(sidc);
  return (
    hqtfd === SymbolID.HQTFD_Headquarters ||
    hqtfd === SymbolID.HQTFD_FeintDummy_Headquarters ||
    hqtfd === SymbolID.HQTFD_TaskForce_Headquarters ||
    hqtfd === SymbolID.HQTFD_FeintDummy_TaskForce_Headquarters
  );
}
