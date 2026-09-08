import { SKETCH_KINDS, sketchKindOf, type SketchGroup } from "../sketch/kinds.js";
import { useDemoStore } from "../state/useDemoStore.js";

/**
 * The sketch palette — the other way to draw a tactical graphic.
 *
 * Grouped by what the operator is doing rather than by symbol set, which is how
 * map.army's palette is arranged and, more to the point, how the question arrives:
 * "offensive line" is what somebody wants; "Control Measure, set 25, rule AXIS2, four
 * points including a width" is what the standard needs to hear.
 *
 * ### The banner is not boilerplate
 *
 * These shapes are drawn by `src/sketch`, not by mil-sym-ts, and that has to be visible
 * *before* somebody uses one on a map other people read. `sip-map-army` refused to
 * approximate this family for exactly that reason, and it was right to; this demo shows
 * both so the difference can be seen, which only works if the difference is stated.
 */

const GROUPS: readonly SketchGroup[] = [
  "Offensive",
  "Defensive",
  "Obstacles",
  "Coordination",
];

/** A small preview of the shape, drawn by the same geometry that draws it on the map. */
function Preview({ kindId }: { kindId: string }): React.JSX.Element | null {
  const kind = sketchKindOf(kindId);
  if (!kind) {
    return null;
  }
  const points = kind.closed
    ? [
        { x: 8, y: 8 },
        { x: 52, y: 6 },
        { x: 54, y: 26 },
        { x: 10, y: 28 },
        { x: 8, y: 8 },
      ]
    : [
        { x: 6, y: 26 },
        { x: 28, y: 12 },
        { x: 56, y: 18 },
      ];
  const drawn = kind.draw(points, kind.lettered ? "A" : "");
  return (
    <svg className="spal__preview" viewBox="0 0 62 34" width="62" height="34">
      {drawn.fills.map((fill, index) => (
        <path key={`f${index}`} d={fill.d} fill={kind.colour} />
      ))}
      {drawn.strokes.map((stroke, index) => (
        <path
          key={`s${index}`}
          d={stroke.d}
          fill="none"
          stroke={kind.colour}
          strokeWidth={kind.width * 0.7}
          strokeDasharray={stroke.dash}
          strokeLinejoin="round"
        />
      ))}
      {drawn.labels.map((label, index) => (
        <text
          key={`l${index}`}
          x={label.at.x}
          y={label.at.y}
          fill={kind.colour}
          fontSize="8"
          fontWeight="700"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {label.text}
        </text>
      ))}
    </svg>
  );
}

export function SketchPalette(): React.JSX.Element {
  const sketching = useDemoStore((s) => s.sketching);
  const startSketch = useDemoStore((s) => s.startSketch);
  const sketches = useDemoStore((s) => s.sketches);

  return (
    <section className="panel spal">
      <header className="panel__head">
        <h2>Sketch</h2>
        <span className="panel__count">{sketches.length} drawn</span>
      </header>

      <p className="hint hint--warn">
        <strong>Drawn by this project, not by mil-sym-ts.</strong> Click the path you can
        see and the shape follows it — no anchor point rule, no width point, and the
        ornament stays the same size at every zoom. The cost is that these are{" "}
        <em>approximations</em>, not conformant MIL-STD-2525 symbols. Use the{" "}
        <strong>Symbol</strong> tab for the standard&apos;s own geometry.
      </p>

      {GROUPS.map((group) => (
        <div key={group}>
          <header className="panel__head panel__head--sub">
            <h3>{group}</h3>
          </header>
          <ul className="spal__list">
            {SKETCH_KINDS.filter((kind) => kind.group === group).map((kind) => (
              <li key={kind.id}>
                <button
                  type="button"
                  className={
                    sketching?.kindId === kind.id
                      ? "spal__item spal__item--on"
                      : "spal__item"
                  }
                  onClick={() => startSketch(kind.id)}
                  title={`Stands in for ${kind.standardEntity}\n${kind.minPoints}+ clicks`}
                >
                  <Preview kindId={kind.id} />
                  <span className="spal__label">{kind.label}</span>
                  <span className="spal__pts">{kind.minPoints}+</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
