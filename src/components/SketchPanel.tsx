import { sketchKindOf } from "../sketch/kinds.js";
import { polylineLength } from "../sketch/geometry.js";
import { useDemoStore, type PlacedSketch } from "../state/useDemoStore.js";

/**
 * The selected sketch: its label, its vertices, and a plain statement of what it is not.
 *
 * Short, because there is very little to say — which is the point of comparing it with
 * `GraphicPanel`. That one has to report a draw rule, an anchor convention, a refusal
 * state and a modifier the renderer is asking for. This one has a label and a list of
 * clicks, because the clicks *are* the shape.
 *
 * The banner is repeated here rather than only in the palette: somebody arriving at this
 * panel by clicking a shape on the map has not necessarily seen the palette, and "is this
 * conformant symbology?" must be answerable wherever the shape is being looked at.
 */
export function SketchPanel({
  sketch,
}: {
  sketch: PlacedSketch;
}): React.JSX.Element {
  const setSketchLabel = useDemoStore((s) => s.setSketchLabel);
  const deleteSketch = useDemoStore((s) => s.deleteSketch);
  const selectSketch = useDemoStore((s) => s.selectSketch);
  const kind = sketchKindOf(sketch.kindId);

  return (
    <section className="panel props">
      <header className="panel__head">
        <h2>{kind?.label ?? sketch.kindId}</h2>
        <button type="button" className="link" onClick={() => selectSketch(null)}>
          Back to draft
        </button>
      </header>

      <p className="hint hint--warn">
        <strong>A sketch, not a conformant symbol.</strong> Drawn by{" "}
        <code>src/sketch</code> along the clicked path, with its ornament sized in screen
        pixels. It stands in for{" "}
        <strong>{kind?.standardEntity ?? "a 2525D control measure"}</strong>, which the{" "}
        <strong>Symbol</strong> tab draws with the standard&apos;s own geometry.
      </p>

      {kind?.lettered ? (
        <label className="field">
          <span className="field__label">Label</span>
          <input
            type="text"
            value={sketch.label}
            maxLength={24}
            placeholder={kind.id === "objective" ? "FOX" : "A"}
            onChange={(event) => setSketchLabel(sketch.id, event.target.value)}
          />
        </label>
      ) : (
        <p className="hint">This graphic carries no lettering.</p>
      )}

      <header className="panel__head panel__head--sub">
        <h3>Clicked path</h3>
        <span className="panel__count">{sketch.points.length}</span>
      </header>
      <ol className="vertices">
        {sketch.points.map(([lng, lat], index) => (
          <li key={index}>
            <span className="vertices__n">{index + 1}</span>
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </li>
        ))}
      </ol>
      <p className="hint">
        {/* Ground length, from the geometry module's own helper applied to degrees scaled
            at this latitude — a rough figure deliberately, since a sketch is not a
            measurement instrument. */}
        roughly{" "}
        {Math.round(
          polylineLength(
            sketch.points.map(([lng, lat]) => ({
              x: lng * 111.32 * Math.cos((lat * Math.PI) / 180),
              y: lat * 111.32,
            })),
          ),
        )}{" "}
        km along the path
      </p>

      <div className="actions">
        <span className="hint">{sketch.id}</span>
        <button
          type="button"
          className="danger"
          onClick={() => deleteSketch(sketch.id)}
        >
          Delete sketch
        </button>
      </div>
    </section>
  );
}
