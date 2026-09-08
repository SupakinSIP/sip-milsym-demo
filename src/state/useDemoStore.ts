import { create } from "zustand";
import {
  DEFAULT_FIELDS,
  DEFAULT_STANDARD_ID,
  basicIdOf,
  composeSidc,
  fieldsOf,
  standardOf,
  type Amplifiers,
  type SidcFields,
} from "../symbology/index.js";
import { orderPointsForRule } from "../symbology/renderGraphic.js";
import { sketchKindOf } from "../sketch/kinds.js";

/**
 * Everything the demo knows, held in memory for as long as the tab is open.
 *
 * `sip-map-army`'s `useMilxStore` is the model, minus every part of it that talks to
 * something: no autosave, no revision recovery, no merge-from-cloud, no presence, no
 * layers, no uploads. What is left is what the drawing system actually needs, and it is
 * worth noticing how little that is — a list of placed marks, which one is selected,
 * and the draft the next one will be placed with.
 *
 * **A reload loses the marks, on purpose.** Persisting to `localStorage` would be four
 * lines and would make the demo dishonest about where the boundary is: the reference
 * application keeps a document on a server precisely because a plan that lives in one
 * browser tab is not a plan anyone else can read. A demo that quietly restored its own
 * state would be showing a document store that is not there.
 */

/** A symbol standing on a coordinate. */
export interface PlacedSymbol {
  id: string;
  /** The 20-digit code, already composed — what the renderer is handed. */
  sidc: string;
  lng: number;
  lat: number;
  amplifiers: Amplifiers;
  /** An operator-chosen frame fill, or null for the affiliation's own colour. */
  fillColor: string | null;
}

/**
 * A tactical graphic standing on several coordinates.
 *
 * Held apart from `PlacedSymbol` because it is a different kind of thing, not a variant
 * of one: a mark has a position and a glyph, a graphic has **vertices** and its picture
 * is computed from them. Merging the two would mean a `points` array that is length one
 * for most rows and a `sidc` whose geometry decides which half of the record is real —
 * and every consumer branching on it anyway.
 */
export interface PlacedGraphic {
  id: string;
  sidc: string;
  /** The entity's name, kept for the list and the labels. */
  name: string;
  /** `[lng, lat]`, in the order they were clicked. */
  points: [number, number][];
  amplifiers: Amplifiers;
}

/**
 * A graphic being drawn: how many points it still needs, and what it is.
 *
 * Separate from the finished list so a half-drawn shape is never in the document. The
 * renderer refuses a geometry with too few points, so the tool has to know
 * `minPoints`/`maxPoints` before the first click — which is why they are on the catalog
 * entry.
 */
export interface DrawingGraphic {
  basicId: string;
  sidc: string;
  name: string;
  geometry: string;
  minPoints: number;
  maxPoints: number;
  /** The standard's anchor point rule, so the hint bar can say what each click means. */
  drawRuleName: string;
  points: [number, number][];
}

/**
 * What the next mark will be placed with.
 *
 * Held separately from the marks so that setting up "friendly, planned, battalion HQ"
 * once and then clicking six places on the map puts down six of them — which is what an
 * operator does, and what a draft-per-mark model gets wrong.
 */
export interface Draft {
  standardId: string;
  /** The catalog entry's base id — symbol set and entity, no fields. */
  basicId: string;
  fields: SidcFields;
  amplifiers: Amplifiers;
  fillColor: string | null;
}

export interface DemoState {
  draft: Draft;
  symbols: PlacedSymbol[];
  selectedId: string | null;
  /** Whether a click on the map places a mark or just clears the selection. */
  placing: boolean;
  /** Draw the renderer's own contrasting outline around every glyph. */
  outline: boolean;
  /** Show the anchor point and image bounds of every mark, over the glyph. */
  showAnchors: boolean;

  setStandard: (standardId: string) => void;
  setBasicId: (basicId: string) => void;
  setField: <K extends keyof SidcFields>(key: K, value: SidcFields[K]) => void;
  setDraftAmplifier: (key: string, value: string) => void;
  setDraftFillColor: (fillColor: string | null) => void;
  setPlacing: (placing: boolean) => void;
  setOutline: (outline: boolean) => void;
  setShowAnchors: (showAnchors: boolean) => void;

  place: (lng: number, lat: number) => void;
  select: (id: string | null) => void;
  moveSymbol: (id: string, lng: number, lat: number) => void;
  updateSelectedField: <K extends keyof SidcFields>(
    key: K,
    value: SidcFields[K],
  ) => void;
  updateSelectedAmplifier: (key: string, value: string) => void;
  updateSelectedFillColor: (fillColor: string | null) => void;
  deleteSelected: () => void;
  clearAll: () => void;
  seedSample: () => void;

  /* ------------------------------------------------- tactical graphics */

  graphics: PlacedGraphic[];
  drawing: DrawingGraphic | null;
  selectedGraphicId: string | null;
  /**
   * The map scale the multipoint renderer is being given, as metres of ground per metre
   * of map.
   *
   * In the store rather than read from the map where it is needed, because two places
   * need the *same* value: the overlay that draws the graphic and the panel that reports
   * how many features it came back as. Fed by `MapView` from the camera — see
   * `scaleForCamera` for why a fixed value draws decorated lines at the wrong size.
   */
  mapScale: number;

  startDrawing: (draft: Omit<DrawingGraphic, "points">) => void;
  addDrawingPoint: (lng: number, lat: number) => void;
  /** Commit the shape if it has enough points; otherwise leave it alone. */
  finishDrawing: () => void;
  cancelDrawing: () => void;
  setMapScale: (mapScale: number) => void;
  selectGraphic: (id: string | null) => void;
  updateGraphicAmplifier: (id: string, key: string, value: string) => void;
  deleteGraphic: (id: string) => void;

  /* ------------------------------------------------- sketches */

  sketches: PlacedSketch[];
  sketching: { kindId: string; label: string; points: [number, number][] } | null;
  selectedSketchId: string | null;

  startSketch: (kindId: string) => void;
  addSketchPoint: (lng: number, lat: number) => void;
  finishSketch: () => void;
  cancelSketch: () => void;
  selectSketch: (id: string | null) => void;
  setSketchLabel: (id: string, label: string) => void;
  deleteSketch: (id: string) => void;

  /* ------------------------------------------------- editing a placed shape */

  /**
   * What a click on the map does to the **selected** shape.
   *
   * map.army's model, from its own Point Editor documentation: a placed multipoint
   * graphic stays editable, and three modes decide what the next click means — drag a
   * handle, insert a point, or delete the one clicked. That persistent editability is the
   * part of the mechanism this demo was missing, not the geometry: a shape that can only
   * be deleted and redrawn is a shape nobody adjusts.
   *
   * "move" is the resting state and does not consume map clicks at all — the handles are
   * draggable markers, so dragging is always available.
   */
  editMode: "move" | "add" | "remove";
  setEditMode: (editMode: "move" | "add" | "remove") => void;

  /** Move one vertex of whichever shape is selected. */
  moveVertex: (index: number, lng: number, lat: number) => void;
  /**
   * Insert a vertex into the selected shape, splitting the segment nearest the click.
   *
   * Nearest **segment**, not appended to the end: inserting at the end of a closed area
   * would put the new point across the shape from where it was clicked, and inserting at
   * the end of a line would make an add-point tool into an extend-line tool. The segment
   * is chosen by perpendicular distance in degrees, which is close enough at the scale a
   * hand-clicked graphic spans.
   */
  insertVertex: (lng: number, lat: number) => void;
  /** Remove one vertex, unless the shape needs it to stay drawable. */
  removeVertex: (index: number) => void;
}

/**
 * A graphic this project drew itself, rather than the standard's renderer.
 *
 * Kept in its own list beside `graphics`, never merged with it, because the two are
 * different claims about the same map: a `PlacedGraphic` is MIL-STD-2525 geometry from
 * mil-sym-ts, and a `PlacedSketch` is an approximation drawn by `src/sketch`. Merging
 * them would make "is this symbol conformant?" a field to read instead of a list to be in.
 */
export interface PlacedSketch {
  id: string;
  /** Which row of `SKETCH_KINDS`. */
  kindId: string;
  /** `[lng, lat]`, exactly as clicked — the path the operator can see. */
  points: [number, number][];
  label: string;
}

/**
 * A small laydown, for the demo to open onto rather than an empty map.
 *
 * Chosen to cover the cases that are interesting *about the drawing*, not to be a
 * plausible plan: a staffed headquarters with lettering (the anchor case), a plain
 * infantry company (the ordinary case), a hostile equipment symbol (the other frame
 * shape and the ENY amplifier), a planned neutral installation (status as a dashed
 * frame), and a tracked SP howitzer (digits 9-10 carrying mobility rather than an
 * echelon). One click and every claim in the README has something on screen behind it.
 */
const SAMPLE: readonly {
  basicId: string;
  lng: number;
  lat: number;
  fields: Partial<SidcFields>;
  amplifiers: Amplifiers;
}[] = [
  {
    basicId: "10121100",
    lng: 100.49,
    lat: 13.79,
    fields: { hqtfd: 2, amplifierDescriptor: 16 },
    amplifiers: {
      T_UNIQUE_DESIGNATION_1: "1-27 IN",
      M_HIGHER_FORMATION: "2 BCT",
      AW_HEADQUARTERS_ELEMENT: "MAIN",
    },
  },
  {
    // Infantry, armored/mechanized/tracked — a company under the battalion above.
    basicId: "10121102",
    lng: 100.63,
    lat: 13.71,
    fields: { amplifierDescriptor: 15 },
    amplifiers: { T_UNIQUE_DESIGNATION_1: "A/1-27" },
  },
  {
    basicId: "10130300",
    lng: 100.42,
    lat: 13.66,
    fields: { amplifierDescriptor: 15 },
    amplifiers: { T_UNIQUE_DESIGNATION_1: "B/3-16 FA" },
  },
  {
    // Land *equipment*, hostile: the other frame shape, and the two amplifiers that
    // belong to equipment rather than to units — ENY and a quantity.
    basicId: "15131200",
    lng: 100.74,
    lat: 13.85,
    fields: { affiliation: 6, amplifierDescriptor: 33 },
    amplifiers: { N_HOSTILE: "ENY", C_QUANTITY: "4" },
  },
  {
    // Neutral and *planned*, so the frame is drawn dashed — status is a frame decision
    // and this is the one mark that shows it.
    basicId: "10120200",
    lng: 100.55,
    lat: 13.59,
    fields: { affiliation: 4, status: 1 },
    amplifiers: { T_UNIQUE_DESIGNATION_1: "FARP 3" },
  },
];

/** Land unit / infantry — a symbol every reader of a 2525 map recognises. */
const STARTING_BASIC_ID = "10121100";

/**
 * Tactical graphics for the sample laydown.
 *
 * Chosen to cover what is interesting about the *multipoint* path, the way the marks
 * cover the point path: a two-point line (Boundary), a line whose picture is nothing like
 * its control points (Forward Edge of the Battle Area, drawn with half-circles), an area
 * with a fill and a label (Objective), an area whose geometry is computed from three
 * points (Obstacle Belt), and — the one that matters most — an Air Corridor, which the
 * renderer **refuses to draw** until Field AM gives it a width. One click and the panel's
 * refusal state has something behind it too.
 */
const SAMPLE_GRAPHICS: readonly {
  basicId: string;
  name: string;
  /**
   * In **clicked** order, exactly as an operator would put them down.
   *
   * Not the renderer order: the sample goes through `orderPointsForRule` on the way in,
   * the same as a shape drawn on the map, so the data here has one convention and the
   * translation has one place. A sample written in renderer order would be the only
   * points in the project that skipped it.
   */
  points: readonly (readonly [number, number])[];
  /** The anchor point rule, so the reorder knows whether this is an axis graphic. */
  drawRuleName: string;
  fields: Partial<SidcFields>;
  amplifiers: Amplifiers;
}[] = [
  {
    basicId: "25110100",
    name: "Boundary",
    points: [
      [100.28, 13.95],
      [100.62, 13.93],
      [100.86, 13.98],
    ],
    drawRuleName: "LINE7",
    fields: {},
    amplifiers: { T_UNIQUE_DESIGNATION_1: "2 BCT", T2_UNIQUE_DESIGNATION_3: "3 BCT" },
  },
  {
    basicId: "25140400",
    name: "Forward Edge of the Battle Area",
    points: [
      [100.3, 13.66],
      [100.55, 13.7],
      [100.82, 13.64],
    ],
    drawRuleName: "LINE2",
    fields: {},
    amplifiers: {},
  },
  {
    basicId: "25151700",
    name: "Objective",
    points: [
      [100.66, 13.82],
      [100.78, 13.86],
      [100.8, 13.75],
      [100.68, 13.73],
    ],
    drawRuleName: "AREA1",
    fields: {},
    // The renderer letters the word "OBJ" itself, so the designation is just the name.
    amplifiers: { T_UNIQUE_DESIGNATION_1: "FOX" },
  },
  {
    basicId: "25270100",
    name: "Obstacle Belt",
    points: [
      [100.34, 13.5],
      [100.58, 13.53],
      [100.56, 13.44],
      [100.36, 13.42],
    ],
    drawRuleName: "AREA1",
    fields: {},
    amplifiers: { T_UNIQUE_DESIGNATION_1: "BELT A" },
  },
  {
    // Main Attack, and the point order is the whole reason it is in the sample.
    //
    // Rule AXIS2, and the order is not what a drawing tool naturally collects. Read out
    // of the library: point 1 is the **arrowhead tip**, points 2..N-1 run back along the
    // centre line to the rear, and point N is a **width control point** whose
    // perpendicular distance to the first leg is the half width. Collected as a
    // tail-to-tip path — the first thing this demo did — the arrow comes out backwards
    // with the last click eaten as a width.
    //
    // And the half width must stay under the length of the first leg, or
    // `clsUtility.FilterAXADPoints` throws the whole centre line away and extends a stub
    // along leg one instead. Here leg one is about 17 km and the half width about 1 km.
    basicId: "25151403",
    name: "Main Attack",
    // Clicked order: rear, mid, arrowhead, then the width point. `orderPointsForRule`
    // turns this into the tip-first order AXIS2 wants.
    points: [
      [100.36, 13.62],
      [100.54, 13.66],
      [100.7, 13.63],
      [100.7, 13.64],
    ],
    drawRuleName: "AXIS2",
    fields: {},
    amplifiers: {},
  },
  {
    // The **two-click arrow**, and the reason it is here beside the axis version above.
    //
    // The catalog holds two graphics that both read as a main attack, drawn under
    // different rules. `25151403` is Axis of Advance / Main Attack — rule AXIS2, an area
    // of advance with a width, four clicks. This one is Direction of Attack / Friendly
    // Main Attack (Decisive) — rule LINE1, **two clicks and an arrow**, and its geometry
    // is independent of the map scale.
    //
    // Picking by name alone gets whichever the search ranked first, which is why the
    // browser now prints the rule and the point count on every multipoint tile.
    basicId: "25140602",
    name: "Direction of Attack (Main, Decisive)",
    points: [
      [100.3, 13.52],
      [100.62, 13.56],
    ],
    drawRuleName: "LINE1",
    fields: {},
    amplifiers: {},
  },
  {
    // The refusal case, left deliberately without its width so the panel shows what the
    // renderer says and where to type the answer.
    basicId: "25170100",
    name: "Air Corridor",
    points: [
      [100.9, 13.5],
      [101.02, 13.62],
    ],
    drawRuleName: "CORRIDOR1",
    fields: {},
    amplifiers: { T_UNIQUE_DESIGNATION_1: "AC ONE" },
  },
];

/**
 * Sketches for the sample laydown, drawn beside their conformant counterparts.
 *
 * Deliberately over the same ground as the standard graphics above: the point of having
 * both in one laydown is that the difference is visible in one screenshot — the sketch
 * follows the clicked path with a constant-size ornament, the conformant one is the
 * standards artwork with the standards anchor rules.
 */
const SAMPLE_SKETCHES: readonly {
  kindId: string;
  label: string;
  points: readonly (readonly [number, number])[];
}[] = [
  {
    kindId: "main-attack",
    label: "",
    points: [
      [100.34, 13.44],
      [100.5, 13.47],
      [100.68, 13.44],
    ],
  },
  {
    kindId: "wire-obstacle",
    label: "",
    points: [
      [100.3, 13.9],
      [100.55, 13.87],
      [100.82, 13.91],
    ],
  },
  {
    kindId: "flot",
    label: "",
    points: [
      [100.3, 13.34],
      [100.56, 13.31],
      [100.8, 13.35],
    ],
  },
];

let nextId = 1;

/**
 * The draft's SIDC, composed on read rather than stored.
 *
 * A stored copy would be a second answer to "what is the draft's code", and the two
 * would part company the first time a field was set without it being recomputed. Same
 * argument as the memo key's: derive, or keep in step forever.
 */
export function draftSidc(draft: Draft): string {
  return composeSidc(draft.basicId, draft.fields);
}


/**
 * Whichever multipoint shape is selected, edited through one function.
 *
 * A sketch and a conformant graphic hold the same thing — an array of `[lng, lat]` — so
 * the vertex operations are written once and dispatch on which list holds the selection.
 * Keeping the lists separate is still right (one is conformant symbology and the other is
 * not), but the *editing* of a point array has nothing to do with that distinction.
 */
function editPoints(
  state: DemoState,
  change: (points: [number, number][]) => [number, number][],
): Partial<DemoState> {
  if (state.selectedSketchId) {
    return {
      sketches: state.sketches.map((sketch) =>
        sketch.id === state.selectedSketchId
          ? { ...sketch, points: change(sketch.points) }
          : sketch,
      ),
    };
  }
  if (state.selectedGraphicId) {
    return {
      graphics: state.graphics.map((graphic) =>
        graphic.id === state.selectedGraphicId
          ? { ...graphic, points: change(graphic.points) }
          : graphic,
      ),
    };
  }
  return {};
}

/**
 * How few points the selected shape can be reduced to and still draw.
 *
 * For a sketch it is the palette row's own minimum. For a conformant graphic it is two,
 * which is a floor rather than the real answer: the true minimum is the entity's
 * `minPointCount`, and that lives on the catalog entry rather than on the placed shape.
 * Understating it means the renderer may refuse a geometry the editor allowed — visible
 * as the refusal banner in the panel, which is the right place for it to surface and is
 * why understating is acceptable here.
 */
function minimumPointsFor(state: DemoState): number {
  if (state.selectedSketchId) {
    const sketch = state.sketches.find((s) => s.id === state.selectedSketchId);
    return sketchKindOf(sketch?.kindId ?? "")?.minPoints ?? 2;
  }
  return 2;
}

/**
 * The index of the segment whose line passes nearest the click.
 *
 * Returns the index of the segment's **first** point, so the caller inserts after it.
 * Distance is measured to the segment rather than to its infinite line — a click beyond
 * the end of a segment belongs to whichever end it is near, not to the segment that
 * happens to point at it.
 */
function nearestSegment(
  points: readonly (readonly [number, number])[],
  at: readonly [number, number],
): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i]!;
    const [bx, by] = points[i + 1]!;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((at[0] - ax) * dx + (at[1] - ay) * dy) / lengthSquared,
            ),
          );
    const distance = Math.hypot(at[0] - (ax + t * dx), at[1] - (ay + t * dy));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

export const useDemoStore = create<DemoState>((set, get) => ({
  draft: {
    standardId: DEFAULT_STANDARD_ID,
    basicId: STARTING_BASIC_ID,
    fields: { ...DEFAULT_FIELDS },
    amplifiers: {},
    fillColor: null,
  },
  symbols: [],
  selectedId: null,
  placing: true,
  outline: true,
  showAnchors: false,

  setStandard: (standardId) =>
    set((state) => ({
      draft: {
        ...state.draft,
        standardId,
        // The version is a field *of the SIDC*, so switching standards is not a
        // separate axis from the code — it is digits 1-2 of it. Anything already on
        // the map keeps the version it was placed under, which is what makes it
        // possible to see two standards drawing the same entity side by side.
        fields: {
          ...state.draft.fields,
          version: standardOf(standardId).version,
        },
      },
    })),

  setBasicId: (basicId) =>
    set((state) => ({ draft: { ...state.draft, basicId } })),

  setField: (key, value) =>
    set((state) => ({
      draft: { ...state.draft, fields: { ...state.draft.fields, [key]: value } },
    })),

  setDraftAmplifier: (key, value) =>
    set((state) => ({
      draft: {
        ...state.draft,
        amplifiers: { ...state.draft.amplifiers, [key]: value },
      },
    })),

  setDraftFillColor: (fillColor) =>
    set((state) => ({ draft: { ...state.draft, fillColor } })),

  setPlacing: (placing) => set({ placing }),
  setOutline: (outline) => set({ outline }),
  setShowAnchors: (showAnchors) => set({ showAnchors }),

  place: (lng, lat) => {
    const { draft } = get();
    const id = `mark-${nextId++}`;
    set((state) => ({
      symbols: [
        ...state.symbols,
        {
          id,
          sidc: draftSidc(draft),
          lng,
          lat,
          // Copied, not shared: the draft goes on being edited after the mark is
          // placed, and a shared bag would rewrite the lettering of every mark already
          // on the map.
          amplifiers: { ...draft.amplifiers },
          fillColor: draft.fillColor,
        },
      ],
      selectedId: id,
    }));
  },

  select: (id) => set({ selectedId: id }),

  moveSymbol: (id, lng, lat) =>
    set((state) => ({
      symbols: state.symbols.map((symbol) =>
        symbol.id === id ? { ...symbol, lng, lat } : symbol,
      ),
    })),

  updateSelectedField: (key, value) =>
    set((state) => ({
      symbols: state.symbols.map((symbol) => {
        if (symbol.id !== state.selectedId) {
          return symbol;
        }
        // The fields are read back out of the code, edited, and composed again — and
        // the base symbol is read back out of it too, because `composeSidc` takes the
        // eight-character lookup id and not a SIDC (its docblock says why). The mark
        // stores the SIDC rather than the fields because the SIDC is what the renderer
        // and the reconciler's key both want; the round trip is what keeps the panel
        // from needing a second copy of the state to edit against.
        const fields = { ...fieldsOf(symbol.sidc), [key]: value };
        return { ...symbol, sidc: composeSidc(basicIdOf(symbol.sidc), fields) };
      }),
    })),

  updateSelectedAmplifier: (key, value) =>
    set((state) => ({
      symbols: state.symbols.map((symbol) =>
        symbol.id === state.selectedId
          ? { ...symbol, amplifiers: { ...symbol.amplifiers, [key]: value } }
          : symbol,
      ),
    })),

  updateSelectedFillColor: (fillColor) =>
    set((state) => ({
      symbols: state.symbols.map((symbol) =>
        symbol.id === state.selectedId ? { ...symbol, fillColor } : symbol,
      ),
    })),

  deleteSelected: () =>
    set((state) => ({
      symbols: state.symbols.filter((symbol) => symbol.id !== state.selectedId),
      selectedId: null,
    })),

  clearAll: () =>
    set({
      symbols: [],
      selectedId: null,
      graphics: [],
      selectedGraphicId: null,
      drawing: null,
      sketches: [],
      selectedSketchId: null,
      sketching: null,
    }),

  /* ------------------------------------------------- tactical graphics */

  graphics: [],
  drawing: null,
  selectedGraphicId: null,
  // Roughly 1:2,200,000 — the opening view at zoom 8. Replaced by the real camera value
  // as soon as the map mounts.
  mapScale: 2_200_000,

  startDrawing: (draft) =>
    set({
      drawing: { ...draft, points: [] },
      // Starting a shape clears the mark selection: the properties panel shows one
      // subject at a time, and the shape being drawn is now it.
      selectedId: null,
      selectedGraphicId: null,
    }),

  addDrawingPoint: (lng, lat) =>
    set((state) => {
      const drawing = state.drawing;
      if (!drawing || drawing.points.length >= drawing.maxPoints) {
        return {};
      }
      const points: [number, number][] = [...drawing.points, [lng, lat]];
      // At the maximum the shape is finished by the click that filled it, rather than
      // waiting for a double-click that can no longer add anything. A circle takes one
      // point; asking for a second gesture there would be a tool arguing with itself.
      if (points.length >= drawing.maxPoints) {
        const id = `graphic-${nextId++}`;
        return {
          drawing: null,
          graphics: [
            ...state.graphics,
            {
              id,
              sidc: drawing.sidc,
              name: drawing.name,
              // Clicks in, the standard order out. See orderPointsForRule: an axis
              // graphic is clicked rear-to-arrowhead and stored tip-first.
              points: orderPointsForRule(drawing.drawRuleName, points).map(
                ([lng, lat]) => [lng, lat] as [number, number],
              ),
              amplifiers: {},
            },
          ],
          selectedGraphicId: id,
        };
      }
      return { drawing: { ...drawing, points } };
    }),

  finishDrawing: () =>
    set((state) => {
      const drawing = state.drawing;
      if (!drawing || drawing.points.length < drawing.minPoints) {
        // Deliberately a no-op rather than an error or a discard: the operator
        // double-clicked early, and throwing away the points they had drawn would be
        // the more expensive reading of that gesture.
        return {};
      }
      const id = `graphic-${nextId++}`;
      return {
        drawing: null,
        graphics: [
          ...state.graphics,
          {
            id,
            sidc: drawing.sidc,
            name: drawing.name,
            points: orderPointsForRule(drawing.drawRuleName, drawing.points).map(
              ([lng, lat]) => [lng, lat] as [number, number],
            ),
            amplifiers: {},
          },
        ],
        selectedGraphicId: id,
      };
    }),

  cancelDrawing: () => set({ drawing: null }),

  setMapScale: (mapScale) => set({ mapScale }),

  selectGraphic: (id) => set({ selectedGraphicId: id, selectedId: null }),

  updateGraphicAmplifier: (id, key, value) =>
    set((state) => ({
      graphics: state.graphics.map((graphic) =>
        graphic.id === id
          ? { ...graphic, amplifiers: { ...graphic.amplifiers, [key]: value } }
          : graphic,
      ),
    })),

  deleteGraphic: (id) =>
    set((state) => ({
      graphics: state.graphics.filter((graphic) => graphic.id !== id),
      selectedGraphicId:
        state.selectedGraphicId === id ? null : state.selectedGraphicId,
    })),

  /* ------------------------------------------------- sketches */

  sketches: [],
  sketching: null,
  selectedSketchId: null,

  startSketch: (kindId) =>
    set({
      sketching: { kindId, label: "", points: [] },
      // One subject at a time, and starting a sketch cancels a conformant shape in
      // progress: two drawing tools listening to the same click is a tool that guesses.
      drawing: null,
      selectedId: null,
      selectedGraphicId: null,
      selectedSketchId: null,
    }),

  addSketchPoint: (lng, lat) =>
    set((state) =>
      state.sketching
        ? {
            sketching: {
              ...state.sketching,
              points: [...state.sketching.points, [lng, lat]],
            },
          }
        : {},
    ),

  finishSketch: () =>
    set((state) => {
      const sketching = state.sketching;
      if (!sketching) {
        return {};
      }
      const kind = sketchKindOf(sketching.kindId);
      if (!kind || sketching.points.length < kind.minPoints) {
        // A no-op rather than a discard, same as the conformant tool: the operator
        // double-clicked early and their points are worth more than the gesture.
        return {};
      }
      const id = `sketch-${nextId++}`;
      return {
        sketching: null,
        sketches: [
          ...state.sketches,
          {
            id,
            kindId: sketching.kindId,
            // **As clicked.** No reordering, no width point, no anchor rule — that is the
            // whole difference between this path and the conformant one.
            points: sketching.points,
            label: sketching.label,
          },
        ],
        selectedSketchId: id,
      };
    }),

  cancelSketch: () => set({ sketching: null }),

  selectSketch: (id) =>
    set({ selectedSketchId: id, selectedId: null, selectedGraphicId: null }),

  setSketchLabel: (id, label) =>
    set((state) => ({
      sketches: state.sketches.map((sketch) =>
        sketch.id === id ? { ...sketch, label } : sketch,
      ),
    })),

  deleteSketch: (id) =>
    set((state) => ({
      sketches: state.sketches.filter((sketch) => sketch.id !== id),
      selectedSketchId:
        state.selectedSketchId === id ? null : state.selectedSketchId,
    })),

  /* ------------------------------------------------- editing a placed shape */

  editMode: "move",
  setEditMode: (editMode) => set({ editMode }),

  moveVertex: (index, lng, lat) =>
    set((state) => editPoints(state, (points) =>
      points.map((point, i) =>
        i === index ? ([lng, lat] as [number, number]) : point,
      ),
    )),

  insertVertex: (lng, lat) =>
    set((state) =>
      editPoints(state, (points) => {
        if (points.length < 2) {
          return [...points, [lng, lat]];
        }
        const at = nearestSegment(points, [lng, lat]);
        const next = [...points];
        next.splice(at + 1, 0, [lng, lat]);
        return next;
      }),
    ),

  removeVertex: (index) =>
    set((state) =>
      editPoints(state, (points) => {
        const floor = minimumPointsFor(state);
        if (points.length <= floor) {
          // A no-op rather than a shape that stops drawing. The renderer refuses a
          // geometry below its minimum and the sketch geometry returns nothing, so
          // removing the last permitted point would make the graphic silently vanish
          // and leave the operator with an empty selection they cannot undo.
          return points;
        }
        return points.filter((_, i) => i !== index);
      }),
    ),

  seedSample: () =>
    set((state) => ({
      graphics: SAMPLE_GRAPHICS.map((sample) => ({
        id: `graphic-${nextId++}`,
        sidc: composeSidc(sample.basicId, {
          ...DEFAULT_FIELDS,
          version: state.draft.fields.version,
          ...sample.fields,
        }),
        name: sample.name,
        points: orderPointsForRule(sample.drawRuleName, sample.points).map(
          ([lng, lat]) => [lng, lat] as [number, number],
        ),
        amplifiers: { ...sample.amplifiers },
      })),
      selectedGraphicId: null,
      drawing: null,
      // The sketches go down beside the conformant graphics on purpose: the whole value
      // of having both paths in one application is being able to see the difference in
      // one screen without switching anything.
      sketches: SAMPLE_SKETCHES.map((sample) => ({
        id: `sketch-${nextId++}`,
        kindId: sample.kindId,
        points: sample.points.map(([lng, lat]) => [lng, lat] as [number, number]),
        label: sample.label,
      })),
      selectedSketchId: null,
      sketching: null,
      symbols: SAMPLE.map((sample) => ({
        id: `mark-${nextId++}`,
        // The draft's version, so the sample is drawn under whichever standard is
        // selected — which is worth doing rather than pinning it to 2525D, because two
        // of these five look different under APP-6(E).
        sidc: composeSidc(sample.basicId, {
          ...DEFAULT_FIELDS,
          version: state.draft.fields.version,
          ...sample.fields,
        }),
        lng: sample.lng,
        lat: sample.lat,
        amplifiers: { ...sample.amplifiers },
        fillColor: null,
      })),
      selectedId: null,
    })),
}));

/** The selected mark, or null. */
export function selectedSymbolOf(state: DemoState): PlacedSymbol | null {
  return state.symbols.find((s) => s.id === state.selectedId) ?? null;
}
