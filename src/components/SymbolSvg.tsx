import { renderSymbol, type Amplifiers } from "../symbology/index.js";

/**
 * One rendered symbol, in a box the size the renderer said it needs.
 *
 * The single place in the demo that puts renderer output into the React tree, which is
 * why the `dangerouslySetInnerHTML` argument lives here rather than in four components.
 * The SVG is built by mil-sym-ts from the SIDC and the amplifier map: everything the
 * operator typed reaches it as **text nodes inside markup the renderer wrote**, so a
 * `<script>` typed into a unique designation is drawn as those nine characters rather
 * than parsed as an element. Nothing else is interpolated into the string.
 *
 * `sip-map-army` sets `innerHTML` in the reconciler for the same reason and takes the
 * same care; the marker layer here is its port and does it there.
 */
export function SymbolSvg({
  sidc,
  size,
  amplifiers,
  fillColor,
  outline,
}: {
  sidc: string;
  size: number;
  amplifiers?: Amplifiers;
  fillColor?: string | null;
  outline?: boolean;
}): React.JSX.Element {
  const rendered = renderSymbol(sidc, { size, amplifiers, fillColor, outline });

  if (!rendered.drawn) {
    return (
      <span
        className="glyph glyph--missing"
        style={{ width: rendered.width, height: rendered.height }}
        title="This version's lookup tables have no entry for this SIDC"
      >
        ?
      </span>
    );
  }

  return (
    <span
      className="glyph"
      style={{ width: rendered.width, height: rendered.height }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: rendered.svg }}
    >
      {/* The anchor overlay is a sibling of the SVG rather than part of it, so it can
          never end up in anything exported. */}
    </span>
  );
}

/**
 * The same symbol with the renderer's own numbers drawn over it: the image box, and the
 * point inside it the symbol belongs to.
 *
 * This is the view that makes the anchor argument concrete. Draw a plain infantry frame
 * and the dot is in the middle; set digit 8 to Headquarters and the box grows downward
 * while the dot stays at the foot of the staff, which is metres away from the centre at
 * map scale. `markerOffset` is the arithmetic that turns the second picture into a mark
 * standing on its coordinate.
 */
export function SymbolSvgWithAnchor({
  sidc,
  size,
  amplifiers,
  fillColor,
  outline,
}: {
  sidc: string;
  size: number;
  amplifiers?: Amplifiers;
  fillColor?: string | null;
  outline?: boolean;
}): React.JSX.Element {
  const rendered = renderSymbol(sidc, { size, amplifiers, fillColor, outline });
  return (
    <span
      className="glyph glyph--measured"
      style={{ width: rendered.width, height: rendered.height }}
    >
      {rendered.drawn ? (
        <span
          className="glyph__svg"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: rendered.svg }}
        />
      ) : (
        <span className="glyph--missing">?</span>
      )}
      <span
        className="glyph__anchor"
        style={{ left: rendered.anchorX, top: rendered.anchorY }}
      />
    </span>
  );
}
