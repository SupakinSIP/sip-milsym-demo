import { Modifiers } from "@armyc2.c5isr.renderer/mil-sym-ts-web";

/**
 * Every text amplifier this demo can draw, and how long each one may be.
 *
 * Modelled on `@map-army/symbology`'s `amplifiers.ts`, and the same decision is made
 * for the same reason: **the keys are the renderer's own option names**, so the bag is
 * handed across as-is and there is no mapping table to drift out of step with either
 * side. There they are `milsymbol`'s `SymbolOptions` names; here they are
 * `Modifiers`' own constants, which are the keys of the `Map` `RenderSVG` takes.
 *
 * ### The list that does not need a counterpart
 *
 * `@map-army/symbology` also exports `SELF_LETTERED_AMPLIFIER_KEYS` — the two fields
 * the app letters itself because milsymbol draws them wrongly: Field AH is clipped by
 * a viewBox that never grew to fit it, and Field C is printed on top of the echelon
 * marker for all fourteen echelons. There is no such list here, and that is the most
 * substantive difference between the two renderers in this demo: mil-sym-ts lays out
 * its own amplifiers in the boxes the standard gives them and grows the image bounds
 * to fit, so Field AH and Field C go across with everything else and the marker layer
 * has one drawing path instead of three.
 *
 * If a field ever does need lettering by hand, the shape to copy is that export — a
 * short list, derived subsets, and an argument per entry — not a special case inside
 * the reconciler.
 */

/**
 * The amplifiers, in the order the panel shows them.
 *
 * Ordered by what an operator reaches for rather than by the standard's field letters:
 * designation and formation first, because those two are most of the real use, and the
 * free text last because it has no fixed meaning. `Modifiers.GetUnitModifierList()`
 * would enumerate more of them, but it enumerates them in the standard's order and
 * includes fields whose value is a graphic decision (an azimuth, a speed leader) — so
 * the demo's panel is a curated subset and says so.
 */
export const AMPLIFIER_KEYS = [
  Modifiers.T_UNIQUE_DESIGNATION_1,
  Modifiers.M_HIGHER_FORMATION,
  Modifiers.AW_HEADQUARTERS_ELEMENT,
  Modifiers.W_DTG_1,
  Modifiers.Y_LOCATION,
  Modifiers.Z_SPEED,
  Modifiers.X_ALTITUDE_DEPTH,
  Modifiers.V_EQUIP_TYPE,
  Modifiers.C_QUANTITY,
  Modifiers.F_REINFORCED_REDUCED,
  Modifiers.J_EVALUATION_RATING,
  Modifiers.K_COMBAT_EFFECTIVENESS,
  Modifiers.L_SIGNATURE_EQUIP,
  Modifiers.P_IFF_SIF_AIS,
  Modifiers.AR_SPECIAL_DESIGNATOR,
  Modifiers.AA_SPECIAL_C2_HQ,
  Modifiers.AQ_GUARDED_UNIT,
  Modifiers.AF_COMMON_IDENTIFIER,
  Modifiers.AS_COUNTRY,
  Modifiers.AD_PLATFORM_TYPE,
  Modifiers.AE_EQUIPMENT_TEARDOWN_TIME,
  Modifiers.H_ADDITIONAL_INFO_1,
  Modifiers.G_STAFF_COMMENTS,
  /** The standard's "ENY" hostile-equipment amplifier. */
  Modifiers.N_HOSTILE,
] as const;

/**
 * An amplifier's key — one of `AMPLIFIER_KEYS`.
 *
 * Widened to `string` rather than a literal union, and that is the renderer's doing,
 * not a shortcut: `Modifiers`' constants are declared `static readonly x: string`, so
 * `as const` on the array above cannot narrow past `string`. Where
 * `@map-army/symbology` gets a checked union for free from a literal array, this file
 * gets it only by writing the twenty-four names out a second time — two lists to keep
 * in step, which is the failure the "keys are the renderer's own names" rule exists to
 * avoid. The bound that is actually load-bearing is the loop: everything that reads an
 * amplifier iterates `AMPLIFIER_KEYS`, so a key not on that list is never drawn, never
 * keyed, and never saved.
 */
export type AmplifierKey = string;

/**
 * The modifiers a **multipoint graphic** takes, on top of the list above.
 *
 * **This list exists because leaving it out was a bug, and a quiet one.** `AMPLIFIER_KEYS`
 * is the vocabulary of a *point* symbol — the fields lettered around a frame — and
 * `amplifierMapOf` iterates it, so anything not on it is dropped on the way to the
 * renderer. Field AM is not on it, because nothing lettered around a frame is a distance.
 *
 * Field AM is also the field 54 of 2525D's 415 multipoint graphics **cannot be drawn
 * without**: an air corridor has no width until it has one. So the panel offered the
 * input, the operator typed 4000, the value was filtered out one layer down, and the
 * renderer went on refusing the graphic with a message asking for exactly the number that
 * had just been typed. Nothing threw and nothing logged.
 *
 * The four below are the ones a multipoint graphic needs and a framed symbol does not:
 *
 * - `AM_DISTANCE` — a width, a radius, or a comma-separated list of them. **Geometry**,
 *   not lettering: it decides the shape, and 54 graphics will not draw without it.
 * - `AN_AZIMUTH` — a bearing, or a pair of them for a sector. Also geometry.
 * - `T2_UNIQUE_DESIGNATION_3` — the second designation a boundary letters, one per side.
 * - `W1_DTG_2` — the closing time of a graphic that letters an interval.
 *
 * `X_ALTITUDE_DEPTH` is a corridor's floor and ceiling and is needed just as often, but
 * it is already in `AMPLIFIER_KEYS` — a framed symbol letters an altitude too — so it is
 * not repeated here.
 */
export const GRAPHIC_AMPLIFIER_KEYS = [
  Modifiers.AM_DISTANCE,
  Modifiers.AN_AZIMUTH,
  Modifiers.T2_UNIQUE_DESIGNATION_3,
  Modifiers.W1_DTG_2,
] as const;

/**
 * Every key any renderer path will pass through: the frame's lettering plus the
 * geometry-bearing modifiers.
 *
 * Derived rather than written out, so a key added to either list reaches the renderer
 * without a third place to remember.
 */
export const ALL_AMPLIFIER_KEYS: readonly string[] = [
  ...AMPLIFIER_KEYS,
  ...GRAPHIC_AMPLIFIER_KEYS,
];

/** A symbol's text amplifiers. Absent keys and empty strings both mean "none". */
export type Amplifiers = Partial<Record<AmplifierKey, string>>;

/**
 * How long each amplifier may be, from the standard's own `Format:` line.
 *
 * Per-field rather than the one global bound `@map-army/symbology` uses, because the
 * renderer's own documentation states each one and the values are wildly different — a
 * unique designation is thirty characters, a reinforced/reduced marker is one, a
 * country code is exactly three. Enforcing the real bound in the input is what keeps
 * an operator from typing a phrase into a field the standard says is a single letter
 * and then wondering why the picture looks wrong.
 *
 * These are `maxLength` on an input, not a security boundary. The bound that matters
 * for that reason is `AMPLIFIER_MAX_CHARS`, below, and it applies to every field
 * whatever the standard says: everything typed here is drawn into an SVG by every
 * browser that opens the map.
 */
export const AMPLIFIER_MAX_CHARS: Readonly<Record<AmplifierKey, number>> = {
  [Modifiers.T_UNIQUE_DESIGNATION_1]: 30,
  [Modifiers.M_HIGHER_FORMATION]: 21,
  [Modifiers.AW_HEADQUARTERS_ELEMENT]: 8,
  [Modifiers.W_DTG_1]: 16,
  [Modifiers.Y_LOCATION]: 16,
  [Modifiers.Z_SPEED]: 9,
  [Modifiers.X_ALTITUDE_DEPTH]: 14,
  [Modifiers.V_EQUIP_TYPE]: 24,
  [Modifiers.C_QUANTITY]: 19,
  [Modifiers.F_REINFORCED_REDUCED]: 1,
  [Modifiers.J_EVALUATION_RATING]: 2,
  [Modifiers.K_COMBAT_EFFECTIVENESS]: 3,
  [Modifiers.L_SIGNATURE_EQUIP]: 1,
  [Modifiers.P_IFF_SIF_AIS]: 5,
  [Modifiers.AR_SPECIAL_DESIGNATOR]: 3,
  [Modifiers.AA_SPECIAL_C2_HQ]: 9,
  [Modifiers.AQ_GUARDED_UNIT]: 6,
  [Modifiers.AF_COMMON_IDENTIFIER]: 12,
  [Modifiers.AS_COUNTRY]: 3,
  [Modifiers.AD_PLATFORM_TYPE]: 5,
  [Modifiers.AE_EQUIPMENT_TEARDOWN_TIME]: 3,
  [Modifiers.H_ADDITIONAL_INFO_1]: 20,
  [Modifiers.G_STAFF_COMMENTS]: 20,
  [Modifiers.N_HOSTILE]: 3,
  // The geometry-bearing modifiers. AM and AN take comma-separated lists, so their
  // bounds are the standard's per-value formats times the number of values a graphic can
  // ask for — generous rather than exact, because a cap that truncated the third radius
  // of a three-ring zone would be worse than no cap.
  [Modifiers.AM_DISTANCE]: 32,
  [Modifiers.AN_AZIMUTH]: 32,
  [Modifiers.T2_UNIQUE_DESIGNATION_3]: 30,
  [Modifiers.W1_DTG_2]: 16,
};

/**
 * The hard bound, applied on top of the per-field one.
 *
 * Same argument as `@map-army/symbology`'s constant of the same name: every amplifier
 * is drawn into the SVG by every browser that opens the map, so an unbounded value is
 * a denial of service on everyone the plan is shared with. This demo has no server and
 * no sharing, so nothing can arrive from outside the tab — the bound is kept anyway,
 * because the shape a demo shows is the shape somebody copies.
 */
export const AMPLIFIER_MAX_CHARS_HARD = 64;

/** What to put on the field's label — "T", "M", "AW". */
export function amplifierLetterOf(key: AmplifierKey): string {
  return Modifiers.getModifierLetterCode(key) || key;
}

/** What the standard calls the field — "Unique Designation", "Higher Formation". */
export function amplifierNameOf(key: AmplifierKey): string {
  return Modifiers.getModifierName(key) || key;
}

/** The standard's own prose for the field, for the input's tooltip. */
export function amplifierDescriptionOf(key: AmplifierKey): string {
  return Modifiers.getModifierDescription(key) || "";
}

/**
 * The amplifiers that actually say something, as the `Map` `RenderSVG` takes.
 *
 * Empty is omitted rather than passed, for the reason `renderSymbol`'s loop in
 * `@map-army/symbology` gives: a renderer reserves layout for a field it is given, so
 * `""` costs a blank row in the symbol's box.
 */
export function amplifierMapOf(amplifiers: Amplifiers): Map<string, string> {
  const map = new Map<string, string>();
  // Every key either path can pass, not just the frame lettering — see
  // `GRAPHIC_AMPLIFIER_KEYS` for the bug that taught this.
  for (const key of ALL_AMPLIFIER_KEYS) {
    const value = (amplifiers[key] ?? "").trim();
    if (value !== "") {
      map.set(key, value.slice(0, AMPLIFIER_MAX_CHARS_HARD));
    }
  }
  return map;
}

/**
 * Whether any amplifier actually says something.
 *
 * Not `Object.keys(a).length > 0`: typing into a field and clearing it again leaves
 * `{ Z_SPEED: "" }`, which is an empty bag wearing a key.
 */
export function hasAmplifiers(amplifiers: Amplifiers): boolean {
  return AMPLIFIER_KEYS.some((key) => (amplifiers[key] ?? "").trim() !== "");
}
