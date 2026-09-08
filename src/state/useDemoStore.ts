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
  points: readonly (readonly [number, number])[];
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
    points: [
      [100.70, 13.63],
      [100.54, 13.66],
      [100.36, 13.62],
      [100.70, 13.64],
    ],
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
    fields: {},
    amplifiers: { T_UNIQUE_DESIGNATION_1: "AC ONE" },
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
              points,
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
            points: drawing.points,
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
        points: sample.points.map(([lng, lat]) => [lng, lat] as [number, number]),
        amplifiers: { ...sample.amplifiers },
      })),
      selectedGraphicId: null,
      drawing: null,
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
