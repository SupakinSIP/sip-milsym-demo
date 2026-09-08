import {
  area,
  arrow,
  axisCorridor,
  flot,
  labelledLine,
  obstacleX,
  teeth,
  type Drawn,
  type Pt,
} from "./geometry.js";

/**
 * The sketch palette: which graphics this project draws itself, and how.
 *
 * Grouped the way an operator reaches for them rather than by symbol set — offensive,
 * defensive, obstacles, coordination — which is also how map.army groups its own palette.
 * That is not imitation for its own sake: "Offensive Lines" is the question being asked at
 * the moment of drawing, and "Control Measure, symbol set 25" is the answer to a different
 * one.
 *
 * ### The set is small on purpose
 *
 * Nine graphics, each one a shape this module can draw **correctly along the clicked
 * path**. The conformant renderer offers 415, and the honest reason not to reimplement
 * them here is the one `sip-map-army` wrote down: an approximated glyph is "recognisable
 * and wrong", which is worse on a map somebody else reads than not offering it. So every
 * row here is a shape whose construction is unambiguous — a line, an area, an arrow, or an
 * ornament repeated along a path — and anything needing the standard's own artwork stays
 * on the conformant path where it belongs.
 */

export type SketchGroup =
  | "Offensive"
  | "Defensive"
  | "Obstacles"
  | "Coordination";

export interface SketchKind {
  id: string;
  label: string;
  group: SketchGroup;
  /** The 2525D entity this stands in for, so the two paths can be compared. */
  standardEntity: string;
  minPoints: number;
  /** Closed shapes take their last point back to the first. */
  closed: boolean;
  colour: string;
  width: number;
  /** What the operator types, lettered on the graphic. */
  lettered: boolean;
  draw: (points: readonly Pt[], label: string) => Drawn;
}

/**
 * Maroon rather than black, and the same for every offensive graphic.
 *
 * A sketch is **not** a conformant symbol, and it must not be mistaken for one at a
 * glance. The conformant path draws in the affiliation's own colours — black frames,
 * green obstacles, the standard's palette — so the sketches use one colour that is
 * plainly outside it. It is the cheapest possible honesty about which half of the demo
 * drew what.
 */
const SKETCH_COLOUR = "#7c2d5c";
const OBSTACLE_COLOUR = "#1f7a3f";
const COORDINATION_COLOUR = "#1f4f9c";

export const SKETCH_KINDS: readonly SketchKind[] = [
  {
    id: "main-attack",
    label: "Main attack",
    group: "Offensive",
    standardEntity: "25140602 Direction of Attack / Friendly Main Attack",
    minPoints: 2,
    closed: false,
    colour: SKETCH_COLOUR,
    width: 3,
    lettered: false,
    draw: (points) => arrow(points, { double: true, head: 22, headHalf: 11 }),
  },
  {
    id: "supporting-attack",
    label: "Supporting attack",
    group: "Offensive",
    standardEntity: "25140603 Direction of Attack / Friendly Supporting Attack",
    minPoints: 2,
    closed: false,
    colour: SKETCH_COLOUR,
    width: 3,
    lettered: false,
    draw: (points) => arrow(points, { head: 20, headHalf: 9 }),
  },
  {
    id: "axis-of-advance",
    label: "Axis of advance",
    group: "Offensive",
    standardEntity: "25151403 Axis of Advance / Main Attack",
    minPoints: 2,
    closed: false,
    colour: SKETCH_COLOUR,
    width: 3,
    lettered: false,
    // The one the conformant path needs four points and a width point for. Here the
    // corridor is a constant screen width along whatever was clicked.
    draw: (points) => axisCorridor(points, { half: 16 }),
  },
  {
    id: "flot",
    label: "Forward line of troops",
    group: "Defensive",
    standardEntity: "25140500 Forward Line of Own Troops",
    minPoints: 2,
    closed: false,
    colour: COORDINATION_COLOUR,
    width: 3,
    lettered: false,
    draw: (points) => flot(points),
  },
  {
    id: "fortified-line",
    label: "Fortified line",
    group: "Defensive",
    standardEntity: "25290900 Fortified Line",
    minPoints: 2,
    closed: false,
    colour: OBSTACLE_COLOUR,
    width: 2.5,
    lettered: false,
    draw: (points) => teeth(points),
  },
  {
    id: "wire-obstacle",
    label: "Wire obstacle",
    group: "Obstacles",
    standardEntity: "25290100 Obstacles / Wire",
    minPoints: 2,
    closed: false,
    colour: OBSTACLE_COLOUR,
    width: 3,
    lettered: false,
    draw: (points) => obstacleX(points),
  },
  {
    id: "minefield-area",
    label: "Minefield (area)",
    group: "Obstacles",
    standardEntity: "25270000 Obstacle Areas / Minefields",
    minPoints: 3,
    closed: true,
    colour: OBSTACLE_COLOUR,
    width: 2.5,
    lettered: true,
    draw: (points, label) => area(points, label),
  },
  {
    id: "phase-line",
    label: "Phase line",
    group: "Coordination",
    standardEntity: "25140300 Phase Line",
    minPoints: 2,
    closed: false,
    colour: COORDINATION_COLOUR,
    width: 2.5,
    lettered: true,
    draw: (points, label) => labelledLine(points, label || "PL"),
  },
  {
    id: "objective",
    label: "Objective",
    group: "Coordination",
    standardEntity: "25151700 Objective",
    minPoints: 3,
    closed: true,
    colour: COORDINATION_COLOUR,
    width: 2.5,
    lettered: true,
    draw: (points, label) => area(points, label ? `OBJ ${label}` : "OBJ"),
  },
];

export function sketchKindOf(id: string): SketchKind | null {
  return SKETCH_KINDS.find((kind) => kind.id === id) ?? null;
}
