import {
  MilStdAttributes,
  WebRenderer,
} from "@armyc2.c5isr.renderer/mil-sym-ts-web";
import { amplifierMapOf, type Amplifiers } from "./amplifiers.js";

/**
 * Tactical graphics — boundaries, phase lines, corridors, obstacle belts — as GeoJSON
 * on a real map.
 *
 * `renderSymbol` is the single-point path: a SIDC in, an SVG of fixed size out, and the
 * marker layer stands it on a coordinate. This is the other path, and it is a different
 * shape of problem: a multipoint graphic has **no size and no anchor**, it has
 * *vertices*, and what comes back is geography rather than a picture. An axis of advance
 * drawn through three clicked points is 12KB of computed arrowhead, taper and centre
 * line, in longitude and latitude.
 *
 * `sip-map-army` has nothing to port here. Its renderer draws thirteen scheme-`G` keys
 * out of milsymbol's 1,324 — one bridge and twelve incident points — so tactical
 * graphics as a family are outside it, and its answer is a hand-authored table of
 * twenty-one names and abbreviations attached to shapes the operator draws themselves
 * (`packages/symbols/src/graphics.ts`, which says so in its own docblock). This file is
 * the thing that table stands in for.
 *
 * ### What the renderer returns, and what it expects
 *
 * `WebRenderer.RenderSymbol(..., OUTPUT_FORMAT_GEOJSON)` gives a `FeatureCollection`
 * whose features are already styled: `Polygon` and `MultiLineString` for the drawing,
 * carrying `strokeColor`, `strokeWidth`, `fillColor`, `fillOpacity` and sometimes
 * `strokeDasharray`; and `Point` features for the lettering, carrying `label`, a font,
 * an `anchorPoint` and pixel offsets. Measured across all 415 line and area entities of
 * 2525D, not read off a document — see `scripts/smoke-browser.ts`.
 *
 * Control points go in as a string of `lng,lat` pairs separated by spaces, decimal
 * degrees, **longitude first**. That ordering is worth stating twice: the parameter is
 * documented as `"x1,y1 [xn,yn]"` and a graphic drawn with the pair swapped renders
 * perfectly happily somewhere off the coast of Somalia.
 *
 * ### It refuses, and it says why
 *
 * 54 of those 415 need a modifier before they can be drawn at all — an air corridor has
 * no width until Field AM says so — and the renderer answers with
 * `{"type":"error","error":"... requires a modifiers object that has 1 distance/AM
 * value."}` rather than throwing or drawing something wrong. That message is parsed
 * below into `needs`, so the panel can ask for the field instead of showing the operator
 * a raw error. With the modifier supplied, all 415 render.
 */

export interface GraphicOptions {
  amplifiers?: Amplifiers;
  /** Stroke width in pixels. The renderer bakes it into the returned features. */
  lineWidth?: number;
  /**
   * Map scale, as metres of ground per metre of map.
   *
   * Only some graphics use it — the ones the renderer clips or simplifies for the
   * current view. A fixed value is passed rather than one derived from the zoom, because
   * a graphic whose *geometry* changed as the operator zoomed would be a different
   * graphic at every zoom level, and the store holds one.
   */
  scale?: number;
}

/** What one styled feature of a rendered graphic looks like. */
export interface GraphicFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: unknown;
  };
}

export interface GraphicCollection {
  type: "FeatureCollection";
  features: GraphicFeature[];
}

export type GraphicResult =
  | { ok: true; collection: GraphicCollection }
  | {
      ok: false;
      error: string;
      /**
       * The amplifier the renderer is asking for, when the error names one.
       *
       * `"AM_DISTANCE"` for the width of a corridor or the radius of a circle. Null when
       * the refusal is something else — a symbol that is not multipoint, or an entity
       * with no draw rule.
       */
      needs: string | null;
    };

const DEFAULT_SCALE = 50000;

const cache = new Map<string, GraphicResult>();

function keyOf(
  sidc: string,
  points: readonly (readonly [number, number])[],
  options: GraphicOptions,
): string {
  const modifiers = options.amplifiers ? amplifierMapOf(options.amplifiers) : null;
  return JSON.stringify([
    sidc,
    points,
    options.lineWidth ?? 3,
    options.scale ?? DEFAULT_SCALE,
    modifiers ? [...modifiers].sort(([a], [b]) => (a < b ? -1 : 1)) : [],
  ]);
}

/**
 * `[lng, lat]` pairs as the renderer's control-point string.
 *
 * Six decimal places is about 10cm at this latitude, which is far finer than anything
 * clicked on a map and keeps the memo key from changing on floating-point noise.
 */
function controlPointsOf(
  points: readonly (readonly [number, number])[],
): string {
  return points
    .map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`)
    .join(" ");
}

function build(
  sidc: string,
  points: readonly (readonly [number, number])[],
  options: GraphicOptions,
): GraphicResult {
  const attributes = new Map<string, string>();
  attributes.set(MilStdAttributes.LineWidth, String(options.lineWidth ?? 3));
  const modifiers = options.amplifiers
    ? amplifierMapOf(options.amplifiers)
    : new Map<string, string>();

  let raw: string;
  try {
    raw = WebRenderer.RenderSymbol(
      // The id becomes a property on every feature, which is what lets one source hold
      // every graphic on the map and still know which is which.
      sidc,
      "",
      "",
      sidc,
      controlPointsOf(points),
      "clampToGround",
      options.scale ?? DEFAULT_SCALE,
      // No bounding box: it is documented as optional and as a performance hint that
      // *clips* the result to the view. Clipping is wrong here — the store holds one
      // geometry and the map is panned around it.
      "",
      modifiers,
      attributes,
      WebRenderer.OUTPUT_FORMAT_GEOJSON,
    );
  } catch (cause) {
    return { ok: false, error: String(cause), needs: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: `The renderer returned something that is not JSON: ${raw.slice(0, 200)}`,
      needs: null,
    };
  }

  const holder = parsed as { type?: string; error?: string };
  if (holder.type === "FeatureCollection") {
    return { ok: true, collection: parsed as GraphicCollection };
  }
  const message = holder.error ?? `Unexpected result: ${raw.slice(0, 200)}`;
  return {
    ok: false,
    error: message,
    // Matched on the phrase the renderer actually writes, and only that phrase: a
    // looser test would claim a field is missing whenever the word "distance" appeared
    // in some other refusal.
    needs: /distance\/AM value/i.test(message) ? "AM_DISTANCE" : null,
  };
}

/**
 * Render one tactical graphic, memoised on everything that can change it.
 *
 * The memo earns more here than it does for point symbols. A store change re-runs the
 * overlay's whole sync, and one axis of advance is twelve kilobytes of trigonometry —
 * so without this, dragging any unrelated mark would recompute every graphic on the map.
 */
export function renderGraphic(
  sidc: string,
  points: readonly (readonly [number, number])[],
  options: GraphicOptions = {},
): GraphicResult {
  if (points.length === 0) {
    return { ok: false, error: "No control points", needs: null };
  }
  const key = keyOf(sidc, points, options);
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const result = build(sidc, points, options);
  cache.set(key, result);
  return result;
}

/* ------------------------------------------------- clicks in, standard order out */

/**
 * The gesture, and the two clicks map.army gets away with.
 *
 * `map.army`'s offensive-line arrow takes **two clicks** and comes out clean, and the
 * reason is not a better renderer: MSS owns both the geometry and the gesture, so it can
 * decide that the operator's clicks are the axis and that everything else about the shape
 * — how wide the corridor is, where the back of the arrowhead sits — is the tool's
 * problem rather than the operator's.
 *
 * Nothing stops this project from making the same decision, and the standard is not what
 * was in the way. `AXIS1`/`AXIS2` define **control points**, not clicks:
 *
 * > "Point 1 defines the tip of the arrowhead. Point N-1 defines the rear of the symbol.
 * > Point N defines the back of the arrowhead. … Points 1 through N-1 determine the
 * > symbol's center line and Point N determines the width."
 *
 * A control point the tool computes is as conformant as one a mouse produced — what goes
 * to the renderer is the standard's convention either way. So the axis gesture is now:
 *
 * - the operator clicks **the axis only**, rear → arrowhead, two clicks or more;
 * - this function reverses that into the tip-first centre line the rule wants;
 * - and it **derives point N itself**, perpendicular to the first leg, at a width that
 *   cannot trip the renderer's collapse condition (see `axisWidthCheck`).
 *
 * The derived point is a real control point in the stored geometry, at index N, so it is
 * one of the numbered handles the point editor drags: the width is a default, not a
 * decision taken away. That is the whole mechanism — two clicks to place, one drag to
 * adjust — and it is why an operator no longer has to click a width point perpendicular
 * to a leg they cannot see yet, which is the click that produced a fan of hairline wedges.
 *
 * Everything else is passed through untouched. `AREA*` and most `LINE*` rules genuinely
 * are "click the shape", and a rule this function does not name is a rule whose order has
 * not been measured — passing it through is the only honest thing to do with it. See
 * `drawRuleTextOf` for what the other 65 rules say about their own points.
 */
export function controlPointsForRule(
  ruleName: string,
  clicked: readonly (readonly [number, number])[],
): readonly (readonly [number, number])[] {
  if (!ruleName.startsWith("AXIS") || clicked.length < 2) {
    return clicked;
  }
  const centreLine = [...clicked].reverse();
  return [...centreLine, axisWidthPoint(centreLine)];
}

/**
 * How many clicks a rule actually asks of the operator.
 *
 * The catalog's `minPoints`/`maxPoints` come from the library and count **control
 * points**. For an axis graphic one of those is derived rather than clicked, so the
 * gesture is one shorter than the geometry — and the hint bar, the tile and the commit
 * threshold all have to agree on which of the two numbers they are talking about, or the
 * tool asks for a click it will then ignore.
 */
export function clickBudgetForRule(
  ruleName: string,
  minPoints: number,
  maxPoints: number,
): { minClicks: number; maxClicks: number } {
  if (!ruleName.startsWith("AXIS")) {
    return { minClicks: minPoints, maxClicks: maxPoints };
  }
  return {
    minClicks: Math.max(2, minPoints - 1),
    maxClicks: Math.max(2, maxPoints - 1),
  };
}

/**
 * The half width this tool gives an axis it was not told the width of.
 *
 * A fraction of the axis's own length, because an axis of advance is drawn at the scale
 * of the advance: a 40 km axis with a 200 m corridor is a line with a pretence of width,
 * and the same corridor on a 2 km axis is a blob. Capped against the **first leg**
 * because that is the quantity the renderer's collapse test compares against — see
 * `axisWidthCheck`. The cap is what makes the two-click gesture safe by construction
 * rather than safe in the cases that were tried.
 */
const AXIS_WIDTH_OF_LENGTH = 0.1;
const AXIS_WIDTH_LEG_CAP = 0.35;

export function axisHalfWidthMetres(
  centreLine: readonly (readonly [number, number])[],
): number {
  if (centreLine.length < 2) {
    return 0;
  }
  let total = 0;
  for (let i = 1; i < centreLine.length; i += 1) {
    total += distanceMetres(centreLine[i - 1]!, centreLine[i]!);
  }
  const firstLeg = distanceMetres(centreLine[0]!, centreLine[1]!);
  return Math.min(total * AXIS_WIDTH_OF_LENGTH, firstLeg * AXIS_WIDTH_LEG_CAP);
}

/**
 * How deep the arrowhead is, and why a perpendicular offset is not enough.
 *
 * `AXIS2` gives point N **two jobs**: "Point N defines the back of the arrowhead … and
 * Point N determines the width." The width is its perpendicular distance to leg one; the
 * back of the arrowhead is where it sits *along* the axis. So a point offset square off
 * the tip — which is what the first version of this derivation did, and what the sample
 * laydown had always used — asks for an arrowhead whose back is level with its own point,
 * and the renderer draws exactly that: a blunt stub of a head on an otherwise correct
 * corridor.
 *
 * Setting point N back along the axis gives the head its depth, and the drawn barbs flare
 * wider than the corridor and meet at point 1. Measured against the renderer at 0, 0.5,
 * 1, 2 and 3 half widths of setback: 0 is the blunt notch, and from about 1.5 the head
 * reads as an arrow at a glance. That is the default here.
 *
 * Capped at half of leg one so the back of the head cannot be set back past the next
 * point of the centre line — on a dog-leg whose first leg is short, an uncapped 1.5 half
 * widths would put the arrowhead's back behind the bend it is supposed to start after.
 */
const AXIS_HEAD_OF_WIDTH = 1.5;
const AXIS_HEAD_LEG_CAP = 0.5;

export function axisHeadDepthMetres(
  centreLine: readonly (readonly [number, number])[],
): number {
  if (centreLine.length < 2) {
    return 0;
  }
  const firstLeg = distanceMetres(centreLine[0]!, centreLine[1]!);
  return Math.min(
    axisHalfWidthMetres(centreLine) * AXIS_HEAD_OF_WIDTH,
    firstLeg * AXIS_HEAD_LEG_CAP,
  );
}

/**
 * Point N: set back along the axis from the tip, and offset perpendicular to it.
 *
 * Two components, one per job the rule gives this point — `axisHeadDepthMetres` along the
 * axis for the back of the arrowhead, `axisHalfWidthMetres` across it for the width. The
 * along-axis component does not enter the renderer's collapse test, which takes the
 * *perpendicular* distance to leg one, so giving the head its depth cannot cost the
 * guarantee the width cap buys.
 *
 * Worked in local metres with longitude scaled by the latitude and converted back, so
 * both offsets are the same distance on the ground at any longitude rather than the same
 * number of degrees.
 */
export function axisWidthPoint(
  centreLine: readonly (readonly [number, number])[],
): [number, number] {
  return axisWidthPointFrom(
    centreLine,
    axisHalfWidthMetres(centreLine),
    axisHeadDepthMetres(centreLine),
    // The default side. Which side is arbitrary — the renderer takes the perpendicular
    // *distance* — so it is fixed rather than chosen, and dragging the handle across the
    // centre line does not change the drawn shape.
    1,
  );
}

/**
 * Point N from magnitudes rather than defaults, which is what makes the width adjustable.
 *
 * The editor's half of the derivation: the operator drags the width handle, the drag is
 * resolved into these two magnitudes and clamped, and the point is rebuilt from them.
 * Rebuilt rather than moved, so it stays *on* the perpendicular of leg one — the quantity
 * the rule and the renderer's collapse test both read — instead of drifting off it as a
 * free 2D drag would.
 */
export function axisWidthPointFrom(
  centreLine: readonly (readonly [number, number])[],
  halfWidthMetres: number,
  headDepthMetres: number,
  side: 1 | -1,
): [number, number] {
  const tip = centreLine[0]!;
  const next = centreLine[1] ?? centreLine[0]!;
  const scale = Math.cos((tip[1] * Math.PI) / 180) * METRES_PER_DEGREE;
  const dx = (next[0] - tip[0]) * scale;
  const dy = (next[1] - tip[1]) * METRES_PER_DEGREE;
  const length = Math.hypot(dx, dy);
  if (length === 0 || halfWidthMetres === 0) {
    return [tip[0], tip[1]];
  }
  const ux = dx / length;
  const uy = dy / length;
  const across = halfWidthMetres * side;
  return [
    tip[0] + (ux * headDepthMetres - uy * across) / scale,
    tip[1] + (uy * headDepthMetres + ux * across) / METRES_PER_DEGREE,
  ];
}

/* ------------------------------------------------- editing an axis graphic */

/**
 * A point resolved into the axis's own frame: back along the centre line, and across it.
 *
 * The frame every axis quantity is stated in — the width is `across`, the arrowhead's
 * depth is `along`, and the renderer's collapse test compares `across` with leg one.
 * Stating it once means the editor, the panel and the checks all measure the same thing.
 */
export interface AxisComponents {
  /** Metres back from the tip along leg one. Negative is out in front of the arrowhead. */
  along: number;
  /** Metres from the centre line — the half width. Always positive. */
  across: number;
  /** Which side of the centre line the point is on. */
  side: 1 | -1;
}

export function axisComponentsOf(
  centreLine: readonly (readonly [number, number])[],
  point: readonly [number, number],
): AxisComponents {
  const tip = centreLine[0]!;
  const next = centreLine[1] ?? centreLine[0]!;
  const scale = Math.cos((tip[1] * Math.PI) / 180) * METRES_PER_DEGREE;
  const legX = (next[0] - tip[0]) * scale;
  const legY = (next[1] - tip[1]) * METRES_PER_DEGREE;
  const length = Math.hypot(legX, legY);
  if (length === 0) {
    return { along: 0, across: 0, side: 1 };
  }
  const ux = legX / length;
  const uy = legY / length;
  const offX = (point[0] - tip[0]) * scale;
  const offY = (point[1] - tip[1]) * METRES_PER_DEGREE;
  const across = offX * -uy + offY * ux;
  return {
    along: offX * ux + offY * uy,
    across: Math.abs(across),
    side: across < 0 ? -1 : 1,
  };
}

/**
 * The operator's drag, held inside what the renderer will actually draw.
 *
 * **A width handle that can destroy the graphic is not an adjustable width.** Drag point
 * N far enough out and its perpendicular distance passes leg one, at which point
 * `clsUtility.FilterAXADPoints` discards the centre line and draws a stub — the failure
 * the derivation was built to make impossible, handed back to the operator through the
 * editor. So the drag is clamped rather than refused: the handle follows the pointer to
 * the edge of what draws and then stops, which is a shape that stays legible under a
 * fast drag and needs no error to explain itself.
 *
 * - **across** — the half width — stops at the same 35% of leg one the default uses.
 * - **along** — the arrowhead's depth — stops at 50% of leg one, and cannot go below half
 *   the half width, because a head shallower than that is the blunt stub again.
 */
export function axisClampedComponents(
  centreLine: readonly (readonly [number, number])[],
  components: AxisComponents,
): AxisComponents {
  const firstLeg =
    centreLine.length >= 2
      ? distanceMetres(centreLine[0]!, centreLine[1]!)
      : 0;
  const across = Math.min(components.across, firstLeg * AXIS_WIDTH_LEG_CAP);
  const along = Math.min(
    Math.max(components.along, across * AXIS_HEAD_FLOOR_OF_WIDTH),
    firstLeg * AXIS_HEAD_LEG_CAP,
  );
  return { along, across, side: components.side };
}

const AXIS_HEAD_FLOOR_OF_WIDTH = 0.5;

/**
 * Where the width handle lands when it is dragged to `at`.
 *
 * Returns the whole point array so the caller does not have to know that point N is the
 * last one — the rule's convention stays inside this module, which is the same reason
 * `controlPointsForRule` exists.
 */
export function axisPointsWithWidthAt(
  points: readonly (readonly [number, number])[],
  at: readonly [number, number],
): [number, number][] {
  const centreLine = points.slice(0, -1);
  if (centreLine.length < 2) {
    return points.map(([lng, lat]) => [lng, lat]);
  }
  const clamped = axisClampedComponents(
    centreLine,
    axisComponentsOf(centreLine, at),
  );
  return [
    ...centreLine.map(([lng, lat]) => [lng, lat] as [number, number]),
    axisWidthPointFrom(centreLine, clamped.across, clamped.along, clamped.side),
  ];
}

/**
 * Point N rebuilt after the **centre line** moved, keeping the width the operator chose.
 *
 * Dragging the arrowhead is the case that makes this necessary: leg one changes direction,
 * and a width point left where it was is no longer perpendicular to anything in
 * particular — its half width becomes whatever the new geometry happens to make it, which
 * is how a shape that was fine collapses on a drag that should only have rotated it.
 *
 * So the width and head depth are read off the geometry **as it was before the edit** and
 * the point is rebuilt from those magnitudes against the new centre line, clamped in case
 * the new leg one is shorter than the old width allowed for. Both arrays are needed for
 * that reason: measuring the old width against the new centre line is the stale reading
 * this function exists to avoid. Insert and remove come through here too, since both can
 * change which points leg one runs between.
 */
export function axisPointsAfterCentreLineEdit(
  before: readonly (readonly [number, number])[],
  after: readonly (readonly [number, number])[],
): [number, number][] {
  const centreLine = after.slice(0, -1);
  const wasCentreLine = before.slice(0, -1);
  if (centreLine.length < 2 || wasCentreLine.length < 2) {
    return after.map(([lng, lat]) => [lng, lat]);
  }
  const previous = axisComponentsOf(
    wasCentreLine,
    before[before.length - 1]!,
  );
  const clamped = axisClampedComponents(centreLine, previous);
  return [
    ...centreLine.map(([lng, lat]) => [lng, lat] as [number, number]),
    axisWidthPointFrom(centreLine, clamped.across, clamped.along, clamped.side),
  ];
}

/* ------------------------------------------------- the axis rules and their trap */

/**
 * Whether an axis graphic's width point will make the renderer throw the path away.
 *
 * **This is the single thing that made Main Attack look like a hairline wedge across the
 * map, and it is in the library's source rather than its documentation.**
 * `clsUtility.FilterAXADPoints` reads:
 *
 * ```
 * let pt0 = tg.Pixels[0];                              // the arrowhead tip
 * let controlPt = tg.Pixels[tg.Pixels.length - 1];     // the width control point
 * let pt0Relative = PointRelativeToLine(pt0, pt1, pt0, controlPt);
 * let relativeDist = CalcDistanceDouble(pt0Relative, controlPt) + 5;
 * if (relativeDist > CalcDistanceDouble(pt0, pt1)) {
 *   // …replaces pt1 with an extension along pt0→pt1 and DROPS every middle point
 * }
 * ```
 *
 * So when the half-width exceeds the first leg of the centre line, the renderer does not
 * refuse and does not warn — it **silently discards the path** and draws a stub extended
 * along the first segment by the width. Every one of those degenerate arrows shares an
 * origin, which is what a screenful of them looks like: a fan of hairline wedges from one
 * point.
 *
 * Returned as a measurement rather than a boolean so the panel can say *how much* too
 * wide it is. The `+ 5` in the library is five **pixels** — a screen quantity inside a
 * geographic calculation — so a graphic near the threshold can flip with the zoom the
 * renderer was handed. The margin below is in metres and deliberately conservative.
 */
export interface AxisWidthCheck {
  /** Half the drawn width: the perpendicular distance of the last point to leg one. */
  halfWidthMetres: number;
  /** The length of the first leg of the centre line, tip to the next point. */
  firstLegMetres: number;
  /** True when the renderer will discard the path. */
  collapses: boolean;
}

/** Metres per degree of latitude, near enough for a threshold check. */
const METRES_PER_DEGREE = 111_320;

function distanceMetres(
  [ax, ay]: readonly [number, number],
  [bx, by]: readonly [number, number],
): number {
  // Equirectangular, with longitude scaled by the latitude — accurate to a fraction of a
  // percent over the tens of kilometres a tactical graphic spans, which is far inside
  // what a "will this collapse" test needs.
  const midLat = ((ay + by) / 2) * (Math.PI / 180);
  const dx = (bx - ax) * Math.cos(midLat) * METRES_PER_DEGREE;
  const dy = (by - ay) * METRES_PER_DEGREE;
  return Math.hypot(dx, dy);
}

/**
 * The measurement, or null when the graphic is not an axis or has too few points.
 *
 * `ruleName` is passed in rather than looked up because this module deliberately knows
 * nothing about the catalog — it renders what it is given.
 */
export function axisWidthCheck(
  ruleName: string,
  points: readonly (readonly [number, number])[],
): AxisWidthCheck | null {
  if (!ruleName.startsWith("AXIS") || points.length < 3) {
    return null;
  }
  const tip = points[0]!;
  const next = points[1]!;
  const control = points[points.length - 1]!;

  const firstLegMetres = distanceMetres(tip, next);
  // Perpendicular distance from the control point to the *line through* tip and next —
  // the same quantity `PointRelativeToLine` gives the renderer.
  const midLat = (tip[1] * Math.PI) / 180;
  const scale = Math.cos(midLat) * METRES_PER_DEGREE;
  const ax = 0;
  const ay = 0;
  const bx = (next[0] - tip[0]) * scale;
  const by = (next[1] - tip[1]) * METRES_PER_DEGREE;
  const cx = (control[0] - tip[0]) * scale;
  const cy = (control[1] - tip[1]) * METRES_PER_DEGREE;
  const legLength = Math.hypot(bx - ax, by - ay);
  const halfWidthMetres =
    legLength === 0 ? 0 : Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / legLength;

  return {
    halfWidthMetres,
    firstLegMetres,
    collapses: halfWidthMetres >= firstLegMetres,
  };
}

export function resetGraphicCache(): void {
  cache.clear();
}

export function graphicCacheSize(): number {
  return cache.size;
}
