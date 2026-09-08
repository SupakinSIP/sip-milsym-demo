import { useEffect, useRef } from "react";
import type { Map as MlMap, Marker } from "maplibre-gl";
import maplibregl from "maplibre-gl";
import { renderSymbol } from "../symbology/index.js";
import { useDemoStore, type PlacedSymbol } from "../state/useDemoStore.js";
import { LEADER_LENGTH_PX, MARKER_SIZE_PX, markerOffset } from "./markerOffset.js";

/**
 * Placed symbols as MapLibre HTML markers, kept in sync with the store.
 *
 * The port of `sip-map-army`'s `useMilxMarkers`, minus the features that need a server
 * (image marks, layer visibility, presence, the safety-distance fan) and with the
 * renderer swapped. **The reconciler itself did not change**, and the reason it did not
 * is the point of the demo: it is written against `renderSymbol`'s returned box, not
 * against milsymbol.
 *
 * ### Reconciled, not rebuilt
 *
 * Markers are created once per id and then **patched** — never torn down and rebuilt on
 * every store change. That is not an optimisation: the element MapLibre is dragging must
 * not be swapped out mid-gesture, or the drag ends the moment the store updates, which
 * it does on every frame of the drag.
 *
 * ### The trap this file exists to avoid
 *
 * A reconciler only touches what it **tracks**. Every field below that ends in `Key` is
 * there because something was once changed in the store and did not change on the map:
 * the operator typed, the state updated, the render was served from the memo on an
 * unchanged key, and the element was left exactly as it was. The reference application
 * records that failure three times in its own comments — for the amplifiers, for the
 * image scale, and for the lettering toggle. Every input to the picture is in
 * `glyphKeyOf`, or it is a bug waiting for someone to notice.
 */

/**
 * What a mark's glyph is drawn from, as one comparable string.
 *
 * Must cover exactly what `renderSymbol`'s own memo key covers, or the two come apart
 * and the symptom is an edit that changes the store and not the map. The SIDC carries
 * the eight frame fields as digits, so this is the SIDC, the fill, the outline setting,
 * and every amplifier.
 */
function glyphKeyOf(symbol: PlacedSymbol, outline: boolean): string {
  return JSON.stringify([
    symbol.sidc,
    symbol.fillColor ?? "",
    outline,
    Object.entries(symbol.amplifiers)
      .filter(([, value]) => (value ?? "") !== "")
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  ]);
}

interface MarkerEntry {
  marker: Marker;
  el: HTMLDivElement;
  glyph: HTMLDivElement;
  /** What the glyph was last rendered from — see `glyphKeyOf`. */
  glyphKey: string;
  /** The anchor `renderSymbol` reported, in CSS pixels from the element's top left. */
  anchorX: number;
  anchorY: number;
  /** The element's own box, which the anchor is measured inside. */
  boxWidth: number;
  boxHeight: number;
  /**
   * The offset last handed to MapLibre, as a string, so it is set once per change.
   *
   * Tracked for the reason `glyphKey` is: an untracked offset is one that stops
   * following the glyph the moment an amplifier changes the box's size.
   */
  offsetKey: string;
  /** The leader line down to the ground point, present only while the map is pitched. */
  leader: HTMLDivElement | null;
  /** The anchor-and-bounds overlay, present only while that debug view is on. */
  anchorPin: HTMLDivElement | null;
  selected: boolean;
  draggable: boolean;
}

export function useMilsymMarkers(map: MlMap | null, ready: boolean): void {
  /**
   * The pitch, mirrored into a ref the sync can read.
   *
   * The lift is a function of the *camera*, which changes without the store changing —
   * so the sync is also called from a `pitch` listener, and it needs the current value
   * from somewhere that is not React state (setting state on every pitch frame would
   * re-run this effect and tear every marker down).
   */
  const pitchedRef = useRef(false);

  useEffect(() => {
    if (!map || !ready) {
      return;
    }

    const markers = new Map<string, MarkerEntry>();

    const sync = (): void => {
      const { symbols, selectedId, outline, showAnchors } =
        useDemoStore.getState();
      const lift = pitchedRef.current ? LEADER_LENGTH_PX : 0;
      const seen = new Set<string>();

      for (const symbol of symbols) {
        seen.add(symbol.id);
        const isSelected = symbol.id === selectedId;
        let entry = markers.get(symbol.id);

        if (!entry) {
          const el = document.createElement("div");
          el.className = "mark";
          const glyph = document.createElement("div");
          glyph.className = "mark__glyph";
          el.appendChild(glyph);
          // Stop propagation, or the click falls through to the map's own handler and
          // selecting a mark also places a new one underneath it.
          el.addEventListener("click", (event) => {
            event.stopPropagation();
            useDemoStore.getState().select(symbol.id);
          });

          const marker = new maplibregl.Marker({ element: el, anchor: "center" })
            .setLngLat([symbol.lng, symbol.lat])
            .addTo(map);
          // Live-commit the position while dragging rather than only on drop, so
          // anything that follows the mark follows it during the gesture.
          const commit = (): void => {
            const { lng, lat } = marker.getLngLat();
            useDemoStore.getState().moveSymbol(symbol.id, lng, lat);
          };
          marker.on("drag", commit);
          marker.on("dragend", commit);

          entry = {
            marker,
            el,
            glyph,
            glyphKey: "",
            anchorX: 0,
            anchorY: 0,
            boxWidth: 0,
            boxHeight: 0,
            offsetKey: "",
            leader: null,
            anchorPin: null,
            selected: false,
            draggable: false,
          };
          markers.set(symbol.id, entry);
        }

        const glyphKey = glyphKeyOf(symbol, outline);
        // The box is read on every pass, not only when the SVG is rebuilt:
        // `renderSymbol` memoises, so an unchanged mark costs a Map lookup, and the
        // offset arithmetic below needs the numbers whether or not the glyph changed.
        const rendered = renderSymbol(symbol.sidc, {
          size: MARKER_SIZE_PX,
          amplifiers: symbol.amplifiers,
          fillColor: symbol.fillColor,
          outline,
        });
        entry.anchorX = rendered.anchorX;
        entry.anchorY = rendered.anchorY;
        entry.boxWidth = rendered.width;
        entry.boxHeight = rendered.height;

        if (entry.glyphKey !== glyphKey) {
          // The one place this file writes `innerHTML`, and only when the key says the
          // picture actually changed. The SVG comes from the renderer, not from
          // anything typed — the amplifiers reach it as text nodes inside the SVG it
          // builds, so a `<script>` typed into a designation is drawn as the characters
          // `<script>` rather than parsed as one.
          entry.glyph.innerHTML = rendered.drawn
            ? rendered.svg
            : '<div class="mark__missing" title="This version has no entry for this SIDC">?</div>';
          entry.glyphKey = glyphKey;
        }

        entry.marker.setLngLat([symbol.lng, symbol.lat]);

        // Stand the mark on its own point, and lift it clear of the ground when the
        // camera is pitched — at a steep pitch a glyph sitting flat on its coordinate
        // hides a long way of the ground it is reporting on.
        const offset = markerOffset(rendered, lift);
        const offsetKey = `${offset[0]},${offset[1]}`;
        if (entry.offsetKey !== offsetKey) {
          entry.marker.setOffset(offset);
          entry.offsetKey = offsetKey;
        }

        // The leader line: from the glyph's anchor straight down to the point it was
        // lifted off. Dashed and grey on purpose — a solid vertical line under a unit
        // frame is not decoration in this application, it is the staff of a
        // headquarters, and a leader that looked like one would turn every mark on a
        // pitched map into a command post.
        if (lift > 0 && !entry.leader) {
          const leader = document.createElement("div");
          leader.className = "mark__leader";
          entry.el.appendChild(leader);
          entry.leader = leader;
        } else if (lift === 0 && entry.leader) {
          entry.leader.remove();
          entry.leader = null;
        }
        if (entry.leader) {
          entry.leader.style.setProperty("--leader-x", `${entry.anchorX}px`);
          entry.leader.style.setProperty("--leader-y", `${entry.anchorY}px`);
          entry.leader.style.setProperty("--leader-h", `${lift}px`);
        }

        // The anchor overlay: the box the renderer reported and the point inside it the
        // symbol belongs to. This is the debug view that makes `markerOffset` visible —
        // turn it on, place a headquarters, and the dot is at the foot of the staff
        // while the box's centre is somewhere else entirely.
        if (showAnchors && !entry.anchorPin) {
          const pin = document.createElement("div");
          pin.className = "mark__anchor";
          entry.el.appendChild(pin);
          entry.anchorPin = pin;
        } else if (!showAnchors && entry.anchorPin) {
          entry.anchorPin.remove();
          entry.anchorPin = null;
        }
        if (entry.anchorPin) {
          entry.anchorPin.style.setProperty("--anchor-x", `${entry.anchorX}px`);
          entry.anchorPin.style.setProperty("--anchor-y", `${entry.anchorY}px`);
        }

        if (entry.selected !== isSelected) {
          entry.el.classList.toggle("mark--selected", isSelected);
          entry.selected = isSelected;
        }
        // Only the selected mark is draggable, so a click on a crowded map selects
        // rather than nudges.
        if (entry.draggable !== isSelected) {
          entry.marker.setDraggable(isSelected);
          entry.draggable = isSelected;
        }
      }

      for (const [id, entry] of markers) {
        if (!seen.has(id)) {
          entry.marker.remove();
          markers.delete(id);
        }
      }
    };

    const onCamera = (): void => {
      const pitched = map.getPitch() > 0;
      if (pitched !== pitchedRef.current) {
        pitchedRef.current = pitched;
        sync();
      }
    };

    sync();
    const unsubscribe = useDemoStore.subscribe(sync);
    map.on("pitch", onCamera);

    return () => {
      unsubscribe();
      map.off("pitch", onCamera);
      for (const entry of markers.values()) {
        entry.marker.remove();
      }
      markers.clear();
    };
  }, [map, ready]);
}
