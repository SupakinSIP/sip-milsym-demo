import {
  MSLookup,
  RendererSettings,
  SVGLookup,
  initialize,
  isReady,
} from "@armyc2.c5isr.renderer/mil-sym-ts-web";

/**
 * Waking the C5ISR renderer up, once per page.
 *
 * `@map-army/symbology` has no equivalent of this file, because milsymbol has
 * nothing to wake: it draws from code. mil-sym-ts draws from **lookup tables** —
 * every entity in 2525D/E and APP-6(D)/(E), and every SVG primitive their icons are
 * assembled from — and those tables are what makes the difference between the two
 * renderers structurally, not just in artwork.
 *
 * The tables are bundled *inside* the library rather than fetched, so `initialize()`
 * is a no-op in this build and the whole demo runs with no server behind it. It is
 * still awaited: the day the package goes back to loading its data over the network,
 * a call site that skipped the await is a race that only shows up on a slow link.
 *
 * ### Why the singletons are touched
 *
 * `MSLookup` and `SVGLookup` populate their maps on first `getInstance()`. Doing it
 * here, behind one promise, keeps the first symbol the operator draws from paying for
 * all of it — and keeps `renderSymbol` synchronous, which is what lets the marker
 * reconciler stay a plain loop instead of an async queue.
 */
let ready: Promise<void> | null = null;

export function initRenderer(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await initialize();
      MSLookup.getInstance();
      SVGLookup.getInstance();
      // Text amplifiers are lettered with an outline halo rather than a filled box,
      // because these are drawn over base-map tiles: a white box under every field
      // punches holes in the map picture, an outline survives dark ground cover
      // without hiding any of it.
      RendererSettings.getInstance().setTextBackgroundMethod(
        RendererSettings.TextBackgroundMethod_OUTLINE,
      );
    })();
  }
  return ready;
}

export function rendererIsReady(): boolean {
  return isReady();
}
