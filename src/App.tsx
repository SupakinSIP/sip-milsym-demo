import { useEffect, useState } from "react";
import { initRenderer, renderCacheSize } from "./symbology/index.js";
import { useDemoStore } from "./state/useDemoStore.js";
import { MapView, type BasemapId } from "./components/MapView.js";
import { SymbolBrowser } from "./components/SymbolBrowser.js";
import { PropertiesPanel } from "./components/PropertiesPanel.js";
import { CoveragePanel } from "./components/CoveragePanel.js";
import { GalleryView } from "./components/GalleryView.js";
import { DrawHintBar } from "./components/DrawHintBar.js";
import { SketchPalette } from "./components/SketchPalette.js";
import { EditToolbar } from "./components/EditToolbar.js";

/**
 * The demo, three panels wide: pick a symbol, place it, edit it.
 *
 * `sip-map-army`'s `AppShell` is the layout this follows — a left rail for choosing, the
 * map in the middle, a right rail for the thing selected — because that arrangement is
 * what the work is: an operator picks once and places many times, and the properties of
 * the mark under the cursor belong next to the mark.
 *
 * ### Nothing renders until the renderer is awake
 *
 * `initRenderer()` is awaited before the panels mount, and that gate is the only piece
 * of asynchrony in the whole demo. It buys something specific: `renderSymbol` is
 * synchronous, so the catalog, the tiles, the preview and the marker reconciler are all
 * plain code with no loading state, no suspense boundary and no placeholder frames. One
 * await at the top, or a hundred `if (!ready)` branches underneath.
 */

function useRenderer(): { ready: boolean; error: string | null } {
  const [state, setState] = useState<{ ready: boolean; error: string | null }>({
    ready: false,
    error: null,
  });
  useEffect(() => {
    let live = true;
    initRenderer().then(
      () => {
        if (live) {
          setState({ ready: true, error: null });
        }
      },
      (cause: unknown) => {
        if (live) {
          setState({ ready: false, error: String(cause) });
        }
      },
    );
    return () => {
      live = false;
    };
  }, []);
  return state;
}

export function App(): React.JSX.Element {
  const { ready, error } = useRenderer();
  const [basemap, setBasemap] = useState<BasemapId>("liberty");
  /**
   * The gallery takes the whole window rather than a rail: it draws two thousand symbols,
   * and the point of it is putting them next to another application, which needs width.
   *
   * `?view=gallery` opens straight onto it, and `?rail=coverage` onto the comparison.
   * Worth URLs rather than clicks for the same reason `?sample` is: these are the views
   * the project exists to show someone, and a link is how it gets shown.
   */
  const [view, setView] = useState<"map" | "gallery">(() =>
    new URLSearchParams(window.location.search).get("view") === "gallery"
      ? "gallery"
      : "map",
  );
  const [rail, setRail] = useState<"browse" | "sketch" | "coverage">(() => {
    const asked = new URLSearchParams(window.location.search).get("rail");
    return asked === "coverage" || asked === "sketch" ? asked : "browse";
  });
  const placing = useDemoStore((s) => s.placing);
  const outline = useDemoStore((s) => s.outline);
  const showAnchors = useDemoStore((s) => s.showAnchors);
  const count = useDemoStore((s) => s.symbols.length);
  const setPlacing = useDemoStore((s) => s.setPlacing);
  const setOutline = useDemoStore((s) => s.setOutline);
  const setShowAnchors = useDemoStore((s) => s.setShowAnchors);
  const clearAll = useDemoStore((s) => s.clearAll);
  const seedSample = useDemoStore((s) => s.seedSample);

  // `?sample` opens straight onto the laydown. It exists so a headless browser can
  // photograph the demo with marks on it — there is no other way to reach the button
  // without a click — and it is useful for the same reason a person wants it: sending
  // someone a link that already shows something.
  useEffect(() => {
    if (!ready) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.has("sample")) {
      seedSample();
    }
    /**
     * `?select=sketch-3` or `?select=graphic-2` opens with that shape selected and its
     * point editor showing.
     *
     * The same justification as the other parameters: a link to a shape is how somebody
     * says "look at this one" — and it is the only way a headless browser can photograph
     * the editing handles, which cannot be reached without a click.
     */
    const select = params.get("select");
    if (select) {
      const state = useDemoStore.getState();
      // `sketch` and `graphic` select the first of that kind, which is what a person
      // sharing a link can actually write; the full id works too, for a specific one.
      if (select === "sketch") {
        const first = state.sketches[0];
        if (first) {
          state.selectSketch(first.id);
        }
      } else if (select === "graphic") {
        const first = state.graphics[0];
        if (first) {
          state.selectGraphic(first.id);
        }
      } else if (select.startsWith("sketch-")) {
        state.selectSketch(select);
      } else if (select.startsWith("graphic-")) {
        state.selectGraphic(select);
      }
    }
    const mode = params.get("edit");
    if (mode === "add" || mode === "remove") {
      useDemoStore.getState().setEditMode(mode);
    }
  }, [ready, seedSample]);

  if (error !== null) {
    return (
      <main className="boot boot--failed">
        <h1>The renderer did not start</h1>
        <pre>{error}</pre>
      </main>
    );
  }
  if (!ready) {
    return (
      <main className="boot">
        <h1>Loading mil-sym-ts…</h1>
        <p>
          Populating the 2525D/E and APP-6(D)/(E) lookup tables. They are compiled into
          the library, so this is the last thing that has to happen before the demo is
          fully offline.
        </p>
      </main>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <h1>
          MilSym Demo <span className="topbar__sub">mil-sym-ts · client only</span>
        </h1>
        <nav className="viewtabs">
          <button
            type="button"
            className={view === "map" ? "tab tab--on" : "tab"}
            onClick={() => setView("map")}
          >
            Map
          </button>
          <button
            type="button"
            className={view === "gallery" ? "tab tab--on" : "tab"}
            onClick={() => setView("gallery")}
          >
            Gallery
          </button>
        </nav>
        <div className="topbar__controls">
          {/* The map's controls are hidden in the gallery rather than disabled: none of
              them mean anything to a grid of symbols, and a row of dead checkboxes reads
              as a broken page. */}
          {view === "gallery" ? null : (
            <>
          <label className="check">
            <input
              type="checkbox"
              checked={placing}
              onChange={(event) => setPlacing(event.target.checked)}
            />
            <span>Click map to place</span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={outline}
              onChange={(event) => setOutline(event.target.checked)}
            />
            <span title="MilStdAttributes.OutlineSymbol — the renderer's own halo, which follows the glyph's strokes rather than blurring the picture">
              Outline
            </span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={showAnchors}
              onChange={(event) => setShowAnchors(event.target.checked)}
            />
            <span title="Draw the renderer's reported anchor point over every glyph — the point markerOffset stands on the coordinate">
              Anchor overlay
            </span>
          </label>
          <label className="check check--select">
            <span>Basemap</span>
            <select
              value={basemap}
              onChange={(event) => setBasemap(event.target.value as BasemapId)}
            >
              <option value="liberty">Liberty (hosted)</option>
              <option value="plain">Plain (offline)</option>
            </select>
          </label>
          <span className="topbar__stat">
            {count} mark{count === 1 ? "" : "s"} · {renderCacheSize()} cached
          </span>
          <button type="button" onClick={seedSample}>
            Sample laydown
          </button>
          <button type="button" onClick={clearAll} disabled={count === 0}>
            Clear
          </button>
            </>
          )}
        </div>
      </header>

      {view === "gallery" ? (
        <GalleryView />
      ) : (
      <div className="shell__body">
        <aside className="rail rail--left">
          {/* Two views of the same catalog: one to pick a symbol out of, one to count it.
              Tabs rather than two rails, because the coverage report is read once and the
              browser is used continuously — and side by side, neither would have room. */}
          <nav className="tabs">
            <button
              type="button"
              className={rail === "browse" ? "tab tab--on" : "tab"}
              onClick={() => setRail("browse")}
            >
              Symbol
            </button>
            <button
              type="button"
              className={rail === "sketch" ? "tab tab--on" : "tab"}
              onClick={() => setRail("sketch")}
              title="Graphics drawn by this project — click the path you can see"
            >
              Sketch
            </button>
            <button
              type="button"
              className={rail === "coverage" ? "tab tab--on" : "tab"}
              onClick={() => setRail("coverage")}
            >
              Coverage
            </button>
          </nav>
          {rail === "browse" ? (
            <SymbolBrowser />
          ) : rail === "sketch" ? (
            <SketchPalette />
          ) : (
            <CoveragePanel />
          )}
        </aside>
        <div className="mapcol">
          <DrawHintBar />
          <MapView basemap={basemap} />
          <EditToolbar />
        </div>
        <aside className="rail rail--right">
          <PropertiesPanel />
        </aside>
      </div>
      )}
    </div>
  );
}
