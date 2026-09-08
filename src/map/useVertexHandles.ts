import { useEffect } from "react";
import type { Map as MlMap, Marker } from "maplibre-gl";
import maplibregl from "maplibre-gl";
import { selectedHasWidthPoint, useDemoStore } from "../state/useDemoStore.js";

/**
 * Draggable handles on the vertices of the selected shape.
 *
 * ### The mechanism this demo was missing
 *
 * The geometry was right before this and the *interaction* still felt wrong, and the
 * reason turned out to be in map.army's own Point Editor documentation rather than in any
 * renderer: a placed multipoint graphic there stays editable. Its points are handles you
 * drag, and two modes let you insert a point or delete one. Quoted:
 *
 * > "If this function is switched on, a new point is inserted for the selected graphic
 * > each time you click on the map." … "If this function is switched on, each time you
 * > click on a point in the marked graphic, it will be removed." … "Editing is terminated
 * > with the space bar or the symbol is discarded with the Esc key."
 *
 * A shape that can only be deleted and redrawn is a shape nobody adjusts, and that is
 * what this demo offered: the vertices were *shown* for a conformant graphic and were not
 * touchable. Drawing was therefore a one-shot gesture that had to be right first time —
 * which, for a graphic whose anchor rule is not a path, it almost never is.
 *
 * ### Markers rather than a circle layer
 *
 * The conformant overlay already draws the selected shape's vertices as a MapLibre
 * `circle` layer, and those are fine to *look* at but cannot be dragged: a layer has no
 * per-feature drag. `maplibregl.Marker` has `setDraggable`, so each handle is one marker
 * and dragging is free and correct — including the part where the map must not pan while
 * a handle is moving.
 *
 * Reconciled by index rather than rebuilt: a handle that was replaced mid-drag would drop
 * the gesture, which is the same reason the marker layer reconciles its marks.
 */

interface Handle {
  marker: Marker;
  element: HTMLDivElement;
  index: number;
}

/** The points of whichever shape is selected, and which list it came from. */
function selectedPoints(): readonly [number, number][] | null {
  const state = useDemoStore.getState();
  if (state.selectedSketchId) {
    return (
      state.sketches.find((s) => s.id === state.selectedSketchId)?.points ?? null
    );
  }
  if (state.selectedGraphicId) {
    return (
      state.graphics.find((g) => g.id === state.selectedGraphicId)?.points ??
      null
    );
  }
  return null;
}

export function useVertexHandles(map: MlMap | null, ready: boolean): void {
  useEffect(() => {
    if (!map || !ready) {
      return;
    }
    const handles: Handle[] = [];

    const sync = (): void => {
      const points = selectedPoints();
      const mode = useDemoStore.getState().editMode;
      const wanted = points ?? [];

      // Trim first, so a shape that lost a point does not leave a handle behind on the
      // coordinate it used to occupy.
      while (handles.length > wanted.length) {
        handles.pop()?.marker.remove();
      }

      // map.army colours its width handle differently from its vertices, and the reason
      // is not decoration: the two do different things. Its vertices move the shape; the
      // one handle that is yellow **changes a magnitude**, and dragging it as though it
      // were a vertex is how an operator discovers that a graphic can be destroyed by
      // adjusting it. So the last handle of an axis graphic is yellow and lettered `W`,
      // and the store rebuilds it on the perpendicular rather than dropping it where the
      // pointer let go.
      const widthHandle = selectedHasWidthPoint(useDemoStore.getState())
        ? wanted.length - 1
        : -1;

      wanted.forEach((point, index) => {
        let handle = handles[index];
        if (!handle) {
          const element = document.createElement("div");
          element.className = "vhandle";
          const marker = new maplibregl.Marker({
            element,
            anchor: "center",
            draggable: true,
          })
            .setLngLat(point)
            .addTo(map);

          const commit = (): void => {
            const { lng, lat } = marker.getLngLat();
            useDemoStore.getState().moveVertex(index, lng, lat);
          };
          marker.on("drag", commit);
          marker.on("dragend", commit);

          element.addEventListener("click", (event) => {
            // Remove mode consumes the click on a handle. Stopping propagation matters:
            // without it the map's own handler would also insert a point, so a single
            // click would delete one vertex and add another.
            event.stopPropagation();
            if (useDemoStore.getState().editMode === "remove") {
              useDemoStore.getState().removeVertex(index);
            }
          });

          handle = { marker, element, index };
          handles[index] = handle;
        }
        handle.marker.setLngLat(point);
        // Dragging is off in remove mode, or a click that lands a pixel off registers as
        // a tiny drag and the vertex moves instead of disappearing.
        // The width point is not removable, so remove mode leaves it draggable: a
        // handle that greys out for a mode it is exempt from reads as broken, and one
        // that accepts the click and does nothing reads as a missed hit.
        const isWidth = index === widthHandle;
        handle.marker.setDraggable(mode !== "remove" || isWidth);
        handle.element.classList.toggle(
          "vhandle--remove",
          mode === "remove" && !isWidth,
        );
        handle.element.classList.toggle("vhandle--width", isWidth);
        handle.element.textContent = isWidth ? "W" : String(index + 1);
        handle.element.title = isWidth
          ? "The width control point — drag it out from the arrowhead to widen the corridor"
          : `Point ${index + 1}`;
      });
    };

    sync();
    const unsubscribe = useDemoStore.subscribe(sync);

    return () => {
      unsubscribe();
      for (const handle of handles) {
        handle.marker.remove();
      }
      handles.length = 0;
    };
  }, [map, ready]);
}
