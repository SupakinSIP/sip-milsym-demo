/**
 * The demo's one automated check, and it runs in a browser because it has to.
 *
 * mil-sym-ts measures text with a canvas, and with no `document` it does not fail — it
 * logs at INFO, swallows its own exception, and returns a bare frame with the right box
 * and the right anchor and none of the lettering, staff or echelon it was asked for. A
 * Node test asserting on those numbers would pass while proving nothing. See the
 * docblock in `src/symbology/renderSymbol.ts`.
 *
 * Run it:
 *
 *     npm run dev                       # serves /smoke.html
 *     npm run smoke                     # drives headless Chrome and prints the report
 *
 * What it asserts is the load-bearing half of the port: that each of the four standards
 * has a populated catalog, that composing a SIDC puts the symbol set and the entity in
 * the positions the standard gives them, and that the anchor moves to the foot of the
 * staff when a symbol becomes a headquarters — which is the number `markerOffset` exists
 * to correct and the one that silently puts a command post in the wrong place.
 */
import { SymbolID } from "@armyc2.c5isr.renderer/mil-sym-ts-web";
import {
  STANDARDS,
  canRender,
  basicIdOf,
  catalogOf,
  drawRuleTextOf,
  composeSidc,
  DEFAULT_FIELDS,
  fieldsOf,
  initRenderer,
  modifiersOf,
  renderSymbol,
  searchCatalog,
  standardOf,
} from "../src/symbology/index.js";
import {
  MAP_ARMY_BASELINE,
  coverageReport,
  headlineComparison,
} from "../src/symbology/coverage.js";
import { crosswalk } from "../src/symbology/crosswalk.js";
import {
  axisHalfWidthMetres,
  axisWidthCheck,
  axisWidthPoint,
  clickBudgetForRule,
  controlPointsForRule,
  renderGraphic,
} from "../src/symbology/renderGraphic.js";
import { useDemoStore } from "../src/state/useDemoStore.js";
import {
  arrow,
  obstacleX,
  offsetPolyline,
  polylineLength,
  trimEnd,
  type Pt,
} from "../src/sketch/geometry.js";
import { SKETCH_KINDS } from "../src/sketch/kinds.js";
import { markerOffset, scaleForCamera } from "../src/map/markerOffset.js";

const lines: string[] = [];
let failures = 0;

function check(label: string, ok: boolean, detail: unknown): void {
  lines.push(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(38)} ${JSON.stringify(detail)}`);
  if (!ok) {
    failures += 1;
  }
}

await initRenderer();

/* ------------------------------------------------- every standard has a catalog */

for (const standard of STANDARDS) {
  const catalog = catalogOf(standard.version);
  const points = catalog.entries.filter((e) => e.geometry === "point").length;
  check(
    `catalog ${standard.id}`,
    catalog.entries.length > 1000 && points > 800 && catalog.symbolSets.length > 10,
    {
      version: standard.version,
      entities: catalog.entries.length,
      points,
      sets: catalog.symbolSets.length,
    },
  );
}

/* ------------------------------------------------- the SIDC round trip */

const INFANTRY = "10121100";
const sidc = composeSidc(INFANTRY, DEFAULT_FIELDS);
check("composeSidc places set and entity", basicIdOf(sidc) === INFANTRY, {
  sidc,
  basicId: basicIdOf(sidc),
  set: SymbolID.getSymbolSet(sidc),
  entity: SymbolID.getEntityCode(sidc),
});
check(
  "fieldsOf reads the fields back",
  JSON.stringify(fieldsOf(sidc)) === JSON.stringify(DEFAULT_FIELDS),
  fieldsOf(sidc),
);

const named = catalogOf(standardOf("2525D").version).entries.find(
  (entry) => entry.basicId === INFANTRY,
);
check("the catalog names it", named?.name === "Infantry", {
  name: named?.name,
  path: named?.path,
});

/* ------------------------------------------------- the box and the anchor */

const measure = (code: string, amplifiers?: Record<string, string>) => {
  const rendered = renderSymbol(code, { size: 40, amplifiers, outline: true });
  return {
    drawn: rendered.drawn,
    box: [Math.round(rendered.width), Math.round(rendered.height)],
    anchor: [Math.round(rendered.anchorX), Math.round(rendered.anchorY)],
    offset: markerOffset(rendered, 0).map(Math.round),
    svgBytes: rendered.svg.length,
  };
};

const plain = measure(sidc);
check(
  "plain frame is anchored at its centre",
  plain.drawn &&
    Math.abs(plain.anchor[0]! - plain.box[0]! / 2) <= 1 &&
    Math.abs(plain.anchor[1]! - plain.box[1]! / 2) <= 1,
  plain,
);

// The same symbol as a battalion headquarters: digit 8 = 2, digits 9-10 = 16.
const hqSidc = composeSidc(INFANTRY, {
  ...DEFAULT_FIELDS,
  hqtfd: SymbolID.HQTFD_Headquarters,
  amplifierDescriptor: SymbolID.Echelon_Battalion_Squadron,
});
const hq = measure(hqSidc);
check(
  "a headquarters is anchored at the staff foot",
  hq.drawn && hq.box[1]! > plain.box[1]! && hq.anchor[1]! >= hq.box[1]! - 1,
  hq,
);
check(
  "markerOffset corrects for that anchor",
  hq.offset[1]! < -10 && hq.offset[0]! !== 0,
  { offset: hq.offset, note: "negative dy lifts the box so the foot lands on the point" },
);

const lettered = measure(hqSidc, {
  T_UNIQUE_DESIGNATION_1: "1-27 IN",
  M_HIGHER_FORMATION: "2 BCT",
  AW_HEADQUARTERS_ELEMENT: "MAIN",
  C_QUANTITY: "12",
});
check(
  "amplifiers widen the box the renderer reports",
  lettered.drawn && lettered.box[0]! > hq.box[0]! && lettered.svgBytes > hq.svgBytes,
  lettered,
);
check(
  "Field AH is not clipped — the box grew for it",
  // The milsymbol failure `sip-map-army` letters two fields by hand to work around:
  // there, the viewBox stays at 21..179 whatever the text is. Here the width has to
  // grow, and by more than the designation alone would need.
  lettered.box[0]! >= 100,
  { width: lettered.box[0], milsymbolWouldClipAt: "~4 characters" },
);

/* ------------------------------------------------- per-symbol amplifiers */

const unitMods = modifiersOf(INFANTRY, standardOf("2525D").version);
const airMods = modifiersOf("01110000", standardOf("2525D").version);
check(
  "modifiersOf differs per symbol",
  unitMods.has("M_HIGHER_FORMATION") && !airMods.has("M_HIGHER_FORMATION"),
  { unit: unitMods.size, air: airMods.size },
);

/* ------------------------------------------------- the memo */

const before = performance.now();
for (let i = 0; i < 2000; i++) {
  renderSymbol(hqSidc, { size: 40, outline: true });
}
const perCall = (performance.now() - before) / 2000;
check("the memo serves a repeat render", perCall < 0.05, {
  msPerCachedCall: Number(perCall.toFixed(4)),
});

/* ------------------------------------------------- the search finds what it should */

const D = catalogOf(standardOf("2525D").version);
const top = (text: string, n = 3): { total: number; names: string[] } => {
  const found = searchCatalog(D, { text, symbolSet: "", geometry: "", limit: n });
  return { total: found.total, names: found.rows.map((row) => row.name) };
};

// Ranked, not just filtered. Substring matching alone returned "Tanker" and "Antitank
// Obstacles" above "Tank", and a reader of that list concludes the catalog has no tank.
const tank = top("tank");
check("the exact name ranks first", tank.names[0] === "Tank", tank);

// An acronym the standard never prints. `hq` used to match "Eart*hq*uake Epicenter".
const hqQuery = top("hq");
check(
  "an abbreviation reaches its expansion",
  hqQuery.names[0] === "Named Headquarters" &&
    !hqQuery.names.includes("Earthquake Epicenter"),
  hqQuery,
);

// A multi-word expansion is a phrase: scoring its strongest part instead of its weakest
// returned 150 rows for `sam`, anything mentioning "air".
const sam = top("sam");
check(
  "a phrase expansion stays narrow",
  sam.total > 0 && sam.total < 30 && sam.names.includes("Air Defense Missile Launcher"),
  sam,
);

const apc = top("apc");
check(
  "initialisms and acronyms both land",
  apc.names[0] === "Armored Personnel Carrier" && apc.total < 10,
  apc,
);

// A synonym broadens: "Howitzer" is an entity in its own right, and the row reaches the
// Field Artillery unit as well, which is what someone asking for one on a map wants.
const synonym = top("howitzer");
check(
  "a synonym reaches the related unit too",
  synonym.names[0] === "Howitzer" && synonym.names.includes("Field Artillery"),
  synonym,
);

/* ------------------------------------------------- the coverage comparison */

const report = coverageReport();
check(
  "the baseline is the numbers in map.army's catalog",
  MAP_ARMY_BASELINE.catalogNodes === 927 &&
    MAP_ARMY_BASELINE.structuralNodes === 16 &&
    MAP_ARMY_BASELINE.drawableSymbols === 911,
  MAP_ARMY_BASELINE,
);

const headline = headlineComparison("2525D");
check(
  "the modifier tables were readable",
  headline.modifiersCounted && headline.modifierIcons > 400,
  { modifierIcons: headline.modifierIcons },
);
check(
  // Both halves asserted, because the panel's argument is that these two disagree: the
  // entity count is below map.army and the icon-part count is well above it. If either
  // stops being true the panel's text is wrong and should be rewritten, not adjusted.
  "entities fall short and icon parts do not",
  headline.entityRatio < 1 && headline.iconPartRatio > 1.5,
  {
    entities: headline.entities,
    iconParts: headline.iconParts,
    theirs: headline.theirs,
    entityRatio: Number(headline.entityRatio.toFixed(3)),
    iconPartRatio: Number(headline.iconPartRatio.toFixed(3)),
  },
);
check(
  "the union is bigger than any one standard",
  report.unionSymbols > Math.max(...report.standards.map((s) => s.symbols)) &&
    report.commonToAll < report.unionSymbols,
  { union: report.unionSymbols, commonToAll: report.commonToAll },
);
check(
  "the duplicated rows are carried, not hidden",
  report.standards.every((s) => s.rows === s.symbols + s.duplicateRows) &&
    report.standards.some((s) => s.duplicateRows > 0),
  report.standards.map((s) => `${s.id}:${s.rows}=${s.symbols}+${s.duplicateRows}`),
);

/* ------------------------------------------------- the crosswalk, symbol by symbol */

const x = crosswalk(standardOf("2525D").version);
check(
  "every drawable map.army key was crosswalked",
  x.rows.length === MAP_ARMY_BASELINE.drawableSymbols,
  { rows: x.rows.length, expected: MAP_ARMY_BASELINE.drawableSymbols },
);
check(
  // The measured form of the coverage argument: if this ever drops to ~1.0, 2525C and
  // 2525D would be encoding at the same granularity and the icon-part comparison would
  // stop being the right one.
  "2525C spends more keys per 2525D entity",
  x.keysPerEntity > 1.5 && x.distinctTargets < x.mapped.length,
  {
    mapped: x.mapped.length,
    entities: x.distinctTargets,
    keysPerEntity: Number(x.keysPerEntity.toFixed(2)),
  },
);
check(
  // The claim the panel makes in its own words: map.army has essentially nothing this
  // cannot draw. Asserted as a bound, not an equality, because the name search will move
  // by a row or two whenever the search index changes.
  "almost nothing map.army has is missing here",
  x.unmappedAndUnnamed.length <= 10 &&
    x.unmappedWithNameMatch.length > x.unmappedAndUnnamed.length * 5,
  {
    noSuccessorInTable: x.unmapped.length,
    foundByName: x.unmappedWithNameMatch.length,
    nothingEitherWay: x.unmappedAndUnnamed.map((row) => row.name),
  },
);
check(
  // The specific counterexample that made the name fallback necessary — an installation
  // the migration table refuses while 2525D plainly holds it.
  "the table's Land Installations gap is visible",
  x.unmapped.some((row) => row.key === "S-G-IBA---") &&
    x.rows.every((row) => row.entity?.symbolSet !== "20"),
  {
    airbaseUnmapped: x.unmapped.some((row) => row.key === "S-G-IBA---"),
    anyInstallationTargets: x.rows.filter((row) => row.entity?.symbolSet === "20")
      .length,
  },
);
check(
  "milsymbol draws no tactical-graphics family",
  MAP_ARMY_BASELINE.milsymbolSchemeGKeys === 13 &&
    MAP_ARMY_BASELINE.tacticalGraphics === 21 &&
    (report.sets.find((s) => s.code === "25")?.count ?? 0) > 500,
  {
    milsymbolSchemeG: MAP_ARMY_BASELINE.milsymbolSchemeGKeys,
    mapArmyHandAuthored: MAP_ARMY_BASELINE.tacticalGraphics,
    ourControlMeasures: report.sets.find((s) => s.code === "25")?.count,
  },
);

/* ------------------------------------------------- what actually has artwork */

check(
  // map.army subtracts its 16 structural nodes; this side has the same kind of row and
  // many more of them. Counting all 878 warfighting entities against their 911 *drawable*
  // ones was generous to this side, and this check is what keeps the subtraction in place.
  "category nodes are subtracted on this side too",
  report.standards.every((s) => s.warfightingDrawable < s.warfighting) &&
    report.standards.every((s) => s.notDrawable > 50),
  report.standards.map(
    (s) => `${s.id}: wf ${s.warfighting} -> drawable ${s.warfightingDrawable}, ${s.notDrawable} without artwork in all`,
  ),
);
check(
  // 115 of 2525D's entries return null from RenderSVG outright — all category headers
  // like "Atmospheric / Pressure Systems". The gallery draws a placeholder for them
  // rather than an empty cell, which is only correct if this stays true.
  "the not-drawable rows really do draw nothing",
  (() => {
    const D = catalogOf(standardOf("2525D").version);
    const headers = D.entries.filter((e) => !canRender(e.basicId, standardOf("2525D").version));
    const empty = headers.filter(
      (e) => !renderSymbol(composeSidc(e.basicId, { ...DEFAULT_FIELDS, version: standardOf("2525D").version }), { size: 32 }).drawn,
    );
    return headers.length > 100 && empty.length > 100;
  })(),
  { note: "CanRender false, and RenderSVG returns null for most of them" },
);
check(
  // The gallery's promise: every line and area entity draws a preview icon, which is what
  // map.army cannot do at all for this family.
  "line and area symbols draw preview icons",
  (() => {
    const D = catalogOf(standardOf("2525D").version);
    const shapes = D.entries.filter((e) => e.geometry !== "point" && canRender(e.basicId, standardOf("2525D").version));
    const drawn = shapes.filter(
      (e) => renderSymbol(composeSidc(e.basicId, { ...DEFAULT_FIELDS, version: standardOf("2525D").version }), { size: 40 }).drawn,
    );
    return shapes.length > 300 && drawn.length === shapes.length;
  })(),
  { note: "every drawable line/area entity returns an SVG" },
);

/* ------------------------------------------------- the multipoint path */

const D2525 = standardOf("2525D").version;
const catalogD = catalogOf(D2525);
const shapes = catalogD.entries.filter((e) => e.geometry !== "point");

/** A ring of n points, so a graphic gets at least its minimum. */
const ring = (n: number): [number, number][] =>
  Array.from({ length: Math.max(n, 2) }, (_, i) => {
    const a = (i / Math.max(n, 2)) * Math.PI * 2;
    return [100.5 + 0.12 * Math.cos(a), 13.75 + 0.1 * Math.sin(a)] as [
      number,
      number,
    ];
  });

const GEOMETRY_MODS = {
  AM_DISTANCE: "2000,2000,2000",
  AN_AZIMUTH: "90,180",
  T_UNIQUE_DESIGNATION_1: "T1",
  X_ALTITUDE_DEPTH: "500,1500",
};

let drew = 0;
let refused = 0;
let neededDistance = 0;
for (const entry of shapes) {
  const sidc = composeSidc(entry.basicId, { ...DEFAULT_FIELDS, version: D2525 });
  const bare = renderGraphic(sidc, ring(entry.minPoints));
  if (!bare.ok && bare.needs === "AM_DISTANCE") {
    neededDistance += 1;
  }
  const withMods = renderGraphic(sidc, ring(entry.minPoints), {
    amplifiers: GEOMETRY_MODS,
  });
  if (withMods.ok) {
    drew += 1;
  } else {
    refused += 1;
  }
}
check(
  // The answer to "can these be drawn on our own map at all": every line and area entity
  // of 2525D returns real GeoJSON, given the modifiers it asks for.
  "every 2525D line and area graphic renders",
  drew === shapes.length && refused === 0,
  { shapes: shapes.length, drew, refused },
);
check(
  // 54 of them will not draw without a width or radius, and the renderer says which
  // field it wants rather than throwing — which is what the panel's refusal state is
  // built on.
  "the renderer asks for the field it needs",
  neededDistance > 20,
  { needAmDistance: neededDistance },
);
check(
  // The bug this list exists to prevent: `AM_DISTANCE` is not in `AMPLIFIER_KEYS`, so
  // before `ALL_AMPLIFIER_KEYS` it was filtered out between the panel and the renderer —
  // the operator typed a width and the graphic went on refusing to draw.
  "a geometry modifier survives the trip to the renderer",
  (() => {
    const corridor = composeSidc("25170100", {
      ...DEFAULT_FIELDS,
      version: D2525,
    });
    const without = renderGraphic(corridor, ring(2));
    const with_ = renderGraphic(corridor, ring(2), {
      amplifiers: { AM_DISTANCE: "4000" },
    });
    return !without.ok && with_.ok && with_.collection.features.length > 4;
  })(),
  { note: "Air Corridor refuses bare, draws with AM_DISTANCE" },
);
check(
  "graphics come back as styled geometry, not pictures",
  (() => {
    const boundary = renderGraphic(
      composeSidc("25110100", { ...DEFAULT_FIELDS, version: D2525 }),
      [
        [100.28, 13.95],
        [100.62, 13.93],
      ],
      { amplifiers: { T_UNIQUE_DESIGNATION_1: "2 BCT" } },
    );
    if (!boundary.ok) {
      return false;
    }
    const kinds = new Set(
      boundary.collection.features.map((f) => f.geometry.type),
    );
    const styled = boundary.collection.features.some(
      (f) =>
        typeof f.properties["strokeColor"] === "string" ||
        typeof f.properties["fillColor"] === "string",
    );
    const lettered = boundary.collection.features.some(
      (f) => f.properties["label"] === "2 BCT",
    );
    return kinds.has("MultiLineString") && styled && lettered;
  })(),
  { note: "MultiLineString + stroke properties + the designation as a label feature" },
);


/* ------------------------------------------------- the axis rules' point order */

const MAIN_ATTACK = composeSidc("25151403", { ...DEFAULT_FIELDS, version: D2525 });
const mainAttackEntry = catalogD.entries.find((e) => e.basicId === "25151403");

check(
  "the draw rule is on the catalog entry",
  mainAttackEntry?.drawRuleName === "AXIS2" &&
    (drawRuleTextOf("AXIS2")?.anchorPoints ?? "").includes("tip of the arrowhead"),
  {
    rule: mainAttackEntry?.drawRuleName,
    min: mainAttackEntry?.minPoints,
    max: mainAttackEntry?.maxPoints,
  },
);

/**
 * How far the drawn centre line strays from the points that were clicked.
 *
 * The honest test of "did it draw what I meant": for every intermediate point of the
 * centre line, the nearest rendered vertex should be within a few metres, because the
 * renderer builds the corridor around those very points. Under the wrong point order the
 * middle points are not on the centre line at all — they are read as something else — and
 * the distance blows out to kilometres.
 *
 * Measuring the arrowhead directly was the first attempt and it does not work: the head
 * converges *at* point 1 rather than overshooting it, so "which end has vertices past the
 * input" finds nothing at either end.
 */
const strayMetres = (
  points: readonly (readonly [number, number])[],
  pathIndices: readonly number[],
): number => {
  const result = renderGraphic(MAIN_ATTACK, points);
  if (!result.ok) {
    return Infinity;
  }
  const flat: [number, number][] = [];
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      flat.push([c[0] as number, c[1] as number]);
    } else if (Array.isArray(c)) {
      c.forEach(walk);
    }
  };
  for (const f of result.collection.features) {
    walk(f.geometry.coordinates);
  }
  let worst = 0;
  for (const index of pathIndices) {
    const [px, py] = points[index]!;
    let best = Infinity;
    for (const [x, y] of flat) {
      const dy = (y - py) * 111320;
      const dx = (x - px) * Math.cos((py * Math.PI) / 180) * 111320;
      best = Math.min(best, Math.hypot(dx, dy));
    }
    worst = Math.max(worst, best);
  }
  return worst;
};

// Tip in the east, centre line running west, width point offset from the tip.
const rightOrder: [number, number][] = [
  [100.7, 13.63],
  [100.54, 13.66],
  [100.36, 13.62],
  [100.7, 13.64],
];
// The same four clicks collected tail-first, which is what the demo used to do.
const wrongOrder: [number, number][] = [
  [100.36, 13.62],
  [100.54, 13.66],
  [100.7, 13.63],
  [100.7, 13.64],
];
const rightStray = strayMetres(rightOrder, [1, 2]);
const wrongStray = strayMetres(wrongOrder, [1, 2]);
check(
  // AXIS2 in the standard's words: "Point 1 defines the tip of the arrowhead… Point N
  // determines the width." Locked as a test because the demo assumed a plain path and
  // drew every axis graphic wrongly.
  // The bound is the width, not zero: what comes back is the two **edges** of the
  // corridor, so the nearest vertex to a centre-line point sits about a half-width away.
  // 554 m against a 1,093 m half width is hugging the path; 13.6 km is not on it at all.
  "the centre line runs through the clicked points, tip first",
  rightStray < 1200 && wrongStray > 5000,
  {
    tipFirstStrayMetres: Math.round(rightStray),
    tailFirstStrayMetres: Math.round(wrongStray),
  },
);

const widthCheck = axisWidthCheck("AXIS2", [
  [100.7, 13.63],
  [100.54, 13.66],
  [100.36, 13.62],
  [100.7, 13.64],
]);
check(
  "the width point is measured perpendicular to the first leg",
  widthCheck !== null &&
    !widthCheck.collapses &&
    widthCheck.halfWidthMetres > 900 &&
    widthCheck.halfWidthMetres < 1300 &&
    widthCheck.firstLegMetres > 15000,
  widthCheck
    ? {
        halfWidth: Math.round(widthCheck.halfWidthMetres),
        firstLeg: Math.round(widthCheck.firstLegMetres),
      }
    : null,
);

check(
  // `clsUtility.FilterAXADPoints` discards the centre line when the half width exceeds
  // the first leg, which is what turned Main Attack into a hairline wedge. The guard has
  // to keep spotting it.
  "an over-wide axis is caught before the path is discarded",
  axisWidthCheck("AXIS2", [
    [100.7, 13.63],
    [100.66, 13.635],
    [100.36, 13.62],
    [100.7, 13.75],
  ])?.collapses === true,
  { note: "short first leg, far width point" },
);

check(
  "the sample laydown's Main Attack is drawn the standard's way from axis clicks alone",
  (() => {
    useDemoStore.getState().seedSample();
    const graphic = useDemoStore
      .getState()
      .graphics.find((g) => g.name === "Main Attack");
    if (!graphic) {
      return false;
    }
    const width = axisWidthCheck("AXIS2", graphic.points);
    const drawn = renderGraphic(graphic.sidc, graphic.points);
    useDemoStore.getState().clearAll();
    return width !== null && !width.collapses && drawn.ok;
  })(),
  { note: "tip first, width point last, half width under the first leg" },
);


/* ------------------------------------------------- the scale is not a constant */

const OBSTACLE = composeSidc("25290100", { ...DEFAULT_FIELDS, version: D2525 });
const OBSTACLE_POINTS: [number, number][] = [
  [100.3, 13.7],
  [100.7, 13.74],
];

/** How many coordinates a decorated line comes back as — its ornament's density. */
const ornamentCoords = (scale: number): number => {
  const result = renderGraphic(OBSTACLE, OBSTACLE_POINTS, { scale });
  if (!result.ok) {
    return 0;
  }
  let n = 0;
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      n += 1;
    } else if (Array.isArray(c)) {
      c.forEach(walk);
    }
  };
  for (const f of result.collection.features) {
    walk(f.geometry.coordinates);
  }
  return n;
};

const close = ornamentCoords(5_000);
const mid = ornamentCoords(50_000);
const far = ornamentCoords(500_000);
check(
  // A decorated line's ornament is generated per screen pixel at the scale it is given,
  // so a fixed scale bakes it at one zoom and draws it wrong at every other. The demo
  // hardcoded 50,000 until the symptom — Xs that grew with the ground on zoom — was
  // reported. This locks the fact that the scale matters.
  "the renderer's ornament density follows the scale",
  close > mid * 5 && mid > far * 5,
  { atScale5k: close, atScale50k: mid, atScale500k: far },
);

check(
  // What `MapView` feeds it. Zoom 8 over Bangkok is a regional view — about 1:2.2M — and
  // zoom 15 a street view about seventeen thousand times finer per pixel.
  "the camera scale is a map scale",
  (() => {
    const wide = scaleForCamera(8, 13.75);
    const close2 = scaleForCamera(15, 13.75);
    return (
      wide > 1_800_000 &&
      wide < 2_600_000 &&
      Math.abs(wide / close2 - 128) < 1
    );
  })(),
  {
    zoom8: Math.round(scaleForCamera(8, 13.75)),
    zoom15: Math.round(scaleForCamera(15, 13.75)),
  },
);

check(
  // An arrow's geometry is proportional to its own line, not to the screen, so it is the
  // same at every scale — which is why only the decorated graphics needed the fix.
  "an arrow graphic is scale-independent",
  (() => {
    const arrow = composeSidc("25140602", { ...DEFAULT_FIELDS, version: D2525 });
    const at = (scale: number): string => {
      const result = renderGraphic(arrow, OBSTACLE_POINTS, { scale });
      return result.ok ? JSON.stringify(result.collection.features.length) : "no";
    };
    return at(5_000) === at(5_000_000) && at(5_000) !== "no";
  })(),
  { note: "same feature count from 1:5,000 to 1:5,000,000" },
);

check(
  // The two-click arrow the catalog does have, distinct from the four-point axis version
  // of the same name. Both are in the sample laydown.
  "a two-click arrow exists and draws",
  (() => {
    const entry = catalogD.entries.find((e) => e.basicId === "25140602");
    if (!entry || entry.minPoints !== 2 || entry.drawRuleName !== "LINE1") {
      return false;
    }
    const drawn = renderGraphic(
      composeSidc(entry.basicId, { ...DEFAULT_FIELDS, version: D2525 }),
      OBSTACLE_POINTS,
    );
    return drawn.ok && drawn.collection.features.length >= 2;
  })(),
  {
    entity: "25140602 Direction of Attack / Friendly Main Attack (Decisive)",
    rule: "LINE1",
    minPoints: 2,
  },
);


/* ------------------------------------------------- clicks in, standard order out */

check(
  // The tool bends to the gesture: an attack arrow is clicked from the rear toward the
  // objective, and the translation hands the renderer the tip-first centre line AXIS2
  // wants with a width point appended. The clicks must survive the trip reversed and
  // otherwise untouched, or the translation is not a translation.
  "clicking rear-first gives the standard's tip-first centre line",
  (() => {
    const clicked: [number, number][] = [
      [100.36, 13.62],
      [100.54, 13.66],
      [100.7, 13.63],
    ];
    const control = controlPointsForRule("AXIS2", clicked);
    const same =
      JSON.stringify(control.slice(0, -1)) ===
      JSON.stringify([...clicked].reverse());
    const drawn = renderGraphic(MAIN_ATTACK, control);
    return control.length === 4 && same && drawn.ok;
  })(),
  { note: "3 clicks in, 4 control points out: the reversed path plus a derived width" },
);

check(
  // **The mechanism map.army has and this did not.** Two clicks along the axis and the
  // arrow is drawn — no width click, and the drawn centre line still hugs the clicks.
  // The bound is the derived half width rather than zero because what comes back is the
  // two edges of the corridor; the shape this replaces strayed by kilometres.
  "two clicks along the axis draw the arrow",
  (() => {
    const clicked: [number, number][] = [
      [100.36, 13.62],
      [100.7, 13.63],
    ];
    const control = controlPointsForRule("AXIS2", clicked) as [number, number][];
    const half = axisHalfWidthMetres([...clicked].reverse());
    return (
      control.length === 3 &&
      renderGraphic(MAIN_ATTACK, control).ok &&
      axisWidthCheck("AXIS2", control)?.collapses === false &&
      strayMetres(control, [1]) < half * 1.5
    );
  })(),
  {
    note: "the rear click is on the drawn centre line, within a half width",
    strayMetres: Math.round(
      strayMetres(
        controlPointsForRule("AXIS2", [
          [100.36, 13.62],
          [100.7, 13.63],
        ]) as [number, number][],
        [1],
      ),
    ),
  },
);

check(
  // The gesture is one click shorter than the geometry, and everything that counts
  // clicks has to say so — the tile, the hint bar's "point N of M", and the commit
  // threshold. AXIS2's library minimum is 3 control points; its gesture is 2 clicks.
  "an axis graphic's click budget is one short of its control points",
  (() => {
    const entry = catalogD.entries.find((e) => e.basicId === "25151403");
    if (!entry) {
      return false;
    }
    const axis = clickBudgetForRule(
      entry.drawRuleName,
      entry.minPoints,
      entry.maxPoints,
    );
    const area = clickBudgetForRule("AREA1", 3, 50);
    return (
      entry.minPoints === 3 &&
      axis.minClicks === 2 &&
      axis.maxClicks === entry.maxPoints - 1 &&
      area.minClicks === 3 &&
      area.maxClicks === 50
    );
  })(),
  { note: "AXIS budgets shrink by one, every other rule passes through" },
);

check(
  // The derived width is what makes two clicks safe, so it has to be safe at every shape
  // of axis — including the one that used to collapse: a tiny first leg with a long tail
  // behind it. Capping against leg one is for exactly that case.
  "the derived width never trips the renderer's collapse condition",
  (() => {
    const axes: [number, number][][] = [
      // A long straight axis.
      [
        [100.0, 13.6],
        [101.0, 13.6],
      ],
      // A dog-leg whose *last* leg — leg one of the centre line — is tiny.
      [
        [100.0, 13.6],
        [100.9, 13.62],
        [100.905, 13.621],
      ],
      // A short axis, where a fraction of the length is a few hundred metres.
      [
        [100.5, 13.5],
        [100.508, 13.503],
      ],
      // Many points, folding back on itself.
      [
        [100.2, 13.4],
        [100.4, 13.5],
        [100.3, 13.6],
        [100.6, 13.65],
      ],
    ];
    return axes.every((clicked) => {
      const control = controlPointsForRule("AXIS2", clicked);
      const measured = axisWidthCheck("AXIS2", control);
      return (
        measured !== null &&
        !measured.collapses &&
        measured.halfWidthMetres <= measured.firstLegMetres * 0.36 &&
        renderGraphic(MAIN_ATTACK, control).ok
      );
    });
  })(),
  { note: "four shapes of axis, including a dog-leg with a metres-long final leg" },
);

check(
  // The derived point is perpendicular to leg one and offset from the **tip**, because
  // that is the geometry the stray measurement was taken against. Checked as a right
  // angle rather than by eye: the dot product of the leg and the offset.
  "the derived width point is square off the arrowhead",
  (() => {
    const centreLine: [number, number][] = [
      [100.7, 13.63],
      [100.36, 13.62],
    ];
    const width = axisWidthPoint(centreLine);
    const scale = Math.cos((13.63 * Math.PI) / 180) * 111320;
    const legX = (centreLine[1]![0] - centreLine[0]![0]) * scale;
    const legY = (centreLine[1]![1] - centreLine[0]![1]) * 111320;
    const offX = (width[0] - centreLine[0]![0]) * scale;
    const offY = (width[1] - centreLine[0]![1]) * 111320;
    const dot = legX * offX + legY * offY;
    const lengths = Math.hypot(legX, legY) * Math.hypot(offX, offY);
    return Math.abs(dot / lengths) < 1e-6;
  })(),
  { note: "the dot product of leg one and the derived offset is zero" },
);

check(
  // Everything that is genuinely a path is passed through untouched — reordering an area
  // would turn its boundary inside out.
  "a path rule is passed through unchanged",
  (() => {
    const points: [number, number][] = [
      [100.4, 13.5],
      [100.6, 13.55],
      [100.6, 13.4],
    ];
    return (
      JSON.stringify(controlPointsForRule("AREA1", points)) ===
        JSON.stringify(points) &&
      JSON.stringify(controlPointsForRule("LINE1", points)) ===
        JSON.stringify(points)
    );
  })(),
  { note: "AREA1 and LINE1 untouched" },
);


/* ------------------------------------------------- the sketch geometry */

const SKETCH_PATH: Pt[] = [
  { x: 20, y: 200 },
  { x: 200, y: 120 },
  { x: 420, y: 160 },
];

check(
  // The whole promise of the sketch path: the head is where the operator stopped. The
  // conformant path puts it at point 1 and needs a width point; this puts it at the last
  // click and needs nothing.
  "a sketch arrow's head is at the last clicked point",
  (() => {
    const drawn = arrow(SKETCH_PATH, { head: 20, headHalf: 10 });
    if (drawn.fills.length !== 1) {
      return false;
    }
    // The filled head's three points; the tip is the one nearest the last click.
    const numbers = (drawn.fills[0]!.d.match(/-?\d+\.?\d*/g) ?? []).map(Number);
    const tipX = numbers[0]!;
    const tipY = numbers[1]!;
    const last = SKETCH_PATH[SKETCH_PATH.length - 1]!;
    return Math.hypot(tipX - last.x, tipY - last.y) < 0.5;
  })(),
  { note: "arrowhead tip within half a pixel of the final click" },
);

check(
  // Screen space is the reason the ornament does not need a map scale: the same path
  // scaled up tenfold gets ten times as many Xs at the same spacing, rather than the same
  // number of bigger ones.
  "a sketch ornament's spacing is fixed in pixels",
  (() => {
    const short = obstacleX(SKETCH_PATH, { step: 26 });
    const long = obstacleX(
      SKETCH_PATH.map((p) => ({ x: p.x * 4, y: p.y * 4 })),
      { step: 26 },
    );
    // Two strokes per X.
    const shortCount = short.strokes.length / 2;
    const longCount = long.strokes.length / 2;
    const ratio = longCount / shortCount;
    return ratio > 3.5 && ratio < 4.5;
  })(),
  { note: "four times the pixels, four times the Xs, same step" },
);

check(
  "offsetting a path keeps it parallel",
  (() => {
    const straight: Pt[] = [
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ];
    // Positive offset is the side that appears to the *right* of the direction of
    // travel, because screen y grows downward — see `normal`. Asserting the sign, not
    // just the distance: this is what decides which side a fortified line's teeth face.
    const right = offsetPolyline(straight, 12);
    const left = offsetPolyline(straight, -12);
    return (
      right.every((p) => Math.abs(p.y - 112) < 0.01) &&
      left.every((p) => Math.abs(p.y - 88) < 0.01)
    );
  })(),
  { note: "a horizontal line offset ±12 sits at y±12, sign checked" },
);

check(
  "trimming a path shortens it by exactly the trim",
  (() => {
    const before = polylineLength(SKETCH_PATH);
    const after = polylineLength(trimEnd(SKETCH_PATH, 40));
    return Math.abs(before - after - 40) < 0.01;
  })(),
  { before: Math.round(polylineLength(SKETCH_PATH)), trimmed: 40 },
);

check(
  "every sketch kind draws from its own minimum",
  SKETCH_KINDS.every((kind) => {
    const points = SKETCH_PATH.slice(0, Math.max(kind.minPoints, 2));
    const padded =
      points.length < kind.minPoints
        ? [...points, { x: 300, y: 300 }]
        : points;
    const drawn = kind.draw(
      kind.closed ? [...padded, padded[0]!] : padded,
      "A",
    );
    return drawn.strokes.length + drawn.fills.length > 0;
  }),
  { kinds: SKETCH_KINDS.length },
);


/* ------------------------------------------------- the point editor */

/**
 * The editing model, driven through the store the way the toolbar drives it.
 *
 * Worth checking here rather than by hand: these operate on "whichever shape is
 * selected", which is the sort of dispatch that works for one list and silently does
 * nothing for the other.
 */
const editing = (() => {
  const store = useDemoStore.getState();
  store.clearAll();
  store.startSketch("main-attack");
  store.addSketchPoint(100.3, 13.5);
  store.addSketchPoint(100.5, 13.55);
  store.addSketchPoint(100.7, 13.5);
  store.finishSketch();

  const id = useDemoStore.getState().selectedSketchId;
  const pointsNow = (): readonly [number, number][] =>
    useDemoStore.getState().sketches.find((k) => k.id === id)?.points ?? [];

  const placed = pointsNow().length;

  // Move the middle handle.
  useDemoStore.getState().moveVertex(1, 100.52, 13.6);
  const moved = pointsNow()[1];

  // Insert near the first segment; it must land between points 1 and 2, not at the end.
  useDemoStore.getState().insertVertex(100.4, 13.56);
  const afterInsert = pointsNow();

  // Remove it again by index.
  useDemoStore.getState().removeVertex(1);
  const afterRemove = pointsNow().length;

  // And refuse to go below the kind's minimum.
  useDemoStore.getState().removeVertex(0);
  useDemoStore.getState().removeVertex(0);
  const floored = pointsNow().length;

  useDemoStore.getState().clearAll();
  return {
    placed,
    moved,
    insertedAt: afterInsert.findIndex(
      (p) => Math.abs(p[0] - 100.4) < 1e-9 && Math.abs(p[1] - 13.56) < 1e-9,
    ),
    afterRemove,
    floored,
  };
})();

check(
  "a sketch is placed from its clicks",
  editing.placed === 3,
  { points: editing.placed },
);
check(
  "dragging a handle moves that vertex and no other",
  editing.moved !== undefined &&
    Math.abs(editing.moved[0] - 100.52) < 1e-9 &&
    Math.abs(editing.moved[1] - 13.6) < 1e-9,
  { vertex1: editing.moved },
);
check(
  // Into the nearest *segment*. Appending would have put it at index 3, which is the
  // failure this check exists for: an add-point tool that appends is an extend-line tool.
  "an inserted point splits the nearest segment",
  editing.insertedAt === 1,
  { insertedAtIndex: editing.insertedAt },
);
check(
  "removing a point takes it out",
  editing.afterRemove === 3,
  { after: editing.afterRemove },
);
check(
  // The floor matters: below it the sketch geometry returns nothing and the shape would
  // vanish from the map with no way to get it back.
  "a shape cannot be reduced below its minimum",
  editing.floored === 2,
  { floor: 2, ended: editing.floored },
);

lines.push("");
lines.push(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);

document.getElementById("out")!.textContent = lines.join("\n");
document.title = failures === 0 ? "smoke: pass" : "smoke: fail";