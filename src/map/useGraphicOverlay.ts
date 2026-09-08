import { useEffect } from "react";
import type { GeoJSONSource, Map as MlMap, Marker } from "maplibre-gl";
import maplibregl from "maplibre-gl";
import { renderGraphic, type GraphicFeature } from "../symbology/renderGraphic.js";
import { useDemoStore } from "../state/useDemoStore.js";

/**
 * Tactical graphics on the map: one GeoJSON source, four layers, and the lettering as
 * HTML markers.
 *
 * This is where the answer to "can we actually draw these on our own web map" is either
 * true or not, so it is worth being explicit about which parts are the renderer's work
 * and which are this file's.
 *
 * **The renderer's:** all of the geography and all of the styling. Every feature arrives
 * with `strokeColor`, `strokeWidth`, `fillColor`, `fillOpacity` and its own computed
 * coordinates — the teeth of an obstacle belt, the taper of an axis of advance, the
 * half-circles of a forward line of troops. Nothing here invents a colour or a shape.
 *
 * **This file's:** getting those into MapLibre, which takes three decisions.
 *
 * ### One source, rebuilt, rather than a source per graphic
 *
 * `sip-map-army`'s marker layer reconciles element by element because MapLibre must not
 * have the element it is dragging swapped out mid-gesture. A GeoJSON source has no such
 * constraint: `setData` is a whole-collection swap and there is nothing to drag. So the
 * collection is rebuilt on every store change and handed over in one call, which is both
 * simpler and faster than diffing features — `renderGraphic` memoises, so an unchanged
 * graphic costs a map lookup rather than twelve kilobytes of trigonometry.
 *
 * ### Two line layers, because `line-dasharray` is not data-driven
 *
 * 41 of 2525D's graphic features carry a `strokeDasharray`, and MapLibre's
 * `line-dasharray` cannot take a data expression — it is a paint constant. So there are
 * two line layers with the same colour and width expressions, filtered on whether the
 * feature has a dash array, and the dashed one uses **one** pattern rather than the
 * per-feature values. That is an approximation and the only one in this file: a
 * particular graphic's dash rhythm may not match the standard exactly, while its colour,
 * width, geometry and every other property do.
 *
 * ### The lettering is HTML, not a symbol layer
 *
 * A MapLibre `symbol` layer needs a **glyph source** — a font server — and the offline
 * basemap has none, so text would work on the hosted style and silently vanish on the
 * other. The label features already carry a font, a colour, an outline and pixel offsets,
 * so they are drawn as markers with those applied, which needs nothing fetched. Same
 * decision, for the same reason, as the marker layer lettering Field AH itself.
 */

const SOURCE = "graphics";
const FILL = "graphics-fill";
const LINE = "graphics-line";
const LINE_DASHED = "graphics-line-dashed";
const VERTICES = "graphics-vertices";

/** The in-progress shape, so the operator can see what they have clicked so far. */
const DRAFT_SOURCE = "graphics-draft";
const DRAFT_LINE = "graphics-draft-line";
const DRAFT_POINTS = "graphics-draft-points";

/**
 * An empty collection, cast at the boundary.
 *
 * The renderer's features are parsed from JSON, so their `geometry.type` is `string`
 * where MapLibre's types want the literal union `"Polygon" | "MultiLineString" | ...`.
 * Narrowing it properly would mean validating every feature against the GeoJSON spec on
 * the way through, which would be checking the renderer's own output for a class of
 * mistake it does not make. The cast is at the two `setData` calls and here, and nowhere
 * else.
 */
const EMPTY = { type: "FeatureCollection", features: [] } as unknown as never;

/**
 * A number the renderer gave us, or a fallback.
 *
 * The properties are typed `unknown` on purpose — they come from a JSON parse — and a
 * missing stroke width has to become a number before it reaches a paint expression, or
 * MapLibre drops the whole layer rather than the one feature.
 */
function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value !== "" ? value : fallback;
}

export function useGraphicOverlay(map: MlMap | null, ready: boolean): void {
  useEffect(() => {
    if (!map || !ready) {
      return;
    }

    /** Label markers, keyed by `${graphicId}:${index}` so they can be reconciled. */
    const labels = new Map<string, { marker: Marker; key: string }>();
    let styleReady = false;

    const ensureLayers = (): void => {
      if (!map.getSource(SOURCE)) {
        map.addSource(SOURCE, { type: "geojson", data: EMPTY });
      }
      if (!map.getSource(DRAFT_SOURCE)) {
        map.addSource(DRAFT_SOURCE, { type: "geojson", data: EMPTY });
      }
      if (!map.getLayer(FILL)) {
        map.addLayer({
          id: FILL,
          type: "fill",
          source: SOURCE,
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: {
            // Transparent rather than a default colour when the renderer gave no fill:
            // an area graphic that is only an outline in the standard must not become a
            // filled blob here.
            "fill-color": ["coalesce", ["get", "fillColor"], "rgba(0,0,0,0)"],
            "fill-opacity": ["coalesce", ["get", "fillOpacity"], 0],
          },
        });
      }
      const lineColor = [
        "coalesce",
        ["get", "strokeColor"],
        ["get", "fillColor"],
        "#000000",
      ] as unknown as maplibregl.ExpressionSpecification;
      const lineWidth = [
        "coalesce",
        ["get", "strokeWidth"],
        2,
      ] as unknown as maplibregl.ExpressionSpecification;
      if (!map.getLayer(LINE)) {
        map.addLayer({
          id: LINE,
          type: "line",
          source: SOURCE,
          filter: ["!", ["has", "strokeDasharray"]],
          paint: {
            "line-color": lineColor,
            "line-width": lineWidth,
            "line-opacity": ["coalesce", ["get", "lineOpacity"], 1],
          },
        });
      }
      if (!map.getLayer(LINE_DASHED)) {
        map.addLayer({
          id: LINE_DASHED,
          type: "line",
          source: SOURCE,
          filter: ["has", "strokeDasharray"],
          paint: {
            "line-color": lineColor,
            "line-width": lineWidth,
            "line-opacity": ["coalesce", ["get", "lineOpacity"], 1],
            // The approximation the docblock names. Values in em of line width, so it
            // scales with the stroke the renderer asked for.
            "line-dasharray": [3, 2],
          },
        });
      }
      if (!map.getLayer(DRAFT_LINE)) {
        map.addLayer({
          id: DRAFT_LINE,
          type: "line",
          source: DRAFT_SOURCE,
          filter: ["==", ["geometry-type"], "LineString"],
          paint: {
            "line-color": "#1d4ed8",
            "line-width": 2,
            "line-dasharray": [2, 2],
          },
        });
      }
      if (!map.getLayer(DRAFT_POINTS)) {
        map.addLayer({
          id: DRAFT_POINTS,
          type: "circle",
          source: DRAFT_SOURCE,
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-radius": 4,
            "circle-color": "#1d4ed8",
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
          },
        });
      }
      if (!map.getLayer(VERTICES)) {
        // The finished shape's own control points, shown only for the selected graphic —
        // which is what makes it possible to see *why* a shape looks the way it does.
        map.addLayer({
          id: VERTICES,
          type: "circle",
          source: DRAFT_SOURCE,
          filter: ["==", ["get", "kind"], "vertex"],
          paint: {
            "circle-radius": 3.5,
            "circle-color": "#ffffff",
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#1d4ed8",
          },
        });
      }
      styleReady = true;
    };

    const sync = (): void => {
      if (!styleReady) {
        return;
      }
      const { graphics, drawing, selectedGraphicId, mapScale } =
        useDemoStore.getState();

      const features: GraphicFeature[] = [];
      const wanted = new Set<string>();

      for (const graphic of graphics) {
        const result = renderGraphic(graphic.sidc, graphic.points, {
          amplifiers: graphic.amplifiers,
          lineWidth: graphic.id === selectedGraphicId ? 5 : 3,
          // The camera's scale, not a constant: a decorated line's ornament is generated
          // per screen pixel, so at a fixed scale it is baked at one zoom level and drawn
          // at the wrong size at every other. `MapView` keeps this current on `zoomend`.
          scale: mapScale,
        });
        if (!result.ok) {
          // A graphic the renderer refuses is left to the panel to explain — it holds
          // the message and the field being asked for. Drawing something approximate
          // here instead would be inventing symbology.
          continue;
        }
        for (const feature of result.collection.features) {
          const label = feature.properties["label"];
          if (
            feature.geometry.type === "Point" &&
            typeof label === "string" &&
            label !== ""
          ) {
            // Lettering: an HTML marker rather than a source feature.
            continue;
          }
          features.push({
            ...feature,
            properties: { ...feature.properties, graphicId: graphic.id },
          });
        }
      }

      const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
      source?.setData({ type: "FeatureCollection", features } as never);

      /* ------------------------------------------------- the lettering */

      let index = 0;
      for (const graphic of graphics) {
        const result = renderGraphic(graphic.sidc, graphic.points, {
          amplifiers: graphic.amplifiers,
          lineWidth: graphic.id === selectedGraphicId ? 5 : 3,
          // The camera's scale, not a constant: a decorated line's ornament is generated
          // per screen pixel, so at a fixed scale it is baked at one zoom level and drawn
          // at the wrong size at every other. `MapView` keeps this current on `zoomend`.
          scale: mapScale,
        });
        if (!result.ok) {
          continue;
        }
        for (const feature of result.collection.features) {
          const text = feature.properties["label"];
          if (
            feature.geometry.type !== "Point" ||
            typeof text !== "string" ||
            text === ""
          ) {
            continue;
          }
          const coordinates = feature.geometry.coordinates as [number, number];
          const id = `${graphic.id}:${index++}`;
          wanted.add(id);
          // Everything that decides how it looks, so an unchanged label is not rebuilt.
          const key = JSON.stringify([
            text,
            coordinates,
            feature.properties["fontColor"],
            feature.properties["fontSize"],
            feature.properties["rotation"],
            feature.properties["anchorOffsetX"],
            feature.properties["anchorOffsetY"],
          ]);
          const existing = labels.get(id);
          if (existing && existing.key === key) {
            continue;
          }
          existing?.marker.remove();

          const element = document.createElement("div");
          element.className = "graphic-label";
          element.textContent = text;
          element.style.color = stringOr(feature.properties["fontColor"], "#000");
          element.style.font = `${stringOr(
            feature.properties["fontWeight"],
            "bold",
          )} ${stringOr(feature.properties["fontSize"], "11pt")} ${stringOr(
            feature.properties["fontFamily"],
            "sans-serif",
          )}`;
          const rotation = numberOr(feature.properties["rotation"], 0);
          const marker = new maplibregl.Marker({
            element,
            anchor: "center",
            rotation,
            // The renderer's offsets are in pixels from the anchor point, which is
            // exactly what MapLibre's offset means — so they go straight across.
            offset: [
              numberOr(feature.properties["anchorOffsetX"], 0),
              numberOr(feature.properties["anchorOffsetY"], 0),
            ],
          })
            .setLngLat(coordinates)
            .addTo(map);
          labels.set(id, { marker, key });
        }
      }
      for (const [id, held] of labels) {
        if (!wanted.has(id)) {
          held.marker.remove();
          labels.delete(id);
        }
      }

      /* ------------------------------------------------- the draft and the vertices */

      const draftFeatures: GraphicFeature[] = [];
      if (drawing && drawing.points.length > 0) {
        for (const point of drawing.points) {
          draftFeatures.push({
            type: "Feature",
            properties: { kind: "draft" },
            geometry: { type: "Point", coordinates: point },
          });
        }
        if (drawing.points.length >= 2) {
          draftFeatures.push({
            type: "Feature",
            properties: { kind: "draft" },
            geometry: { type: "LineString", coordinates: drawing.points },
          });
        }
      }
      const selected = graphics.find((g) => g.id === selectedGraphicId);
      if (selected) {
        for (const point of selected.points) {
          draftFeatures.push({
            type: "Feature",
            properties: { kind: "vertex" },
            geometry: { type: "Point", coordinates: point },
          });
        }
      }
      const draftSource = map.getSource(DRAFT_SOURCE) as
        | GeoJSONSource
        | undefined;
      draftSource?.setData({
        type: "FeatureCollection",
        features: draftFeatures,
      } as never);
    };

    const onClickGraphic = (event: maplibregl.MapLayerMouseEvent): void => {
      const id = event.features?.[0]?.properties?.["graphicId"];
      if (typeof id === "string") {
        // Stops the map's own handler from also placing a mark or adding a point.
        event.originalEvent.stopPropagation();
        useDemoStore.getState().selectGraphic(id);
      }
    };

    // The style may already be loaded (a re-run of this effect) or not (first mount), and
    // `addSource` before it is loaded throws. `styledata` also fires when the basemap is
    // switched, which is exactly when the layers need adding back.
    const onStyle = (): void => {
      ensureLayers();
      sync();
    };
    if (map.isStyleLoaded()) {
      onStyle();
    }
    map.on("styledata", onStyle);
    map.on("click", FILL, onClickGraphic);
    map.on("click", LINE, onClickGraphic);
    map.on("click", LINE_DASHED, onClickGraphic);

    const unsubscribe = useDemoStore.subscribe(sync);

    return () => {
      unsubscribe();
      map.off("styledata", onStyle);
      map.off("click", FILL, onClickGraphic);
      map.off("click", LINE, onClickGraphic);
      map.off("click", LINE_DASHED, onClickGraphic);
      for (const held of labels.values()) {
        held.marker.remove();
      }
      labels.clear();
      // Layers before sources, or MapLibre refuses to remove a source still in use.
      for (const layer of [
        FILL,
        LINE,
        LINE_DASHED,
        DRAFT_LINE,
        DRAFT_POINTS,
        VERTICES,
      ]) {
        if (map.getLayer(layer)) {
          map.removeLayer(layer);
        }
      }
      for (const source of [SOURCE, DRAFT_SOURCE]) {
        if (map.getSource(source)) {
          map.removeSource(source);
        }
      }
      styleReady = false;
    };
  }, [map, ready]);
}
