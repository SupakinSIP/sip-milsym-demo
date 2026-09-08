import { useDeferredValue, useMemo, useState } from "react";
import {
  STANDARDS,
  catalogOf,
  clickBudgetForRule,
  composeSidc,
  searchCatalog,
  standardOf,
} from "../symbology/index.js";
import { useDemoStore } from "../state/useDemoStore.js";
import { SymbolSvg } from "./SymbolSvg.js";

/**
 * Which symbol the next mark will be.
 *
 * The counterpart of `sip-map-army`'s `SymbolBrowser`, and the same three controls:
 * pick a standard, search the catalog, click a tile. What is different is where the
 * rows come from — `MSLookup`, live, rather than a generated table — and it shows in
 * one place the operator can see: switching the standard changes the number of rows,
 * because the four versions genuinely know different numbers of entities.
 *
 * ### Every tile is a render
 *
 * A tile is not an icon from a sprite sheet; it is the renderer drawing that entity at
 * that affiliation, on demand. That is only affordable because of two things: the
 * result cap in `searchCatalog`, and `renderSymbol`'s memo — scrolling back up a list
 * re-renders nothing. Change the affiliation and every visible tile is drawn again,
 * which is the honest cost of showing the operator what they are actually about to
 * place rather than a generic frame.
 */

const TILE_SIZE = 34;
const RESULT_LIMIT = 120;

export function SymbolBrowser(): React.JSX.Element {
  const draft = useDemoStore((s) => s.draft);
  const setStandard = useDemoStore((s) => s.setStandard);
  const setBasicId = useDemoStore((s) => s.setBasicId);
  const startDrawing = useDemoStore((s) => s.startDrawing);
  const drawing = useDemoStore((s) => s.drawing);

  const [text, setText] = useState("");
  const [symbolSet, setSymbolSet] = useState("");
  const [pointsOnly, setPointsOnly] = useState(false);

  const standard = standardOf(draft.standardId);
  const catalog = useMemo(() => catalogOf(standard.version), [standard.version]);

  // The query is deferred, not debounced: a keystroke stays instant in the input and
  // React re-runs the search — a few thousand `includes` calls plus up to 120 renders —
  // at whatever rate it can keep up with. A debounce would make the list arrive late
  // even when there is time to spare.
  const deferredText = useDeferredValue(text);
  const { rows, total } = useMemo(
    () =>
      searchCatalog(catalog, {
        text: deferredText,
        symbolSet,
        geometry: pointsOnly ? "point" : "",
        limit: RESULT_LIMIT,
      }),
    [catalog, deferredText, symbolSet, pointsOnly],
  );

  /**
   * What clicking a tile does, which is now two different things.
   *
   * A point symbol becomes the draft — the next click on the map places it. A line or
   * area symbol has no single position to place, so it opens the drawing tool instead:
   * the map starts collecting vertices and the hint bar says how many are still needed.
   *
   * The branch is on the catalog's own `geometry`, not on a guess from the symbol set,
   * because both kinds live in the same sets — set 25 holds points, lines and areas.
   */
  const pick = (entry: (typeof rows)[number]): void => {
    if (entry.geometry === "point") {
      setBasicId(entry.basicId);
      return;
    }
    // The catalog's counts are **control points**; the tool collects **clicks**, and for
    // an axis graphic one control point is derived rather than clicked. Passing the
    // library's number straight through is what made the tool ask for a width click.
    const budget = clickBudgetForRule(
      entry.drawRuleName,
      entry.minPoints,
      entry.maxPoints,
    );
    startDrawing({
      basicId: entry.basicId,
      sidc: composeSidc(entry.basicId, draft.fields),
      name: entry.name,
      geometry: entry.geometry,
      minPoints: budget.minClicks,
      maxPoints: budget.maxClicks,
      drawRuleName: entry.drawRuleName,
    });
  };

  return (
    <section className="panel browser">
      <header className="panel__head">
        <h2>Symbol</h2>
        <span className="panel__count">
          {total.toLocaleString()} of {catalog.entries.length.toLocaleString()}
        </span>
      </header>

      <label className="field">
        <span className="field__label">Standard</span>
        <select
          value={draft.standardId}
          onChange={(event) => setStandard(event.target.value)}
        >
          {STANDARDS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <p className="hint">{standard.note}</p>

      <label className="field">
        <span className="field__label">Search</span>
        <input
          type="search"
          value={text}
          placeholder="infantry, recon, air missile…"
          onChange={(event) => setText(event.target.value)}
        />
      </label>

      <label className="field">
        <span className="field__label">Symbol set</span>
        <select
          value={symbolSet}
          onChange={(event) => setSymbolSet(event.target.value)}
        >
          <option value="">All sets</option>
          {catalog.symbolSets.map((set) => (
            <option key={set.code} value={set.code}>
              {set.code} · {set.name} ({set.count})
            </option>
          ))}
        </select>
      </label>

      <label className="check">
        <input
          type="checkbox"
          checked={pointsOnly}
          onChange={(event) => setPointsOnly(event.target.checked)}
        />
        {/* Off by default now that the multipoint path exists: picking a line or area
            entity starts the drawing tool instead of setting the draft, so the whole
            catalog is reachable from one list. The filter stays because narrowing to
            point symbols is still a useful thing to want. */}
        <span>Point symbols only</span>
      </label>

      {total > rows.length ? (
        <p className="hint">
          Showing the first {rows.length} — narrow the search to see the rest.
        </p>
      ) : null}

      <ul className="tiles">
        {rows.map((entry) => {
          const sidc = composeSidc(entry.basicId, draft.fields);
          const isPicked =
            entry.geometry === "point"
              ? entry.basicId === draft.basicId
              : drawing?.basicId === entry.basicId;
          return (
            <li key={entry.basicId}>
              <button
                type="button"
                className={isPicked ? "tile tile--picked" : "tile"}
                onClick={() => pick(entry)}
                title={`${entry.path}\n${entry.basicId}`}
              >
                <SymbolSvg sidc={sidc} size={TILE_SIZE} />
                <span className="tile__name">{entry.name}</span>
                {/* The symbol set, because the same name is a different symbol in each
                    of them: "Radar" exists in Air, Land Equipment, Sea Surface and
                    Activities, and four tiles reading "Radar" look like a bug in the
                    catalog rather than four entities that genuinely share a word. */}
                <span className="tile__set">{entry.symbolSetName}</span>
                {/* How many clicks it takes, and under which rule — because the catalog
                    holds several graphics of the same name that are drawn differently.
                    "Main Attack" is AXIS2 and "Direction of Attack" is LINE1, and they
                    letter and taper differently. Without this the operator picks by name
                    and gets whichever the search ranked first.

                    Clicks, not control points: an axis graphic's width point is derived,
                    so AXIS2 reads "2+ pts" here while the library's minimum is 3. The
                    number an operator can act on is the number of times they click. */}
                {entry.geometry === "point" ? null : (
                  <span className="tile__rule">
                    {clickBudgetForRule(
                      entry.drawRuleName,
                      entry.minPoints,
                      entry.maxPoints,
                    ).minClicks}
                    {entry.maxPoints > 100
                      ? "+"
                      : `–${
                          clickBudgetForRule(
                            entry.drawRuleName,
                            entry.minPoints,
                            entry.maxPoints,
                          ).maxClicks
                        }`}{" "}
                    pts · {entry.drawRuleName}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 ? (
        <p className="hint">
          Nothing in {standard.label} matches. Try another standard — the four versions
          do not carry the same entities.
        </p>
      ) : null}
    </section>
  );
}
