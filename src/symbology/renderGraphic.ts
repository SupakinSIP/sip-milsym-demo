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
 * Point N: offset from the tip, perpendicular to the first leg.
 *
 * Offset from the **tip** and not from a point back along the axis, because that is the
 * geometry the sample laydown and the stray measurement were taken against — the drawn
 * centre line hugs the clicked path to within a half width when point N sits square off
 * point 1. The perpendicular is taken in local metres with longitude scaled by the
 * latitude, then converted back, so the offset is the same distance on the ground at any
 * longitude rather than the same number of degrees.
 */
export function axisWidthPoint(
  centreLine: readonly (readonly [number, number])[],
): [number, number] {
  const tip = centreLine[0]!;
  const next = centreLine[1] ?? centreLine[0]!;
  const halfWidth = axisHalfWidthMetres(centreLine);
  const scale = Math.cos((tip[1] * Math.PI) / 180) * METRES_PER_DEGREE;
  const dx = (next[0] - tip[0]) * scale;
  const dy = (next[1] - tip[1]) * METRES_PER_DEGREE;
  const length = Math.hypot(dx, dy);
  if (length === 0 || halfWidth === 0) {
    return [tip[0], tip[1]];
  }
  // Left of the tip→rear direction. Which side is arbitrary — the renderer takes the
  // perpendicular *distance* — so it is fixed rather than chosen, and the handle can be
  // dragged to the other side without changing the drawn shape.
  const px = -dy / length;
  const py = dx / length;
  return [
    tip[0] + (px * halfWidth) / scale,
    tip[1] + (py * halfWidth) / METRES_PER_DEGREE,
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
