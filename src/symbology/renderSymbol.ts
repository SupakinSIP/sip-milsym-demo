import {
  MilStdAttributes,
  MilStdIconRenderer,
} from "@armyc2.c5isr.renderer/mil-sym-ts-web";
import { amplifierMapOf, type Amplifiers } from "./amplifiers.js";

/**
 * Thin wrapper over mil-sym-ts: SIDC + amplifiers → SVG.
 *
 * This is the port of `@map-army/symbology`'s `renderSymbol.ts`, and it keeps that
 * module's shape deliberately — same call signature, same returned box, same memo, same
 * reasoning about the key — because everything above it in `sip-map-army` is written
 * against *this contract* rather than against milsymbol. The marker reconciler, the
 * anchor arithmetic and the canvas export do not know which renderer is underneath;
 * swapping one for the other is this file and nothing else. That is the claim the demo
 * exists to test, and it holds.
 *
 * ### What changed underneath, and what did not
 *
 * `new ms.Symbol(sidc, opts).asSVG()` became
 * `MilStdIconRenderer.getInstance().RenderSVG(sidc, modifiers, attributes)`, which is
 * three differences worth naming:
 *
 * 1. **Two maps instead of one options object.** The renderer separates *modifiers*
 *    (what the symbol says — the text amplifiers) from *attributes* (how it is drawn —
 *    size, colours, outline). milsymbol puts both in `SymbolOptions`. The split is the
 *    better one: the memo key below can treat them as the two independent halves they
 *    are.
 * 2. **It can return null.** milsymbol always draws something — an unrecognised SIDC
 *    gets a bare frame. mil-sym-ts consults its lookup tables and returns `null` for a
 *    code they have no entry for, which is a real answer and is handled as one below
 *    rather than thrown.
 * 3. **The renderer must be awake.** See `renderer.ts`. This function stays
 *    synchronous, which is what lets the reconciler stay a plain loop.
 *
 * What did not change is the half that matters to the callers: same arguments, same
 * returned box, pure, and memoised on everything that can change the picture.
 *
 * ### One promise the reference package makes that this one cannot
 *
 * `@map-army/symbology` says of its wrapper that "`asSVG()` is DOM-free, so this is safe
 * during SSR as well as in the browser". **That is not true of this file, and it fails
 * quietly rather than loudly.** mil-sym-ts measures text with a canvas — it calls
 * `document.createElement("canvas")` the first time a symbol is rendered — and with no
 * `document` it logs `document is not defined` at `INFO`, catches its own exception, and
 * returns *a symbol anyway*: the bare frame, with no staff, no echelon and no lettering.
 * Run under Node, a battalion headquarters with four amplifiers comes back as the same
 * 507-byte plain frame as a bare infantry icon, with the same box and the same anchor,
 * and nothing on the call path throws.
 *
 * So this module is browser-only, and anything asserting against it has to run in one.
 * `scripts/smoke-browser.ts` is that check, and the reason it is a page driven by a
 * headless browser rather than a Node test.
 */

export interface RenderOptions {
  size?: number;
  /**
   * The text amplifiers drawn around the frame.
   *
   * Keyed by `Modifiers`' own constants, which is what lets this be passed through
   * rather than translated — the same arrangement, for the same reason, as
   * `@map-army/symbology` keying them by milsymbol's `SymbolOptions` names.
   */
  amplifiers?: Amplifiers;
  /**
   * An operator-chosen frame fill, or null/absent for the affiliation's own colour.
   *
   * Passed as `MilStdAttributes.FillColor`, which overrides the fill and leaves the
   * frame's shape and the icon alone — the same contract the milsymbol wrapper's
   * `fillColor` has.
   */
  fillColor?: string | null;
  /**
   * Draw a contrasting outline around the whole symbol.
   *
   * Has no counterpart in the milsymbol wrapper, because milsymbol has no such option:
   * `sip-map-army` gets the same effect from a CSS `drop-shadow` on the marker's SVG.
   * Kept as an option here because this renderer does it properly — the outline follows
   * the glyph's own strokes rather than blurring the whole picture — and because a
   * symbol drawn over aerial imagery needs it.
   */
  outline?: boolean;
}

export interface RenderedSymbol {
  svg: string;
  width: number;
  height: number;
  /**
   * Where the symbol's own point sits inside that box, in pixels from its top-left
   * corner.
   *
   * **Not the centre, and for a headquarters not even close to it.** Both renderers
   * anchor a staffed symbol at the *foot of the staff*, because that is the point the
   * manual puts the command post at, and both grow the box upward for an echelon
   * marker without moving the frame. mil-sym-ts reports it as
   * `getSymbolCenterX/Y()` — "the point the image should be centered on", in its own
   * words — where milsymbol reports it as `getAnchor()`.
   *
   * Returned rather than recomputed by callers: the box and the anchor come from the
   * same render, and a caller deriving one from the other would be guessing at a layout
   * only the renderer knows.
   */
  anchorX: number;
  anchorY: number;
  /**
   * Whether the renderer had an answer for this code at all.
   *
   * False means the lookup tables have no entry for the SIDC *at this version* — a
   * 2525E-only entity asked for under APP-6(D), most often — and that `svg` is the
   * empty string. The demo draws a placeholder rather than a gap, because a mark that
   * vanishes is indistinguishable from one that was never placed.
   */
  drawn: boolean;
}

const cache = new Map<string, RenderedSymbol>();

const EMPTY_MODIFIERS = new Map<string, string>();

const DEFAULT_SIZE = 32;

function build(sidc: string, options: RenderOptions): RenderedSymbol {
  const size = options.size ?? DEFAULT_SIZE;
  const attributes = new Map<string, string>();
  attributes.set(MilStdAttributes.PixelSize, String(size));
  // Without this, a wide symbol and a tall one are both squeezed into a square of
  // `PixelSize` and a map of mixed symbol sets reads at two different scales.
  attributes.set(MilStdAttributes.KeepUnitRatio, "true");
  // Null and absent both mean "the affiliation's own", which is what the renderer
  // already does when the attribute is not given — so it is omitted rather than
  // passed as null.
  if (options.fillColor) {
    attributes.set(MilStdAttributes.FillColor, options.fillColor);
  }
  if (options.outline) {
    attributes.set(MilStdAttributes.OutlineSymbol, "true");
  }
  const modifiers = options.amplifiers
    ? amplifierMapOf(options.amplifiers)
    : EMPTY_MODIFIERS;

  const image = MilStdIconRenderer.getInstance().RenderSVG(
    sidc,
    modifiers,
    attributes,
  );
  if (!image) {
    // A square the size that was asked for, anchored at its centre, so a caller that
    // ignores `drawn` still gets a box it can lay out against instead of a NaN.
    return {
      svg: "",
      width: size,
      height: size,
      anchorX: size / 2,
      anchorY: size / 2,
      drawn: false,
    };
  }
  const bounds = image.getImageBounds();
  return {
    svg: image.getSVG(),
    width: bounds.getWidth(),
    height: bounds.getHeight(),
    anchorX: image.getSymbolCenterX(),
    anchorY: image.getSymbolCenterY(),
    drawn: true,
  };
}

/**
 * The memo key.
 *
 * **Everything that can change the picture is in it, and that is the half that has to
 * stay complete.** A field left out of the key is a field whose edit renders from the
 * cache: the operator types, the store updates, and the symbol on the map does not
 * change. `@map-army/symbology` records that trap in its own words and the marker layer
 * records it twice more; it is the same trap here.
 *
 * The SIDC carries eight of the fields on its own — affiliation, status, echelon and
 * the rest are digits *in the string* — so keying on it covers all of them for free.
 * What has to be added by hand is everything passed beside it: the size, the two
 * attributes, and every amplifier.
 *
 * The amplifiers are stringified from the `Map` the renderer will actually be handed,
 * rather than from the bag, so the key cannot disagree with what is drawn: a value
 * that is trimmed away, or truncated at the hard bound, is trimmed away in the key too.
 * `JSON.stringify` of pairs rather than a concatenation, and that is not fussiness —
 * joined bare, a designation of `"ab"` with no speed and a designation of `"a"` with a
 * speed of `"b"` produce the same string, so one symbol would be served the other's
 * cached SVG.
 */
function keyOf(sidc: string, options: RenderOptions): string {
  const modifiers = options.amplifiers ? amplifierMapOf(options.amplifiers) : null;
  return JSON.stringify([
    sidc,
    options.size ?? DEFAULT_SIZE,
    options.fillColor ?? "",
    options.outline === true,
    modifiers ? [...modifiers].sort(([a], [b]) => (a < b ? -1 : 1)) : [],
  ]);
}

/**
 * Throw the memo away.
 *
 * The key covers everything that can change the picture *for a given renderer state*.
 * `RendererSettings` is renderer state — the text background method, the label font —
 * and it is global, the same for every entry, so a change to it is answered by emptying
 * the cache rather than by widening the key. That is both cheaper and honest about what
 * happened: those entries were drawn under a setting that no longer holds.
 *
 * Same call, same reasoning, as `@map-army/symbology`'s `resetRenderCache` — which
 * exists there for the Thai lettering toggle.
 */
export function resetRenderCache(): void {
  cache.clear();
}

/** How many symbols the memo is currently holding. Shown in the demo's status bar. */
export function renderCacheSize(): number {
  return cache.size;
}

export function renderSymbol(
  sidc: string,
  options: RenderOptions = {},
): RenderedSymbol {
  const key = keyOf(sidc, options);
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const rendered = build(sidc, options);
  cache.set(key, rendered);
  return rendered;
}
