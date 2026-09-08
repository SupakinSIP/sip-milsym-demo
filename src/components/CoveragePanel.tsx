import { coverageReport, headlineComparison } from "../symbology/coverage.js";
import { crosswalk } from "../symbology/crosswalk.js";
import { standardOf } from "../symbology/sidc.js";
import { useDemoStore } from "../state/useDemoStore.js";

/**
 * The comparison this project exists to make.
 *
 * Every number is computed from the renderer's own tables when the panel opens — nothing
 * is quoted from documentation, including `map.army`'s side, which is read out of its
 * generated catalog and cited. See `src/symbology/coverage.ts` for what a "symbol" is
 * counted as and why the restricted comparison is the honest one.
 */

function Row({
  label,
  value,
  note,
  strong = false,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
}): React.JSX.Element {
  return (
    <div className={strong ? "cov__row cov__row--strong" : "cov__row"}>
      <span className="cov__label">{label}</span>
      <span className="cov__value">{value}</span>
      {note ? <span className="cov__note">{note}</span> : null}
    </div>
  );
}

export function CoveragePanel(): React.JSX.Element {
  const standardId = useDemoStore((s) => s.draft.standardId);
  const report = coverageReport();
  const headline = headlineComparison(standardId);
  // Always 2525D: the crosswalk table is 2525C-to-2525D, so running it against another
  // version would be comparing map.army with a standard the table was not written for.
  const crossed = crosswalk(standardOf("2525D").version);
  const baseline = report.baseline;

  return (
    <section className="panel cov">
      <header className="panel__head">
        <h2>Coverage</h2>
        <span className="panel__count">measured, not quoted</span>
      </header>

      <div className="cov__headline">
        <strong>{headline.iconParts.toLocaleString()}</strong>
        <span>
          warfighting icon parts in {headline.standardLabel}, against{" "}
          <strong>{headline.theirs.toLocaleString()}</strong> in map.army —{" "}
          <strong>{headline.iconPartRatio.toFixed(2)}×</strong>
        </span>
      </div>
      <Row
        label="Base entities with artwork"
        value={`${headline.entities.toLocaleString()} · ${headline.entityRatio.toFixed(2)}×`}
        note="MSLookup rows in the warfighting-equivalent sets, less the category nodes"
      />
      <Row
        label="+ sector modifiers"
        value={
          headline.modifiersCounted
            ? `${headline.modifierIcons.toLocaleString()}`
            : "unavailable"
        }
        note="SVGLookup ids at digits 17-20, drawn inside the frame"
      />
      <p className="hint hint--note">
        {/* This is the paragraph the whole panel is for. */}
        Counting base entities alone puts this{" "}
        <strong>{headline.entityRatio < 1 ? "below" : "above"}</strong> map.army —{" "}
        {headline.entityRatio.toFixed(2)}× — and that comparison is unsound in a way
        worth being precise about. 2525C puts a symbol&apos;s whole specificity in one
        function id, so <em>Infantry</em>, <em>Infantry Airborne</em> and{" "}
        <em>Infantry Mountain</em> are three of milsymbol&apos;s icon-part keys and three
        of map.army&apos;s 927. 2525D splits the same information into an entity plus up
        to two sector modifiers, so those three are <em>one</em> MSLookup row and two
        modifier icons. Entities against icon-part keys counts one library&apos;s
        entities against the other&apos;s entities and variants together.
      </p>
      <p className="hint">
        Neither figure is &ldquo;pictures that can be drawn&rdquo;: that is entities ×
        modifier&nbsp;1 × modifier&nbsp;2 × 7 affiliations × 6 statuses × 28
        echelon-or-mobility values, which is large and says nothing. Counting every set
        the tables hold, rather than the warfighting-equivalent ones, gives{" "}
        {headline.ourTotal.toLocaleString()} entities for this standard and{" "}
        {report.unionSymbols.toLocaleString()} across all four — but that adds control
        measures and weather, which is a scope difference, not a coverage one.
      </p>

      <header className="panel__head panel__head--sub">
        <h3>map.army — the baseline</h3>
      </header>
      <Row label="Standard" value={baseline.standard} />
      <Row label="Renderer" value={baseline.renderer} />
      <Row label="Coding scheme" value={baseline.codingScheme} />
      <Row label="Catalog nodes" value={baseline.catalogNodes.toLocaleString()} />
      <Row
        label="…of which structural"
        value={`−${baseline.structuralNodes}`}
        note="tree joints that render as a bare frame"
      />
      <Row
        label="Drawable symbols"
        value={baseline.drawableSymbols.toLocaleString()}
        strong
      />
      <p className="hint cov__source">{baseline.source}</p>

      <header className="panel__head panel__head--sub">
        <h3>mil-sym-ts — per standard</h3>
      </header>
      <div className="cov__table" role="table">
        <div className="cov__tr cov__tr--head" role="row">
          <span>standard</span>
          <span title="distinct base entities in the whole version">entities</span>
          <span title="warfighting-equivalent entities with artwork of their own">wf</span>
          <span title="sector-modifier icons in those sets">mods</span>
          <span title="entities + modifiers — comparable to map.army's 911">parts</span>
          <span title="entities that can be placed as a single-point marker">point</span>
        </div>
        {report.standards.map((standard) => (
          <div
            className={
              standard.id === standardId ? "cov__tr cov__tr--on" : "cov__tr"
            }
            role="row"
            key={standard.id}
          >
            <span title={`version ${standard.version}`}>{standard.id}</span>
            <span>
              {standard.symbols.toLocaleString()}
              {standard.duplicateRows > 0 ? (
                <em
                  className="cov__dupe"
                  title={`getIDList returned ${standard.rows} rows; ${standard.duplicateRows} repeated a base symbol already listed`}
                >
                  +{standard.duplicateRows}
                </em>
              ) : null}
            </span>
            <span title={`${standard.warfighting} entities, ${standard.warfighting - standard.warfightingDrawable} of them category nodes with no artwork`}>
              {standard.warfightingDrawable.toLocaleString()}
            </span>
            <span>{standard.warfightingModifierIcons.toLocaleString()}</span>
            <span className="cov__parts">
              {standard.warfightingIconParts.toLocaleString()}
            </span>
            <span>{standard.point.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <p className="hint">
        A <em className="cov__dupe">+n</em> marks rows the lookup tables repeat verbatim —
        carried rather than hidden, so these totals reconcile with counting{" "}
        <code>getIDList</code> by hand.
      </p>

      <header className="panel__head panel__head--sub">
        <h3>All four together</h3>
      </header>
      <Row
        label="Distinct base symbols"
        value={report.unionSymbols.toLocaleString()}
        strong
      />
      <Row
        label="Warfighting-equivalent"
        value={report.unionWarfighting.toLocaleString()}
      />
      <Row
        label="By geometry"
        value={`${report.unionPoint.toLocaleString()} point · ${report.unionLine.toLocaleString()} line · ${report.unionArea.toLocaleString()} area`}
        note="only point symbols can be placed in this demo"
      />
      <Row label="Symbol sets" value={String(report.unionSymbolSets)} />
      <Row
        label="In all four standards"
        value={report.commonToAll.toLocaleString()}
      />
      <Row
        label="In exactly one"
        value={report.standards
          .map((s) => `${s.id} ${report.exclusive[s.id] ?? 0}`)
          .join(" · ")}
      />

      <header className="panel__head panel__head--sub">
        <h3>Which symbols differ</h3>
      </header>
      <p className="hint">
        Every one of map.army&apos;s {crossed.rows.length} drawable keys put through{" "}
        <code>C2DLookup.getDCode</code> — the standard&apos;s own 2525C→2525D migration
        table, shipped with the renderer. Not a name match.
      </p>
      <Row
        label="Mapped to a 2525D entity"
        value={crossed.mapped.length.toLocaleString()}
        note={`onto ${crossed.distinctTargets} distinct entities — ${crossed.keysPerEntity.toFixed(2)} 2525C keys each`}
      />
      <Row
        label="Mapped, entity not held"
        value={String(crossed.mappedButMissing.length)}
        note="the table answered with a code MSLookup does not have"
      />
      <Row
        label="No successor in the table"
        value={crossed.unmapped.length.toLocaleString()}
      />
      <Row
        label="…but found in 2525D by name"
        value={crossed.unmappedWithNameMatch.length.toLocaleString()}
        note="weaker evidence than the table — a text match, not a mapping"
      />
      <Row
        label="…nothing found either way"
        value={String(crossed.unmappedAndUnnamed.length)}
        strong
      />
      <p className="hint hint--note">
        So <strong>map.army has essentially no symbol this cannot draw.</strong> The{" "}
        {crossed.unmapped.length} keys with no successor are gaps in the{" "}
        <em>migration table</em>, not in 2525D:{" "}
        {crossed.unmappedWithNameMatch.length} have a plain 2525D equivalent by name, and
        the table never maps into Land Installations at all even though{" "}
        <code>20121301 Airport/Air Base</code> is right there. Only{" "}
        {crossed.unmappedAndUnnamed.length} resolve to nothing —{" "}
        {crossed.unmappedAndUnnamed.map((row) => row.name).join(", ")} — and those most
        likely exist under a name this search does not reach.
      </p>
      <p className="hint">
        The {crossed.keysPerEntity.toFixed(2)} figure is the coverage argument, measured:
        2525C spends nearly two function ids where 2525D spends one entity plus sector
        modifiers. Twenty-three separate 2525C keys land on the single 2525D
        unmanned-aircraft entity.
      </p>

      <header className="panel__head panel__head--sub">
        <h3>The other direction</h3>
      </header>
      <p className="hint">
        milsymbol draws {baseline.milsymbolTotalKeys.toLocaleString()} icon-part keys in
        total and <strong>{baseline.milsymbolSchemeGKeys}</strong> of them are tactical
        graphics — one bridge and twelve incident points, no boundary, phase line,
        obstacle or minefield. map.army answers that with a hand-authored table of{" "}
        {baseline.tacticalGraphics} graphics: a name and an abbreviation on geometry the
        operator draws. mil-sym-ts carries{" "}
        <strong>
          {(
            report.sets.find((s) => s.code === "25")?.count ?? 0
          ).toLocaleString()}
        </strong>{" "}
        control-measure entities with the standard&apos;s own artwork.
      </p>
      <p className="hint cov__source">{baseline.graphicsSource}</p>

      <header className="panel__head panel__head--sub">
        <h3>Union by symbol set</h3>
      </header>
      <div className="cov__table" role="table">
        {report.sets.map((set) => (
          <div
            className={set.warfighting ? "cov__tr" : "cov__tr cov__tr--off"}
            role="row"
            key={set.code}
            title={set.excludedBecause ?? "counted as warfighting-equivalent"}
          >
            <span className="cov__set">{set.code}</span>
            <span className="cov__setname">{set.name}</span>
            <span>{set.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <p className="hint">
        Dimmed sets are outside 2525C&apos;s warfighting scheme, so they are excluded from
        the like-for-like figure. Hover a row for which scheme it belongs to.
      </p>
    </section>
  );
}
