import { drawRuleTextOf } from "../symbology/index.js";
import {
  axisWidthCheck,
  orderPointsForRule,
} from "../symbology/renderGraphic.js";
import { sketchKindOf } from "../sketch/kinds.js";
import { useDemoStore } from "../state/useDemoStore.js";

/**
 * What the click about to be made means, for the rules where it is not a path.
 *
 * Only the two axis rules, and only because their point order was **measured**. They are
 * labelled in the order an operator naturally clicks — rear, along the axis, then a width
 * — and `orderPointsForRule` turns that into the tip-first order the rule actually wants.
 * Every other rule shows the standard's own text instead of a label invented here: a
 * per-click label is a claim about geometry, and there are 67 rules to be wrong about.
 */
function clickLabel(
  ruleName: string,
  index: number,
  minPoints: number,
): string | null {
  if (!ruleName.startsWith("AXIS")) {
    return null;
  }
  // The **clicked** order, which is the natural one: an attack arrow is drawn from where
  // you are toward the objective. `orderPointsForRule` flips it into the tip-first order the
  // rule wants on the way to the renderer, so the operator never has to click backwards.
  if (index === 0) {
    return "the rear of the axis — where the attack starts";
  }
  if (index < minPoints - 1) {
    return "along the axis, toward the objective";
  }
  return "the width — one click off the arrowhead, perpendicular to the axis";
}

/**
 * What the map is waiting for, and **what the next click means**.
 *
 * `sip-map-army` has a component of this name because a map that silently changes what a
 * click does is a map the operator has to guess at. This one carries a second job, and it
 * is the more important of the two.
 *
 * ### The anchor point rule is on screen because the clicks are not a path
 *
 * A tactical graphic's control points are not "the shape you want", they are the inputs
 * the standard defines for that graphic, and they differ per rule. `AREA1` is the
 * intuitive case — click the boundary of the area. `AXIS2`, which is Main Attack, is not:
 *
 * > Point 1 defines the tip of the arrowhead. Point N-1 defines the rear of the symbol.
 * > Point N defines the back of the arrowhead. … Point N determines the width.
 *
 * Collected as a tail-to-tip path, that graphic comes out backwards with its last click
 * eaten as a width — which is what this demo drew until the rules were read out of the
 * library. 67 distinct rules apply across 2525D's line and area entities, so rather than
 * encode 67 gestures, the rule's own text is shown while the operator clicks.
 *
 * The text is the standard's, quoted through `DRAW_RULE_TEXT` — generated from the
 * library's declarations, never paraphrased, because a paraphrased anchor rule is a guess
 * about geometry.
 */
/**
 * The sketch tool's own bar.
 *
 * Deliberately shorter than the conformant one, and the brevity is the point: there is no
 * anchor point rule to explain because the clicks *are* the shape. If this bar ever needs
 * a paragraph of instruction, the sketch geometry has stopped being what it claims to be.
 */
function SketchHint(): React.JSX.Element | null {
  const sketching = useDemoStore((s) => s.sketching);
  const finishSketch = useDemoStore((s) => s.finishSketch);
  const cancelSketch = useDemoStore((s) => s.cancelSketch);
  if (!sketching) {
    return null;
  }
  const kind = sketchKindOf(sketching.kindId);
  if (!kind) {
    return null;
  }
  const have = sketching.points.length;
  const enough = have >= kind.minPoints;
  return (
    <div className="drawhint drawhint--sketch" role="status">
      <div className="drawhint__row">
        <span className="drawhint__name">{kind.label}</span>
        <span className="drawhint__geom">sketch</span>
        <span className="drawhint__count">
          {have} point{have === 1 ? "" : "s"}
        </span>
        <span className="drawhint__how">
          {enough
            ? "click to extend · space to finish"
            : `click ${kind.minPoints - have} more along the path`}
        </span>
        <button type="button" onClick={finishSketch} disabled={!enough}>
          Finish
        </button>
        <button type="button" className="link" onClick={cancelSketch}>
          Discard (Esc)
        </button>
      </div>
      <p className="drawhint__anchors">
        Drawn by <code>src/sketch</code> along the clicked path — not conformant
        MIL-STD-2525 geometry. Stands in for <strong>{kind.standardEntity}</strong>.
      </p>
    </div>
  );
}

export function DrawHintBar(): React.JSX.Element | null {
  const drawing = useDemoStore((s) => s.drawing);
  const sketching = useDemoStore((s) => s.sketching);
  const finishDrawing = useDemoStore((s) => s.finishDrawing);
  const cancelDrawing = useDemoStore((s) => s.cancelDrawing);

  if (sketching) {
    return <SketchHint />;
  }
  if (!drawing) {
    return null;
  }

  const have = drawing.points.length;
  const enough = have >= drawing.minPoints;
  // The tables use a very large number for "as many as you like", so a cap is only worth
  // mentioning when it is a real one.
  const capped = drawing.maxPoints < 100;
  const rule = drawRuleTextOf(drawing.drawRuleName);
  const next = clickLabel(drawing.drawRuleName, have, drawing.minPoints);
  // Checked while drawing, not after: once the width point is placed too far out the
  // renderer throws the centre line away, and an arrow drawn from a discarded path is
  // not obviously wrong on screen — it is just a thin wedge somewhere else.
  // Against the **reordered** points, or the check measures the wrong leg: the renderer
  // takes the perpendicular from the width point to the line out of the *tip*, and in
  // clicked order the first point is the rear.
  const width = axisWidthCheck(
    drawing.drawRuleName,
    orderPointsForRule(drawing.drawRuleName, drawing.points),
  );

  return (
    <div className="drawhint" role="status">
      <div className="drawhint__row">
        <span className="drawhint__name">{drawing.name}</span>
        <span className="drawhint__geom">{drawing.geometry}</span>
        <span
          className="drawhint__rule"
          title="MSInfo.getDrawRule() — the standard's anchor point rule for this graphic"
        >
          {drawing.drawRuleName}
        </span>
        <span className="drawhint__count">
          point {have + 1} of {drawing.minPoints}
          {capped ? `–${drawing.maxPoints}` : "+"}
        </span>
        <span className="drawhint__how">
          {next
            ? `next click: ${next}`
            : enough
              ? capped && have >= drawing.maxPoints
                ? "complete"
                : "click to add more · space to finish"
              : `click ${drawing.minPoints - have} more`}
        </span>
        <button
          type="button"
          onClick={finishDrawing}
          disabled={!enough}
          title={
            enough
              ? "Commit the shape"
              : "The renderer refuses a geometry with too few control points"
          }
        >
          Finish
        </button>
        <button type="button" className="link" onClick={cancelDrawing}>
          Discard (Esc)
        </button>
      </div>
      {width?.collapses ? (
        <p className="drawhint__warn">
          The width point is <strong>{Math.round(width.halfWidthMetres)} m</strong> off the
          centre line and the first leg is only{" "}
          <strong>{Math.round(width.firstLegMetres)} m</strong> long — at that ratio the
          renderer discards the path and draws a stub. Put the width point closer to the
          centre line, or move the second point further from the tip.
        </p>
      ) : null}
      {rule && rule.anchorPoints !== "" ? (
        <p className="drawhint__anchors">
          <strong>{drawing.drawRuleName}:</strong> {rule.anchorPoints}
          {rule.orientation !== "" ? ` ${rule.orientation}` : ""}
          {drawing.drawRuleName.startsWith("AXIS") ? (
            <em>
              {" "}
              These clicks are collected rear-first and reordered into that convention
              before rendering.
            </em>
          ) : null}
        </p>
      ) : (
        <p className="drawhint__anchors">
          {/* 2 of the 89 rules carry no anchor-point text in the declarations. Saying so
              is better than showing an empty bar and letting the operator assume the
              clicks are a path. */}
          <strong>{drawing.drawRuleName}:</strong> the library states no anchor point rule
          for this graphic — the clicks are passed through in the order given.
        </p>
      )}
    </div>
  );
}
