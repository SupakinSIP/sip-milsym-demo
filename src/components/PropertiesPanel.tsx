import { useState } from "react";
import {
  AFFILIATIONS,
  AMPLIFIER_DESCRIPTORS,
  AMPLIFIER_KEYS,
  AMPLIFIER_MAX_CHARS,
  AMPLIFIER_MAX_CHARS_HARD,
  CONTEXTS,
  HQTFDS,
  STATUSES,
  amplifierDescriptionOf,
  amplifierLetterOf,
  amplifierNameOf,
  fieldsOf,
  basicIdOf,
  isHeadquarters,
  modifiersOf,
  renderSymbol,
  type FieldOption,
  type SidcFields,
} from "../symbology/index.js";
import {
  draftSidc,
  selectedSymbolOf,
  useDemoStore,
} from "../state/useDemoStore.js";
import { SymbolSvg, SymbolSvgWithAnchor } from "./SymbolSvg.js";
import { GraphicPanel } from "./GraphicPanel.js";

/**
 * The frame fields and the lettering, for whichever symbol is being worked on.
 *
 * `sip-map-army` splits this in two — `SymbolEditorPanel` for the one about to be
 * placed, `MarkPropertiesPanel` for the one already on the map — because over there
 * they differ: a placed mark has a position, a layer, an image, a heading and a
 * document to be saved into. Here they differ in nothing but which action the edit is
 * routed to, so it is one component with a subject, and the header says which.
 *
 * ### The panel is the same shape for both, and that is a claim about the model
 *
 * A mark stores a **SIDC and a bag of amplifiers**, and so does the draft. There is no
 * third representation, no "editing" copy, and no parsed form held beside the string:
 * the selects below read the fields out of the code with `fieldsOf` and write them back
 * with `composeSidc`. That round trip is why an edit cannot leave the code and the
 * picture disagreeing.
 */

const PREVIEW_SIZE = 88;

function FieldSelect({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  options: readonly FieldOption[];
  value: number;
  onChange: (value: number) => void;
}): React.JSX.Element {
  // Only rendered when at least one option carries a group, so an ungrouped field is
  // not wrapped in a pointless optgroup.
  const groups = [...new Set(options.map((o) => o.group).filter(Boolean))];
  return (
    <label className="field">
      <span className="field__label">
        {label} <span className="field__hint">{hint}</span>
      </span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {groups.length > 0
          ? groups.map((group) => (
              <optgroup key={group} label={group}>
                {options
                  .filter((option) => option.group === group)
                  .map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
              </optgroup>
            ))
          : options.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
      </select>
    </label>
  );
}

/**
 * The 20 digits, split into the fields they belong to.
 *
 * Shown because this is a demo of a *standard* as much as of a renderer: watching digit
 * 4 change from 3 to 6 while the frame turns from a friendly rectangle into a hostile
 * diamond is the fastest way to understand what the code is. The groups are the
 * standard's own positions — version, context+identity, symbol set, status, HQTFD,
 * amplifier, entity, and the two sector modifiers.
 */
function SidcReadout({ sidc }: { sidc: string }): React.JSX.Element {
  const groups: { label: string; text: string }[] = [
    { label: "ver", text: sidc.slice(0, 2) },
    { label: "ctx+id", text: sidc.slice(2, 4) },
    { label: "set", text: sidc.slice(4, 6) },
    { label: "sta", text: sidc.slice(6, 7) },
    { label: "hq", text: sidc.slice(7, 8) },
    { label: "amp", text: sidc.slice(8, 10) },
    { label: "entity", text: sidc.slice(10, 16) },
    { label: "mod1", text: sidc.slice(16, 18) },
    { label: "mod2", text: sidc.slice(18, 20) },
  ];
  return (
    <div className="sidc">
      {groups.map((group) => (
        <span className="sidc__group" key={group.label}>
          <span className="sidc__digits">{group.text}</span>
          <span className="sidc__label">{group.label}</span>
        </span>
      ))}
    </div>
  );
}

export function PropertiesPanel(): React.JSX.Element {
  const draft = useDemoStore((s) => s.draft);
  // A selected graphic takes the whole panel: it has vertices rather than a position and
  // no frame fields at all, so there is nothing for the mark editor below to show.
  const selectedGraphic = useDemoStore((s) =>
    s.graphics.find((g) => g.id === s.selectedGraphicId) ?? null,
  );
  const selected = useDemoStore(selectedSymbolOf);
  const outline = useDemoStore((s) => s.outline);
  const showAnchors = useDemoStore((s) => s.showAnchors);
  const [showAllAmplifiers, setShowAllAmplifiers] = useState(false);

  const store = useDemoStore.getState;
  const editingPlaced = selected !== null;
  const sidc = selected ? selected.sidc : draftSidc(draft);
  const amplifiers = selected ? selected.amplifiers : draft.amplifiers;
  const fillColor = selected ? selected.fillColor : draft.fillColor;
  const fields = fieldsOf(sidc);

  const setField = <K extends keyof SidcFields>(
    key: K,
    value: SidcFields[K],
  ): void => {
    if (editingPlaced) {
      store().updateSelectedField(key, value);
    } else {
      store().setField(key, value);
    }
  };
  const setAmplifier = (key: string, value: string): void => {
    if (editingPlaced) {
      store().updateSelectedAmplifier(key, value);
    } else {
      store().setDraftAmplifier(key, value);
    }
  };
  const setFillColor = (value: string | null): void => {
    if (editingPlaced) {
      store().updateSelectedFillColor(value);
    } else {
      store().setDraftFillColor(value);
    }
  };

  if (selectedGraphic) {
    return <GraphicPanel graphic={selectedGraphic} />;
  }

  const rendered = renderSymbol(sidc, {
    size: PREVIEW_SIZE,
    amplifiers,
    fillColor,
    outline,
  });
  // Which fields the standard gives *this* symbol — see `modifiersOf`. Asked of the
  // renderer's own tables rather than guessed, so the panel offers a higher formation on
  // a land unit and not on an aircraft.
  const applicable = modifiersOf(basicIdOf(sidc), fields.version);
  // Twenty-four inputs is a wall. Shown by default: the fields this symbol actually has,
  // plus any field already carrying a value — because a value that is being drawn must
  // stay editable even if the symbol has since been changed to one the field does not
  // apply to.
  const shownAmplifiers = showAllAmplifiers
    ? AMPLIFIER_KEYS
    : AMPLIFIER_KEYS.filter(
        (key) => applicable.has(key) || (amplifiers[key] ?? "") !== "",
      );

  return (
    <section className="panel props">
      <header className="panel__head">
        <h2>{editingPlaced ? `Mark ${selected.id}` : "Next mark"}</h2>
        {editingPlaced ? (
          <button
            type="button"
            className="link"
            onClick={() => store().select(null)}
          >
            Back to draft
          </button>
        ) : (
          <span className="panel__count">click the map to place</span>
        )}
      </header>

      <div className="preview">
        {showAnchors ? (
          <SymbolSvgWithAnchor
            sidc={sidc}
            size={PREVIEW_SIZE}
            amplifiers={amplifiers}
            fillColor={fillColor}
            outline={outline}
          />
        ) : (
          <SymbolSvg
            sidc={sidc}
            size={PREVIEW_SIZE}
            amplifiers={amplifiers}
            fillColor={fillColor}
            outline={outline}
          />
        )}
        <dl className="measures">
          {/* The three numbers the marker layer is built on. `box` is what the renderer
              grew to fit the lettering; `anchor` is the point inside it the symbol
              belongs to; `offset` is `markerOffset`'s output — what MapLibre is handed
              so that point, and not the box's centre, lands on the coordinate. */}
          <div>
            <dt>box</dt>
            <dd>
              {Math.round(rendered.width)}×{Math.round(rendered.height)}
            </dd>
          </div>
          <div>
            <dt>anchor</dt>
            <dd>
              {Math.round(rendered.anchorX)},{Math.round(rendered.anchorY)}
            </dd>
          </div>
          <div>
            <dt>offset</dt>
            <dd>
              {Math.round(rendered.width / 2 - rendered.anchorX)},
              {Math.round(rendered.height / 2 - rendered.anchorY)}
            </dd>
          </div>
        </dl>
      </div>

      {isHeadquarters(sidc) ? (
        <p className="hint hint--note">
          A headquarters is anchored at the <strong>foot of its staff</strong>, not the
          middle of its box — turn on “anchor overlay” in the header to see the
          difference the offset above corrects.
        </p>
      ) : null}

      <SidcReadout sidc={sidc} />

      <FieldSelect
        label="Affiliation"
        hint="digit 4"
        options={AFFILIATIONS}
        value={fields.affiliation}
        onChange={(value) => setField("affiliation", value)}
      />
      <FieldSelect
        label="Status"
        hint="digit 7"
        options={STATUSES}
        value={fields.status}
        onChange={(value) => setField("status", value)}
      />
      <FieldSelect
        label="HQ / task force / dummy"
        hint="digit 8"
        options={HQTFDS}
        value={fields.hqtfd}
        onChange={(value) => setField("hqtfd", value)}
      />
      <FieldSelect
        label="Echelon / mobility"
        hint="digits 9-10"
        options={AMPLIFIER_DESCRIPTORS}
        value={fields.amplifierDescriptor}
        onChange={(value) => setField("amplifierDescriptor", value)}
      />
      <FieldSelect
        label="Context"
        hint="digit 3"
        options={CONTEXTS}
        value={fields.context}
        onChange={(value) => setField("context", value)}
      />

      <div className="field field--row">
        <span className="field__label">
          Frame fill <span className="field__hint">attribute</span>
        </span>
        <div className="fill">
          <input
            type="color"
            value={fillColor ?? "#ffffff"}
            onChange={(event) => setFillColor(event.target.value)}
            aria-label="Frame fill colour"
          />
          <button
            type="button"
            className="link"
            disabled={fillColor === null}
            onClick={() => setFillColor(null)}
          >
            {/* Null and a colour are different answers, not a colour and a default:
                cleared means "the affiliation's own", which is the renderer's job to
                decide and changes when the affiliation does. */}
            Use affiliation colour
          </button>
        </div>
      </div>

      <header className="panel__head panel__head--sub">
        <h3>Text amplifiers</h3>
        <button
          type="button"
          className="link"
          onClick={() => setShowAllAmplifiers((value) => !value)}
        >
          {showAllAmplifiers ? "Show fewer" : `All ${AMPLIFIER_KEYS.length}`}
        </button>
      </header>
      <p className="hint">
        Lettered by the renderer itself, in the boxes the standard gives them — the
        image bounds above grow to fit. milsymbol clips two of these fields, which is
        why <code>sip-map-army</code> letters them by hand.
      </p>

      {shownAmplifiers.map((key) => (
        <label
          className={
            applicable.has(key) ? "field field--amp" : "field field--amp field--off"
          }
          key={key}
        >
          <span className="field__label">
            <span className="amp__letter">{amplifierLetterOf(key)}</span>
            {amplifierNameOf(key)}
            {applicable.has(key) ? null : (
              <span
                className="field__hint"
                title="The standard does not list this field for this symbol — the renderer may ignore it"
              >
                n/a
              </span>
            )}
          </span>
          <input
            type="text"
            value={amplifiers[key] ?? ""}
            maxLength={Math.min(
              AMPLIFIER_MAX_CHARS[key] ?? AMPLIFIER_MAX_CHARS_HARD,
              AMPLIFIER_MAX_CHARS_HARD,
            )}
            title={amplifierDescriptionOf(key)}
            onChange={(event) => setAmplifier(key, event.target.value)}
          />
        </label>
      ))}

      {editingPlaced ? (
        <div className="actions">
          <span className="hint">
            {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)} — drag the mark to
            move it
          </span>
          <button
            type="button"
            className="danger"
            onClick={() => store().deleteSelected()}
          >
            Delete mark
          </button>
        </div>
      ) : null}
    </section>
  );
}
