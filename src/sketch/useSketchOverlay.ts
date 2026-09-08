import { useEffect } from "react";
import type { Map as MlMap } from "maplibre-gl";
import { sketchKindOf } from "./kinds.js";
import type { Pt } from "./geometry.js";
import { useDemoStore } from "../state/useDemoStore.js";

/**
 * The sketch layer: one SVG over the map, reprojected every frame.
 *
 * ### Why an SVG overlay rather than a GeoJSON source
 *
 * The conformant graphics go into a MapLibre GeoJSON source, because their geometry *is*
 * geography — the renderer computed it in longitude and latitude and every vertex means
 * something on the ground. A sketch is the opposite: its ornament is a **screen**
 * quantity. An arrowhead is 22 pixels, the Xs of a wire obstacle are 26 pixels apart, and
 * a corridor is 16 pixels to either side of the line, at every zoom.
 *
 * Expressed as geography that would have to be recomputed on every zoom change — which is
 * exactly what the conformant path has to do, and why a fixed map scale drew every
 * decorated line at the wrong size until the camera was plumbed through. Expressed in
 * screen space it is free: only the *anchor points* are geographic, and MapLibre projects
 * those for us on every frame.
 *
 * So this hook holds the sketch's `[lng, lat]` vertices, and on each `render` event
 * projects them to pixels and rebuilds the path data. The ornament is therefore constant
 * on screen by construction rather than by arithmetic, and there is nothing to get wrong
 * at a zoom level nobody tested.
 *
 * ### Imperative, like the marker layer
 *
 * `render` fires every animation frame while a map is moving. Putting projected pixels
 * into React state would re-render the tree sixty times a second, so the elements are
 * created once per sketch and their attributes are patched in place — the same
 * reconciliation the marker layer does, for the same reason.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

interface Entry {
  group: SVGGElement;
  strokes: SVGPathElement[];
  fills: SVGPathElement[];
  labels: SVGTextElement[];
  /** What the elements were last built for, so they are only rebuilt on a real change. */
  shapeKey: string;
}

export function useSketchOverlay(map: MlMap | null, ready: boolean): void {
  useEffect(() => {
    if (!map || !ready) {
      return;
    }
    const container = map.getContainer();
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "sketch-layer");
    container.appendChild(svg);

    const entries = new Map<string, Entry>();

    /** Keep the SVG the size of the map, so nothing is clipped after a resize. */
    const resize = (): void => {
      const { width, height } = container.getBoundingClientRect();
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    };
    resize();

    const project = (points: readonly [number, number][]): Pt[] =>
      points.map(([lng, lat]) => {
        const point = map.project([lng, lat]);
        return { x: point.x, y: point.y };
      });

    const draw = (): void => {
      const { sketches, sketching, selectedSketchId } = useDemoStore.getState();
      const seen = new Set<string>();

      const paint = (
        id: string,
        kindId: string,
        points: readonly [number, number][],
        label: string,
        selected: boolean,
        provisional: boolean,
      ): void => {
        const kind = sketchKindOf(kindId);
        if (!kind) {
          return;
        }
        const pixels = project(points);
        // Closed shapes are closed here rather than in the geometry, so the geometry
        // functions stay honest about what they were given.
        const drawn = kind.draw(
          kind.closed && pixels.length > 2 ? [...pixels, pixels[0]!] : pixels,
          label,
        );

        let entry = entries.get(id);
        // The element *counts* are what decide a rebuild — an ornament count changes with
        // the zoom, so this is a real check rather than a formality.
        const shapeKey = `${kindId}:${drawn.strokes.length}:${drawn.fills.length}:${drawn.labels.length}`;
        if (!entry || entry.shapeKey !== shapeKey) {
          entry?.group.remove();
          const group = document.createElementNS(SVG_NS, "g");
          const strokes = drawn.strokes.map(() =>
            document.createElementNS(SVG_NS, "path"),
          );
          const fills = drawn.fills.map(() =>
            document.createElementNS(SVG_NS, "path"),
          );
          const labels = drawn.labels.map(() =>
            document.createElementNS(SVG_NS, "text"),
          );
          for (const element of [...fills, ...strokes, ...labels]) {
            group.appendChild(element);
          }
          svg.appendChild(group);
          entry = { group, strokes, fills, labels, shapeKey };
          entries.set(id, entry);
        }

        const colour = kind.colour;
        const width = kind.width * (selected ? 1.8 : 1);
        entry.group.setAttribute("opacity", provisional ? "0.6" : "1");
        drawn.strokes.forEach((stroke, index) => {
          const element = entry!.strokes[index]!;
          element.setAttribute("d", stroke.d);
          element.setAttribute("fill", "none");
          element.setAttribute("stroke", colour);
          element.setAttribute("stroke-width", String(stroke.width ?? width));
          element.setAttribute("stroke-linejoin", "round");
          element.setAttribute("stroke-linecap", "round");
          if (stroke.dash) {
            element.setAttribute("stroke-dasharray", stroke.dash);
          } else {
            element.removeAttribute("stroke-dasharray");
          }
        });
        drawn.fills.forEach((fill, index) => {
          const element = entry!.fills[index]!;
          element.setAttribute("d", fill.d);
          element.setAttribute("fill", colour);
          element.setAttribute("stroke", "none");
        });
        drawn.labels.forEach((text, index) => {
          const element = entry!.labels[index]!;
          element.textContent = text.text;
          element.setAttribute("x", text.at.x.toFixed(1));
          element.setAttribute("y", text.at.y.toFixed(1));
          element.setAttribute("fill", colour);
          element.setAttribute("class", "sketch-layer__label");
          element.setAttribute("text-anchor", "middle");
          element.setAttribute("dominant-baseline", "middle");
        });
        seen.add(id);
      };

      for (const sketch of sketches) {
        paint(
          sketch.id,
          sketch.kindId,
          sketch.points,
          sketch.label,
          sketch.id === selectedSketchId,
          false,
        );
      }
      // The shape in progress is drawn with the same code at 60% opacity, so what the
      // operator is building looks like what they will get — a preview drawn by different
      // code is a preview that lies.
      if (sketching && sketching.points.length >= 2) {
        paint(
          "sketching",
          sketching.kindId,
          sketching.points,
          sketching.label,
          false,
          true,
        );
      }

      for (const [id, entry] of entries) {
        if (!seen.has(id)) {
          entry.group.remove();
          entries.delete(id);
        }
      }
    };

    draw();
    // `render` rather than `move`: it fires for every frame the map paints, including the
    // easing at the end of a zoom, so the sketch never lags the basemap by a frame.
    map.on("render", draw);
    map.on("resize", resize);
    const unsubscribe = useDemoStore.subscribe(draw);

    return () => {
      unsubscribe();
      map.off("render", draw);
      map.off("resize", resize);
      svg.remove();
      entries.clear();
    };
  }, [map, ready]);
}
