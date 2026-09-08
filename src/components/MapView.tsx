import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MlMap, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useDemoStore } from "../state/useDemoStore.js";
import { useMilsymMarkers } from "../map/useMilsymMarkers.js";
import { useGraphicOverlay } from "../map/useGraphicOverlay.js";
import { scaleForCamera } from "../map/markerOffset.js";
import { useSketchOverlay } from "../sketch/useSketchOverlay.js";
import { useVertexHandles } from "../map/useVertexHandles.js";

/**
 * The map the symbols are drawn on.
 *
 * A cut-down `MapView` from `sip-map-army`: one map, one click handler, one marker
 * layer. What it drops is the infrastructure — that application reads its tiles from a
 * Martin server it ships in Docker, its terrain from a DEM it generates with Planetiler,
 * and its basemap provider from an environment variable. None of that can be part of a
 * demo that runs with nothing behind it.
 *
 * ### Two basemaps, and why the plain one is not a placeholder
 *
 * **Liberty** is OpenFreeMap's hosted vector style: no API key, no account, and the one
 * thing in this demo that needs a network. **Plain** is a single `background` layer
 * generated here, so the demo works with the network unplugged.
 *
 * Plain is worth having for a second reason. Symbol artwork is drawn to be read over
 * *terrain* — the affiliation colours are pale fills with dark strokes, tuned against
 * aerial and topographic backgrounds — and judging a renderer's output over a flat grey
 * field tells you almost nothing about whether an operator can read it. Having both a
 * pixel apart is how you find that out. If the hosted style cannot be reached, the map
 * falls back to Plain and says so rather than showing an empty container.
 */

const PLAIN_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#e8e5df" } },
  ],
};

const LIBERTY_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export type BasemapId = "liberty" | "plain";

/** Bangkok and the upper gulf — somewhere with coastline, so a symbol has context. */
const START = { center: [100.52, 13.74] as [number, number], zoom: 8 };

/**
 * The opening camera, overridable from the URL as `?z=12&at=100.5,13.7`.
 *
 * Same justification as `?sample` and `?rail`: this is a demo whose whole job is to be
 * looked at, and "look at this at that zoom" is the most common thing anyone needs to
 * say about it. It is also the only way a headless browser can photograph the same
 * graphics at three zoom levels, which is how the screen-space ornament was proved
 * constant.
 */
function cameraFromUrl(): { center: [number, number]; zoom: number } {
  const params = new URLSearchParams(window.location.search);
  const zoom = Number(params.get("z"));
  const at = (params.get("at") ?? "").split(",").map(Number);
  return {
    center:
      at.length === 2 && at.every((n) => Number.isFinite(n))
        ? [at[0]!, at[1]!]
        : START.center,
    zoom: Number.isFinite(zoom) && zoom >= 1 && zoom <= 22 ? zoom : START.zoom,
  };
}

export function MapView({ basemap }: { basemap: BasemapId }): React.JSX.Element {
  const container = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const [fellBack, setFellBack] = useState(false);

  useEffect(() => {
    if (!container.current) {
      return;
    }
    const instance = new maplibregl.Map({
      container: container.current,
      style: basemap === "liberty" ? LIBERTY_STYLE_URL : PLAIN_STYLE,
      center: cameraFromUrl().center,
      zoom: cameraFromUrl().zoom,
      // The demo's whole point is a symbol standing on a coordinate, and the anchor
      // arithmetic is what puts it there — so the pitch control is on and the leader
      // line has something to do.
      pitch: 0,
      attributionControl: { compact: true },
    });
    instance.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    instance.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    // A click on the map adds a vertex while a shape is being drawn, places a mark
    // otherwise, and clears the selection when placing is off. A click on a marker or on
    // a graphic never reaches here — those handlers stop it.
    instance.on("click", (event) => {
      const store = useDemoStore.getState();
      if (store.sketching) {
        store.addSketchPoint(event.lngLat.lng, event.lngLat.lat);
        return;
      }
      if (store.drawing) {
        store.addDrawingPoint(event.lngLat.lng, event.lngLat.lat);
        return;
      }
      // Editing a placed shape takes precedence over placing a new mark: the operator
      // has something selected and has switched the tool on, so a click is an edit.
      if (
        store.editMode === "add" &&
        (store.selectedSketchId || store.selectedGraphicId)
      ) {
        store.insertVertex(event.lngLat.lng, event.lngLat.lat);
        return;
      }
      if (store.placing) {
        store.place(event.lngLat.lng, event.lngLat.lat);
      } else {
        store.select(null);
      }
    });

    // Double-click finishes a shape. MapLibre also zooms on double-click, and a shape
    // that jumped a zoom level on its last gesture would be unusable — so the zoom is
    // suppressed while drawing and restored after.
    instance.on("dblclick", (event) => {
      const store = useDemoStore.getState();
      if (store.sketching) {
        event.preventDefault();
        store.finishSketch();
        return;
      }
      if (store.drawing) {
        event.preventDefault();
        store.finishDrawing();
      }
    });

    /**
     * The renderer's scale, kept current with the camera.
     *
     * On `zoomend` rather than on `zoom`: re-rendering a decorated line costs real
     * trigonometry — an obstacle line at a close zoom is tens of thousands of coordinates
     * — and doing it per frame of a pinch would drop the gesture. So the ornament stretches
     * with the ground *during* a zoom and snaps to its proper size when the gesture ends,
     * which is the behaviour a fixed scale never gave at any zoom.
     *
     * `moveend` as well, because a long pan changes the latitude and the Mercator stretch
     * with it.
     */
    const pushScale = (): void => {
      useDemoStore
        .getState()
        .setMapScale(
          scaleForCamera(instance.getZoom(), instance.getCenter().lat),
        );
    };
    pushScale();
    instance.on("zoomend", pushScale);
    instance.on("moveend", pushScale);

    // Ready is not gated on `load`, deliberately, and that was a bug before it was a
    // comment.
    //
    // `sip-map-army` waits for `load` before its marker effect runs, and it has to: that
    // application adds sources and layers — hillshade, the shape overlay, the safety fan
    // — and a style that has not arrived has nothing to add them to. The marks here are
    // `maplibregl.Marker`s, which are DOM elements over the canvas and need no style; the
    // graphic overlay does add layers, and waits for `styledata` itself.
    //
    // Gated on `load`, the whole map went blank the moment the hosted tiles were slow or
    // unreachable: the style never finished, `load` never fired, and five marks that had
    // nothing to do with the basemap were never drawn.
    setReady(true);
    instance.on("error", (event) => {
      // A hosted style that will not load is the one failure this demo can actually
      // hit, and it must not leave a blank container: fall back to the offline style
      // and let the header say what happened.
      const message = String(event?.error?.message ?? "");
      if (basemap === "liberty" && /style|fetch|load|network/i.test(message)) {
        setFellBack(true);
        instance.setStyle(PLAIN_STYLE);
      }
    });

    setMap(instance);
    return () => {
      instance.remove();
      setMap(null);
      setReady(false);
    };
  }, [basemap]);

  useMilsymMarkers(map, ready);
  useGraphicOverlay(map, ready);
  useSketchOverlay(map, ready);
  useVertexHandles(map, ready);

  /**
   * The keyboard: **space finishes a shape, Escape discards it**, and Escape also leaves
   * an editing mode.
   *
   * Those are map.army's keys, from its Point Editor documentation — "Editing is
   * terminated with the space bar or the symbol is discarded with the Esc key" — and they
   * are better than the double-click this demo had. A double-click has to fight the map's
   * own zoom, cannot be pressed while the cursor is somewhere useful, and gives no way to
   * say "discard" rather than "finish". Double-click still works, because muscle memory
   * from every other drawing tool expects it.
   *
   * On the window rather than the canvas: the operator may well have the cursor over a
   * panel when they decide the shape is done.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const store = useDemoStore.getState();
      const typing =
        event.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName);
      if (typing) {
        return;
      }
      if (event.key === " ") {
        if (store.sketching) {
          event.preventDefault();
          store.finishSketch();
        } else if (store.drawing) {
          event.preventDefault();
          store.finishDrawing();
        } else if (store.editMode !== "move") {
          event.preventDefault();
          store.setEditMode("move");
        }
        return;
      }
      if (event.key === "Escape") {
        if (store.sketching) {
          store.cancelSketch();
        } else if (store.drawing) {
          store.cancelDrawing();
        } else if (store.editMode !== "move") {
          store.setEditMode("move");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="map">
      <div className="map__canvas" ref={container} />
      {fellBack ? (
        <p className="map__note" role="status">
          Hosted basemap unavailable — drawing over the offline plain style.
        </p>
      ) : null}
    </div>
  );
}
