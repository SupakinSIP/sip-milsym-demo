/**
 * Tactical graphics drawn **by this project**, in screen space.
 *
 * ### Why this exists beside a conformant renderer
 *
 * `renderGraphic` hands vertices to mil-sym-ts and gets the standard's own geometry back.
 * That is the right thing and it is what a plan other people read should be drawn with.
 * But its inputs are the standard's **anchor point rules**, and for 67 of them the clicks
 * are not the shape: an axis of advance wants its arrowhead first and a width point last,
 * a corridor wants a distance modifier, a rectangle wants three points and an azimuth. An
 * operator who clicks the line they can see gets something else, and that is not a bug in
 * the renderer — it is the standard's input convention meeting a mouse.
 *
 * map.army solves it with a proprietary engine (MSS, by gs-soft AG) that owns both the
 * geometry and the gesture. There is no code to borrow there. So this module is the other
 * way to get that behaviour: **click the path you can see, and this draws along it.**
 *
 * ### What it costs, said plainly
 *
 * These are not conformant symbols. They are recognisable approximations, and
 * `sip-map-army` wrote the warning about exactly this in `packages/symbols/src/graphics.ts`
 * — that approximating a glyph "would put a symbol on a map other people read that is
 * recognisable and wrong". That warning applies to this file. It is worth having anyway,
 * for two reasons: it is the honest way to show what the interaction *should* feel like,
 * and it is the only way to compare the two side by side in one application.
 *
 * The demo keeps them apart and labelled — `renderGraphic` is "standard", this is
 * "sketch" — and never mixes them in one shape.
 *
 * ### Screen space, and that is the whole trick
 *
 * Every function here takes and returns **pixels**, and the overlay reprojects the
 * graphic's coordinates on every frame. So an arrowhead is 18px whatever the zoom, the Xs
 * of an obstacle line are 22px apart at every scale, and nothing has to be re-derived
 * from a map scale — which is the problem that made the conformant path draw decorated
 * lines at the wrong size until the camera scale was plumbed through.
 */

export interface Pt {
  x: number;
  y: number;
}

/* ----------------------------------------------------------------- vector helpers */

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const len = (a: Pt): number => Math.hypot(a.x, a.y);

/** A unit vector along `a`, or `{1,0}` when `a` has no length to speak of. */
function unit(a: Pt): Pt {
  const l = len(a);
  return l < 1e-9 ? { x: 1, y: 0 } : { x: a.x / l, y: a.y / l };
}

/**
 * Rotated a quarter turn.
 *
 * Screen coordinates have y growing **downward**, so this is the side that *appears* to
 * the right of the direction of travel: a path heading east gets a positive offset below
 * it. Worth stating rather than leaving to be re-derived — a sign error here puts every
 * tooth of a fortified line on the wrong side of the ditch, which is a real distinction
 * in the standard.
 */
const normal = (a: Pt): Pt => ({ x: -a.y, y: a.x });

const path = (points: readonly Pt[]): string =>
  points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

/* ----------------------------------------------------------------- walking a polyline */

/** Total length of a polyline, in pixels. */
export function polylineLength(points: readonly Pt[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += len(sub(points[i]!, points[i - 1]!));
  }
  return total;
}

/**
 * The point at `distance` along a polyline, and the direction there.
 *
 * Returns null past the end rather than clamping: every caller here is stepping along and
 * wants to stop, and a clamped result would pile every remaining ornament on the last
 * vertex.
 */
export function alongPolyline(
  points: readonly Pt[],
  distance: number,
): { at: Pt; dir: Pt } | null {
  let remaining = distance;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const segment = sub(b, a);
    const segmentLength = len(segment);
    if (segmentLength < 1e-9) {
      continue;
    }
    if (remaining <= segmentLength) {
      const dir = unit(segment);
      return { at: add(a, mul(dir, remaining)), dir };
    }
    remaining -= segmentLength;
  }
  return null;
}

/**
 * A polyline shortened from its far end by `trim` pixels.
 *
 * Used so a shaft stops where its arrowhead begins instead of running through it, which
 * is visible as a dark spine down the middle of a filled head.
 */
export function trimEnd(points: readonly Pt[], trim: number): Pt[] {
  const total = polylineLength(points);
  if (trim <= 0 || total <= trim) {
    return [...points];
  }
  const keep = total - trim;
  const out: Pt[] = [points[0]!];
  let travelled = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const segment = sub(b, a);
    const segmentLength = len(segment);
    if (travelled + segmentLength >= keep) {
      out.push(add(a, mul(unit(segment), keep - travelled)));
      return out;
    }
    travelled += segmentLength;
    out.push(b);
  }
  return out;
}

/**
 * A polyline offset sideways by `offset` pixels, joined at the angle bisector.
 *
 * The bisector rather than a proper miter/round join library: a tactical corridor's
 * corners are shallow, and the difference is sub-pixel until the turn is sharper than
 * about 60°. `Math.max(scale, 0.4)` is the guard that keeps a hairpin from throwing the
 * offset vertex to infinity — it lets the corner cut instead, which reads as a chamfer
 * rather than a spike.
 */
export function offsetPolyline(points: readonly Pt[], offset: number): Pt[] {
  if (points.length < 2) {
    return [...points];
  }
  const out: Pt[] = [];
  for (let i = 0; i < points.length; i++) {
    const previous = points[i - 1];
    const next = points[i + 1];
    let direction: Pt;
    if (!previous) {
      direction = unit(sub(next!, points[i]!));
    } else if (!next) {
      direction = unit(sub(points[i]!, previous));
    } else {
      const before = unit(sub(points[i]!, previous));
      const after = unit(sub(next, points[i]!));
      direction = unit(add(before, after));
      const cosHalf = Math.sqrt(
        Math.max(0, (1 + (before.x * after.x + before.y * after.y)) / 2),
      );
      out.push(
        add(points[i]!, mul(normal(direction), offset / Math.max(cosHalf, 0.4))),
      );
      continue;
    }
    out.push(add(points[i]!, mul(normal(direction), offset)));
  }
  return out;
}

/* ----------------------------------------------------------------- the graphics */

export interface Drawn {
  /** SVG path data for strokes. */
  strokes: { d: string; dash?: string; width?: number }[];
  /** SVG path data for filled shapes — arrowheads. */
  fills: { d: string }[];
  /** Where to letter, with the angle to letter at. */
  labels: { at: Pt; text: string; angle: number }[];
}

const EMPTY: Drawn = { strokes: [], fills: [], labels: [] };

export interface ArrowOptions {
  /** Pixels. The barb length of the arrowhead. */
  head?: number;
  /** Pixels. Half the arrowhead's width at its base. */
  headHalf?: number;
  /** Dashed shaft, for a supporting attack. */
  dashed?: boolean;
  /** A second, parallel shaft — the standard's decisive-attack double line. */
  double?: boolean;
  /** Pixels. Half the separation of the double shaft. */
  doubleHalf?: number;
}

/**
 * An arrow along the clicked path, head at the **last** point.
 *
 * The last point, because that is where the operator stopped, and an arrow whose head
 * lands anywhere else is the thing this module exists to avoid.
 */
export function arrow(points: readonly Pt[], options: ArrowOptions = {}): Drawn {
  if (points.length < 2) {
    return EMPTY;
  }
  const head = options.head ?? 18;
  const headHalf = options.headHalf ?? 9;
  const tip = points[points.length - 1]!;
  const direction = unit(sub(tip, points[points.length - 2]!));
  const back = add(tip, mul(direction, -head));
  const side = normal(direction);

  const shaft = trimEnd(points, head * 0.75);
  const strokes: Drawn["strokes"] = [];
  if (options.double) {
    const half = options.doubleHalf ?? 4;
    strokes.push({ d: path(offsetPolyline(shaft, half)), dash: options.dashed ? "10 6" : undefined });
    strokes.push({ d: path(offsetPolyline(shaft, -half)), dash: options.dashed ? "10 6" : undefined });
  } else {
    strokes.push({ d: path(shaft), dash: options.dashed ? "10 6" : undefined });
  }

  return {
    strokes,
    fills: [
      {
        d: `${path([
          tip,
          add(back, mul(side, headHalf)),
          add(back, mul(side, -headHalf)),
        ])} Z`,
      },
    ],
    labels: [],
  };
}

/**
 * A corridor of constant screen width with an arrowhead — the axis of advance shape.
 *
 * Two offset edges rather than a filled band, because the standard's axis is an outline
 * and a filled one would hide the ground it is drawn over.
 */
export function axisCorridor(
  points: readonly Pt[],
  options: { half?: number; head?: number } = {},
): Drawn {
  if (points.length < 2) {
    return EMPTY;
  }
  const half = options.half ?? 14;
  const head = options.head ?? half * 1.8;
  const tip = points[points.length - 1]!;
  const direction = unit(sub(tip, points[points.length - 2]!));
  const side = normal(direction);
  const shoulder = add(tip, mul(direction, -head));

  // The two edges stop at the arrowhead's shoulders and the head closes them.
  const spine = trimEnd(points, head);
  const left = offsetPolyline(spine, half);
  const right = offsetPolyline(spine, -half);

  return {
    strokes: [
      {
        d: `${path(left)} L${(add(shoulder, mul(side, half * 1.9)).x).toFixed(1)},${(
          add(shoulder, mul(side, half * 1.9)).y
        ).toFixed(1)} L${tip.x.toFixed(1)},${tip.y.toFixed(1)} L${(
          add(shoulder, mul(side, -half * 1.9)).x
        ).toFixed(1)},${(add(shoulder, mul(side, -half * 1.9)).y).toFixed(1)} ${path(
          [...right].reverse(),
        ).slice(1)}`,
      },
    ],
    fills: [],
    labels: [],
  };
}

/**
 * An ornament repeated along the path at a fixed pixel step.
 *
 * The generator is handed the point and the local direction, so an X or a tooth sits
 * square to the line it is on. `step` is pixels, so the spacing is the same at every
 * zoom — the property the conformant path had to have a map scale plumbed through it to
 * achieve.
 */
function repeatAlong(
  points: readonly Pt[],
  step: number,
  make: (at: Pt, dir: Pt) => { strokes?: string[]; fills?: string[] },
): Drawn {
  const total = polylineLength(points);
  if (total < 1 || step < 1) {
    return EMPTY;
  }
  const strokes: Drawn["strokes"] = [];
  const fills: Drawn["fills"] = [];
  // Centred: the first ornament sits half a step in, so a short line gets one in the
  // middle rather than one jammed against its start.
  for (let d = step / 2; d <= total; d += step) {
    const spot = alongPolyline(points, d);
    if (!spot) {
      break;
    }
    const made = make(spot.at, spot.dir);
    for (const stroke of made.strokes ?? []) {
      strokes.push({ d: stroke });
    }
    for (const fill of made.fills ?? []) {
      fills.push({ d: fill });
    }
  }
  return { strokes, fills, labels: [] };
}

/** A wire obstacle: Xs along the line. */
export function obstacleX(
  points: readonly Pt[],
  options: { step?: number; size?: number } = {},
): Drawn {
  const step = options.step ?? 26;
  const size = options.size ?? 9;
  return repeatAlong(points, step, (at, dir) => {
    const side = normal(dir);
    const a = add(at, add(mul(dir, size), mul(side, size)));
    const b = add(at, add(mul(dir, -size), mul(side, -size)));
    const c = add(at, add(mul(dir, size), mul(side, -size)));
    const e = add(at, add(mul(dir, -size), mul(side, size)));
    return { strokes: [path([a, b]), path([c, e])] };
  });
}

/** An anti-tank ditch or a fortified line: teeth on one side. */
export function teeth(
  points: readonly Pt[],
  options: { step?: number; size?: number } = {},
): Drawn {
  const step = options.step ?? 18;
  const size = options.size ?? 9;
  const spine = repeatAlong(points, step, (at, dir) => {
    const side = normal(dir);
    const tipAt = add(at, mul(side, size));
    return {
      fills: [
        `${path([
          add(at, mul(dir, -size * 0.6)),
          tipAt,
          add(at, mul(dir, size * 0.6)),
        ])} Z`,
      ],
    };
  });
  return { ...spine, strokes: [{ d: path(points) }, ...spine.strokes] };
}

/** A forward line of troops: half-circles bulging toward the enemy. */
export function flot(
  points: readonly Pt[],
  options: { step?: number; radius?: number } = {},
): Drawn {
  const radius = options.radius ?? 11;
  const step = options.step ?? radius * 2;
  const total = polylineLength(points);
  const strokes: Drawn["strokes"] = [];
  for (let d = 0; d + step <= total + 1; d += step) {
    const from = alongPolyline(points, d);
    const to = alongPolyline(points, d + step);
    if (!from || !to) {
      break;
    }
    // `sweep-flag` 1 puts every bulge on the same side of the line, which is what makes
    // a FLOT readable as facing something.
    strokes.push({
      d: `M${from.at.x.toFixed(1)},${from.at.y.toFixed(1)} A${radius},${radius} 0 0 1 ${to.at.x.toFixed(
        1,
      )},${to.at.y.toFixed(1)}`,
    });
  }
  return { strokes, fills: [], labels: [] };
}

/** A plain line, lettered at both ends — a phase line, an LD, an FSCL. */
export function labelledLine(points: readonly Pt[], text: string): Drawn {
  if (points.length < 2) {
    return EMPTY;
  }
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const startDir = unit(sub(points[1]!, first));
  const endDir = unit(sub(last, points[points.length - 2]!));
  const angle = (d: Pt): number => (Math.atan2(d.y, d.x) * 180) / Math.PI;
  return {
    strokes: [{ d: path(points) }],
    fills: [],
    labels: text
      ? [
          { at: add(first, mul(startDir, -14)), text, angle: angle(startDir) },
          { at: add(last, mul(endDir, 14)), text, angle: angle(endDir) },
        ]
      : [],
  };
}

/** A closed area, lettered in the middle. */
export function area(points: readonly Pt[], text: string): Drawn {
  if (points.length < 3) {
    return EMPTY;
  }
  const centre = points.reduce((acc, p) => add(acc, p), { x: 0, y: 0 });
  return {
    strokes: [{ d: `${path(points)} Z` }],
    fills: [],
    labels: text
      ? [
          {
            at: mul(centre, 1 / points.length),
            text,
            angle: 0,
          },
        ]
      : [],
  };
}
