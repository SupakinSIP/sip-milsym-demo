/**
 * Drawing a MIL-STD-2525D/E or APP-6(D)/(E) symbol with mil-sym-ts.
 *
 * The demo's answer to the question `@map-army/symbology` answers for 2525C: **what
 * does a symbol look like** — the renderer wrapper and its memo, the text amplifiers,
 * and the SIDC fields that decide the frame. Plus, because this renderer carries its
 * own lookup tables, the question `@map-army/symbols` answers over there: **which
 * symbols exist**.
 *
 * ### The contract is the point
 *
 * No React, no store, no `document`, no `window` — the same discipline the package
 * this is modelled on holds itself to, and for the same reason: the marker layer, the
 * gallery tiles and any second frontend all draw through `renderSymbol` and none of
 * them knows which library is underneath. `sip-map-army`'s reconciler was ported into
 * `src/map/` by changing an import and one call, which is the claim this demo was
 * built to check.
 *
 * ### What is deliberately missing
 *
 * `amplifierPlacement` — the table of where each of the twenty-four amplifiers lands
 * around the frame — has no counterpart here, and its absence is the finding. It exists
 * over there because two fields had to be lettered *by the app*, outside the SVG, and
 * once you are drawing text next to a symbol you need to know where every other field
 * already is. mil-sym-ts lays out its own amplifiers and grows the image bounds to fit
 * them, so there is no text outside the SVG and nothing to place. See
 * `amplifiers.ts` for the two fields and what milsymbol does with them.
 *
 * `symbolName` — reading a symbol's name in another language — is also absent, and that
 * one is only out of scope. The catalog's `name` and `path` come out of the renderer in
 * English; a Thai reading would be a table beside it, exactly as it is over there.
 */

/* ----------------------------------------------------- waking the renderer up */

export { initRenderer, rendererIsReady } from "./renderer.js";

/* ---------------------------------------------------- the amplifier vocabulary */

export type { AmplifierKey, Amplifiers } from "./amplifiers.js";
export {
  ALL_AMPLIFIER_KEYS,
  AMPLIFIER_KEYS,
  AMPLIFIER_MAX_CHARS,
  AMPLIFIER_MAX_CHARS_HARD,
  amplifierDescriptionOf,
  amplifierLetterOf,
  amplifierMapOf,
  amplifierNameOf,
  GRAPHIC_AMPLIFIER_KEYS,
  hasAmplifiers,
} from "./amplifiers.js";

/* ------------------------------------------------- SIDC + amplifiers → SVG */

export type { RenderOptions, RenderedSymbol } from "./renderSymbol.js";
export {
  renderCacheSize,
  renderSymbol,
  resetRenderCache,
} from "./renderSymbol.js";

/* --------------------------------- multipoint graphics: SIDC + vertices -> GeoJSON */

export type { GraphicCollection, GraphicFeature, GraphicOptions, GraphicResult } from "./renderGraphic.js";
export {
  axisHalfWidthMetres,
  axisWidthCheck,
  axisWidthPoint,
  clickBudgetForRule,
  controlPointsForRule,
  graphicCacheSize,
  renderGraphic,
  resetGraphicCache,
} from "./renderGraphic.js";
export type { AxisWidthCheck } from "./renderGraphic.js";

/* ------------------------------------------------- the fields of a SIDC */

export type { FieldOption, SidcFields, Standard } from "./sidc.js";
export {
  AFFILIATIONS,
  AMPLIFIER_DESCRIPTORS,
  CONTEXTS,
  DEFAULT_FIELDS,
  DEFAULT_STANDARD_ID,
  HQTFDS,
  STANDARDS,
  STATUSES,
  basicIdOf,
  composeSidc,
  fieldsOf,
  isHeadquarters,
  standardOf,
} from "./sidc.js";

/* ------------------------------------------------- which symbols exist */

export type { Catalog, CatalogEntry, SearchQuery } from "./catalog.js";
export type { DrawRuleText } from "./data/drawRules.js";
export {
  canRender,
  catalogOf,
  drawRuleTextOf,
  drawableCountOf,
  modifiersOf,
  searchCatalog,
} from "./catalog.js";

/* ------------------------------------------------- how much of it there is */

export type { CoverageReport, StandardCoverage } from "./coverage.js";
export {
  MAP_ARMY_BASELINE,
  coverageReport,
  exclusionReasonOf,
  headlineComparison,
  isWarfightingSet,
} from "./coverage.js";
