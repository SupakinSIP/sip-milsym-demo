import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  AFFILIATIONS,
  DEFAULT_FIELDS,
  STANDARDS,
  canRender,
  catalogOf,
  composeSidc,
  drawableCountOf,
  searchCatalog,
  standardOf,
  type CatalogEntry,
} from "../symbology/index.js";
import { SymbolSvg } from "./SymbolSvg.js";

/**
 * Every symbol in a standard, drawn.
 *
 * The point of this view is comparison by eye rather than by number: the coverage panel
 * says 2,019 entities and 1,860 of them have artwork, and this is where someone puts that
 * next to map.army's picker and checks. So it draws **all** of them — no result cap, no
 * point-symbols filter, every symbol set in the version — and labels each one with its
 * eight-digit id so a row can be found on either side.
 *
 * ### Lazy per cell, because 2,019 renders in one frame is not a page
 *
 * Each cell renders when it scrolls within 600px of the viewport and never again:
 * `renderSymbol` memoises, so scrolling back up costs a map lookup. One
 * `IntersectionObserver` for the whole grid rather than one per cell — two thousand
 * observers is its own performance problem — with the callback dispatching through a map
 * from element to setter.
 *
 * ### Line and area symbols are in here too
 *
 * `MilStdIconRenderer` draws control measures and weather as **preview icons**: the
 * renderer's own documentation says so ("for multi-point graphics, modifiers are ignored
 * because we don't need that information to show preview icons in the SymbolPicker"). So
 * a phase line appears as the line-with-label glyph a picker shows, not as a boundary
 * across a map — that needs `WebRenderer` and a geometry. Worth knowing while comparing:
 * the artwork is there and the multipoint drawing path is not what this demo does.
 */

const CELL_SIZE = 34;
const OBSERVER_MARGIN = "600px 0px";

/** Element → "you are visible now", so one observer can serve every cell. */
type Revealers = Map<Element, () => void>;

function LazyCell({
  entry,
  sidc,
  size,
  revealers,
  observer,
  drawn,
}: {
  entry: CatalogEntry;
  sidc: string;
  size: number;
  revealers: Revealers;
  observer: IntersectionObserver | null;
  drawn: boolean;
}): React.JSX.Element {
  const host = useRef<HTMLLIElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = host.current;
    if (!element || !observer || visible) {
      return;
    }
    revealers.set(element, () => setVisible(true));
    observer.observe(element);
    return () => {
      revealers.delete(element);
      observer.unobserve(element);
    };
  }, [observer, revealers, visible]);

  return (
    <li
      ref={host}
      className={drawn ? "gcell" : "gcell gcell--frameonly"}
      title={`${entry.path} / ${entry.name}\n${entry.basicId} · ${entry.geometry}${
        drawn ? "" : "\nno artwork — CanRender() says false, this is the bare frame"
      }`}
    >
      <span className="gcell__glyph">
        {visible ? <SymbolSvg sidc={sidc} size={size} /> : null}
      </span>
      <span className="gcell__id">{entry.basicId}</span>
      <span className="gcell__name">{entry.name}</span>
    </li>
  );
}

/**
 * The gallery's own URL parameters, read once at mount.
 *
 * `?view=gallery&std=APP6E&geom=line&q=phase` is a link to one corner of one standard,
 * which is what someone comparing two applications actually sends: not "open the gallery"
 * but "look at the control measures in APP-6(E)". Same reasoning as `?sample` and
 * `?rail=coverage`, and the same one-way binding — the controls do not write back to the
 * URL, because a filter that rewrote history on every keystroke would make the back
 * button useless.
 */
function initialFrom(name: string, allowed: readonly string[], fallback: string): string {
  const value = new URLSearchParams(window.location.search).get(name) ?? "";
  return allowed.includes(value) ? value : fallback;
}

export function GalleryView(): React.JSX.Element {
  const [standardId, setStandardId] = useState(() =>
    initialFrom("std", STANDARDS.map((s) => s.id), "2525D"),
  );
  const [affiliation, setAffiliation] = useState(DEFAULT_FIELDS.affiliation);
  const [geometry, setGeometry] = useState(() =>
    initialFrom("geom", ["point", "line", "area"], ""),
  );
  const [size, setSize] = useState(CELL_SIZE);
  const [hideFrameOnly, setHideFrameOnly] = useState(false);
  const [text, setText] = useState(
    () => new URLSearchParams(window.location.search).get("q") ?? "",
  );
  const deferredText = useDeferredValue(text);

  const standard = standardOf(standardId);
  const catalog = useMemo(() => catalogOf(standard.version), [standard.version]);
  const drawableCount = useMemo(
    () => drawableCountOf(standard.version),
    [standard.version],
  );

  const revealers = useRef<Revealers>(new Map());
  const [observer, setObserver] = useState<IntersectionObserver | null>(null);
  useEffect(() => {
    const held = revealers.current;
    const created = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            held.get(entry.target)?.();
          }
        }
      },
      { rootMargin: OBSERVER_MARGIN },
    );
    setObserver(created);
    return () => {
      created.disconnect();
      held.clear();
    };
  }, []);

  const groups = useMemo(() => {
    // The whole catalog, filtered but never capped — the limit is the entry count
    // itself, because a gallery that quietly stopped at 120 would understate the
    // coverage it exists to show.
    const { rows } = searchCatalog(catalog, {
      text: deferredText,
      symbolSet: "",
      geometry,
      limit: catalog.entries.length,
    });
    const kept = hideFrameOnly
      ? rows.filter((entry) => canRender(entry.basicId, standard.version))
      : rows;
    // Grouped by symbol set and, inside it, left in the catalog's own order — which is
    // by path, so a branch stays together and reads like the standard's own tables.
    const bySet = new Map<string, { name: string; rows: CatalogEntry[] }>();
    for (const entry of kept) {
      const group = bySet.get(entry.symbolSet);
      if (group) {
        group.rows.push(entry);
      } else {
        bySet.set(entry.symbolSet, {
          name: entry.symbolSetName,
          rows: [entry],
        });
      }
    }
    return [...bySet.entries()]
      .map(([code, group]) => ({ code, ...group }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [catalog, deferredText, geometry, hideFrameOnly, standard.version]);

  const shown = groups.reduce((total, group) => total + group.rows.length, 0);
  const fields = { ...DEFAULT_FIELDS, version: standard.version, affiliation };

  return (
    <div className="gallery">
      <header className="gallery__bar">
        <label className="check check--select">
          <span>Standard</span>
          <select
            value={standardId}
            onChange={(event) => setStandardId(event.target.value)}
          >
            {STANDARDS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="check check--select">
          <span>Affiliation</span>
          <select
            value={affiliation}
            onChange={(event) => setAffiliation(Number(event.target.value))}
          >
            {AFFILIATIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="check check--select">
          <span>Geometry</span>
          <select
            value={geometry}
            onChange={(event) => setGeometry(event.target.value)}
          >
            <option value="">All</option>
            <option value="point">Point</option>
            <option value="line">Line</option>
            <option value="area">Area</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={hideFrameOnly}
            onChange={(event) => setHideFrameOnly(event.target.checked)}
          />
          <span title="CanRender() is false for these — they are category nodes that draw as the bare affiliation frame, the same thing map.army excludes as its 16 structural nodes">
            Hide the {(catalog.entries.length - drawableCount).toLocaleString()}{" "}
            without artwork
          </span>
        </label>
        <label className="check check--select">
          <span>Size</span>
          <input
            type="range"
            min={24}
            max={64}
            value={size}
            onChange={(event) => setSize(Number(event.target.value))}
          />
        </label>
        <input
          className="gallery__search"
          type="search"
          value={text}
          placeholder="filter…"
          onChange={(event) => setText(event.target.value)}
        />
        <span className="gallery__stat">
          {shown.toLocaleString()} shown · {catalog.entries.length.toLocaleString()}{" "}
          in {standard.id} · {drawableCount.toLocaleString()} with artwork
        </span>
      </header>

      <div className="gallery__scroll">
        {groups.map((group) => (
          <section className="gset" key={group.code}>
            <h3 className="gset__head">
              <span className="gset__code">{group.code}</span>
              {group.name}
              <span className="gset__count">{group.rows.length}</span>
            </h3>
            <ul className="gset__grid" style={{ "--cell": `${size + 46}px` } as React.CSSProperties}>
              {group.rows.map((entry) => (
                <LazyCell
                  key={entry.basicId}
                  entry={entry}
                  sidc={composeSidc(entry.basicId, fields)}
                  size={size}
                  revealers={revealers.current}
                  observer={observer}
                  drawn={canRender(entry.basicId, standard.version)}
                />
              ))}
            </ul>
          </section>
        ))}
        {shown === 0 ? (
          <p className="hint">Nothing matches that filter in {standard.label}.</p>
        ) : null}
      </div>
    </div>
  );
}
