/**
 * Standing a symbol on its own point.
 *
 * Ported from `sip-map-army`'s `useMilxMarkers.ts` **unchanged** — same function, same
 * four numbers, same arithmetic — and that is the whole finding this file records. The
 * reference application wrote it against milsymbol's `getAnchor()`; it works verbatim
 * against mil-sym-ts's `getSymbolCenterX/Y()`, because both renderers answer the same
 * question in the same units: where inside this image is the point the symbol belongs
 * to.
 */

/**
 * The map scale to hand the multipoint renderer, from the camera.
 *
 * **This exists because hardcoding it was a real bug with a visible symptom.** The
 * renderer generates a decorated line's ornament — the Xs of an obstacle line, the teeth
 * of a belt — at a density derived from `scale`, and it does so *in pixels* before
 * converting to geography. Measured on 2525D's obstacle line over the same two points:
 *
 * | scale     | coordinates returned |
 * | --------- | -------------------- |
 * | 500       | 49,313               |
 * | 50,000    | 494                  |
 * | 5,000,000 | 5                    |
 *
 * So a fixed `scale` bakes the ornament at one zoom level, and every other zoom draws it
 * at the wrong size — it grows with the ground instead of staying put on the screen. The
 * demo passed a constant 50,000 with a comment claiming a graphic that changed with the
 * zoom "would be a different graphic at every zoom level". That was wrong: the *geometry*
 * is the same graphic, and only the ornament's step is a screen quantity, which is why
 * the renderer asks for the scale in the first place.
 *
 * ### The formula
 *
 * `scale` is documented as metres of ground per metre of map — a cartographer's 1:50,000.
 * MapLibre gives metres of ground per **pixel**, so it needs the screen's own resolution
 * to become a ratio:
 *
 * - ground metres per pixel at the equator, zoom 0, is 156543.03392 for a 256px tile;
 * - divided by `2^zoom`, times `cos(latitude)` for the web-Mercator stretch;
 * - times pixels per metre of screen, taken as 96 dpi — `96 / 0.0254 ≈ 3779.5`.
 *
 * 96 dpi is a convention rather than a measurement, and it is the right one to use: the
 * renderer's own pixel arithmetic is CSS pixels, which is what MapLibre reports, so the
 * two agree whatever the physical display is doing.
 */
export function scaleForCamera(zoom: number, latitude: number): number {
  const EQUATOR_METRES_PER_PIXEL = 156_543.033_92;
  const PIXELS_PER_SCREEN_METRE = 96 / 0.0254;
  const groundMetresPerPixel =
    (EQUATOR_METRES_PER_PIXEL * Math.cos((latitude * Math.PI) / 180)) /
    Math.pow(2, zoom);
  return groundMetresPerPixel * PIXELS_PER_SCREEN_METRE;
}

/**
 * How far the glyph is lifted off its ground point when the map is pitched, in screen
 * pixels.
 *
 * **Screen pixels, and a constant, deliberately.** A lift that grew with anything
 * geographic would be a second scale drawn on a map that already has one, and the first
 * thing anybody does with two lengths side by side is compare them. This one measures
 * nothing; it only gets the glyph out of the way of the point it belongs to.
 */
export const LEADER_LENGTH_PX = 28;

/** The size every symbol on the map is rendered at. */
export const MARKER_SIZE_PX = 40;

/**
 * Where to move a `center`-anchored element so the mark's own point lands on the
 * coordinate — and, when the map is pitched, so it sits `lift` pixels above it.
 *
 * Pulled out as a function of four numbers because it is the whole decision: every
 * other line of the reconciler is DOM bookkeeping, and this is the arithmetic that is
 * either right or silently puts a command post in the wrong place.
 *
 * The reason it is needed at all: MapLibre puts the *middle of the element* on the
 * coordinate, and for a headquarters the middle of the element is a patch of sky up and
 * to the right of where the staff foot is drawn. The offset moves the element until the
 * renderer's own anchor lands on the coordinate instead — which for a staffed symbol is
 * the foot of the staff, for an echelon-bearing frame is its centre, and for a plain
 * frame changes nothing.
 */
export function markerOffset(
  box: { width: number; height: number; anchorX: number; anchorY: number },
  lift: number,
): [number, number] {
  return [box.width / 2 - box.anchorX, box.height / 2 - box.anchorY - lift];
}
