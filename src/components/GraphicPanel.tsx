import {
  ALL_AMPLIFIER_KEYS,
  AMPLIFIER_MAX_CHARS,
  AMPLIFIER_MAX_CHARS_HARD,
  amplifierLetterOf,
  amplifierNameOf,
  axisComponentsOf,
  basicIdOf,
  fieldsOf,
  modifiersOf,
  renderGraphic,
} from "../symbology/index.js";
import { useDemoStore, type PlacedGraphic } from "../state/useDemoStore.js";

/**
 * The selected tactical graphic: its vertices, its lettering, and what the renderer says
 * about it.
 *
 * ### The refusal is a first-class state here, not an error toast
 *
 * 54 of 2525D's 415 multipoint graphics cannot be drawn until a modifier says how wide
 * or how far — an air corridor has no width until Field AM has a value. The renderer
 * answers with a message naming the field, so this panel shows the message *and* puts
 * the cursor in the field it is asking for. A toast saying "render failed" would leave
 * the operator with a shape on the map that is not drawn and no idea why.
 *
 * The fields on offer come from `MSInfo.getModifiers()` for this entity, so a corridor
 * offers a distance and a phase line does not — the same per-symbol vocabulary the mark
 * panel uses, which is a thing the lookup tables give and a generated catalog cannot.
 */

const METRES_HINT =
  "Metres. Several values may be given, comma separated, when the graphic has more than one width or radius.";

export function GraphicPanel({
  graphic,
}: {
  graphic: PlacedGraphic;
}): React.JSX.Element {
  // The rule's own convention, read off the placed shape: for the axis rules the last
  // control point is a width rather than a vertex, and the panel says so rather than
  // listing four coordinates as though they were four corners of a path.
  const widthPoint =
    graphic.drawRuleName.startsWith("AXIS") && graphic.points.length >= 3;
  const axis = widthPoint
    ? axisComponentsOf(
        graphic.points.slice(0, -1),
        graphic.points[graphic.points.length - 1]!,
      )
    : null;
  const updateGraphicAmplifier = useDemoStore((s) => s.updateGraphicAmplifier);
  const deleteGraphic = useDemoStore((s) => s.deleteGraphic);
  const selectGraphic = useDemoStore((s) => s.selectGraphic);

  // The same scale the overlay drew with, from the store — a different value here would
  // report a feature count for a zoom level nobody is looking at.
  const mapScale = useDemoStore((s) => s.mapScale);
  const result = renderGraphic(graphic.sidc, graphic.points, {
    amplifiers: graphic.amplifiers,
    scale: mapScale,
  });
  const version = fieldsOf(graphic.sidc).version;
  const applicable = modifiersOf(basicIdOf(graphic.sidc), version);
  // The applicable text fields, plus whichever the renderer is asking for — which is
  // usually applicable anyway, but if it ever is not, the field the renderer wants must
  // still be reachable.
  const fields = ALL_AMPLIFIER_KEYS.filter(
    (key) =>
      applicable.has(key) ||
      (graphic.amplifiers[key] ?? "") !== "" ||
      (!result.ok && result.needs === key),
  );

  const featureCount = result.ok ? result.collection.features.length : 0;

  return (
    <section className="panel props">
      <header className="panel__head">
        <h2>{graphic.name}</h2>
        <button
          type="button"
          className="link"
          onClick={() => selectGraphic(null)}
        >
          Back to draft
        </button>
      </header>

      {result.ok ? (
        <p className="hint hint--note">
          Drawn by <code>WebRenderer</code> as{" "}
          <strong>{featureCount} GeoJSON features</strong> — the geometry and every
          stroke, fill and label came from the renderer, computed for these{" "}
          {graphic.points.length} control points.
        </p>
      ) : (
        <p className="hint hint--warn">
          <strong>The renderer refused this geometry.</strong> {result.error}
          {result.needs ? (
            <>
              {" "}
              Fill in <strong>{amplifierNameOf(result.needs)}</strong> below.
            </>
          ) : null}
        </p>
      )}

      <div className="sidc">
        <span className="sidc__group">
          <span className="sidc__digits">{graphic.sidc}</span>
          <span className="sidc__label">sidc</span>
        </span>
      </div>

      <header className="panel__head panel__head--sub">
        <h3>Control points</h3>
        <span className="panel__count">{graphic.points.length}</span>
      </header>
      <ol className="vertices">
        {graphic.points.map(([lng, lat], index) => {
          // Index as key: these are coordinates, two of them can legitimately be equal,
          // and the list is never reordered — only appended to while drawing.
          const isWidth = widthPoint && index === graphic.points.length - 1;
          return (
            <li key={index}>
              <span
                className={
                  isWidth ? "vertices__n vertices__n--width" : "vertices__n"
                }
              >
                {isWidth ? "W" : index + 1}
              </span>
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </li>
          );
        })}
      </ol>
      {widthPoint && axis ? (
        // The two magnitudes point N stands for, in metres, because that is what the
        // operator is actually adjusting when they drag it — a pair of coordinates is
        // the wrong unit for a width and tells them nothing about what dragging it did.
        <p className="hint">
          Point <strong>W</strong> is the rule's width control point, not a vertex:{" "}
          <strong>{(Math.round(axis.across * 2) / 1000).toFixed(1)} km</strong> of corridor
          width and an arrowhead <strong>{Math.round(axis.along).toLocaleString()} m</strong>{" "}
          deep. Drag the yellow handle to change them — it stays on the perpendicular of
          the first leg, where <code>{graphic.drawRuleName}</code> reads it from.
        </p>
      ) : null}

      <header className="panel__head panel__head--sub">
        <h3>Modifiers</h3>
      </header>
      {fields.length === 0 ? (
        <p className="hint">This graphic takes no text modifiers.</p>
      ) : null}
      {fields.map((key) => (
        <label
          className={
            !result.ok && result.needs === key
              ? "field field--amp field--wanted"
              : "field field--amp"
          }
          key={key}
        >
          <span className="field__label">
            <span className="amp__letter">{amplifierLetterOf(key)}</span>
            {amplifierNameOf(key)}
          </span>
          <input
            type="text"
            value={graphic.amplifiers[key] ?? ""}
            maxLength={Math.min(
              AMPLIFIER_MAX_CHARS[key] ?? AMPLIFIER_MAX_CHARS_HARD,
              AMPLIFIER_MAX_CHARS_HARD,
            )}
            placeholder={key === "AM_DISTANCE" ? "2000" : ""}
            title={key === "AM_DISTANCE" ? METRES_HINT : amplifierNameOf(key)}
            onChange={(event) =>
              updateGraphicAmplifier(graphic.id, key, event.target.value)
            }
          />
        </label>
      ))}

      <div className="actions">
        <span className="hint">{graphic.id}</span>
        <button
          type="button"
          className="danger"
          onClick={() => deleteGraphic(graphic.id)}
        >
          Delete graphic
        </button>
      </div>
    </section>
  );
}
