/**
 * Extracts MIL-STD-2525's **anchor point rules** from the renderer's type declarations
 * into `src/symbology/data/drawRules.ts`.
 *
 * ### Why this file exists
 *
 * `MSInfo.getDrawRule()` returns a number at runtime, and `DrawRules` exposes the names
 * for those numbers — `AXIS2`, `AREA1`, `CORRIDOR1`. What it does **not** expose at
 * runtime is what the rule *means*, and that meaning is the difference between a correct
 * graphic and a wrong one:
 *
 *   AXIS2 — "Point 1 defines the tip of the arrowhead. Point N-1 defines the rear of the
 *   symbol. Point N defines the back of the arrowhead. … Points 1 through N-1 determine
 *   the symbol's center line and Point N determines the width."
 *
 * A drawing tool that collects clicks as a tail-to-tip path draws that graphic
 * **backwards, with its last click eaten as a width** — which is exactly what this demo
 * did until the rules were read. The text is in the `.d.mts` as JSDoc, which is a
 * build-time artefact, so it is extracted once into a committed table rather than parsed
 * in the browser.
 *
 * Usage, from this project's root:
 *
 *     node scripts/gen-draw-rules.mjs
 *     node scripts/gen-draw-rules.mjs --check
 *
 * The text is the standard's, quoted from the library's declarations verbatim — no
 * paraphrasing, because a paraphrased anchor-point rule is a guess about geometry.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DECLARATIONS = resolve(
  "node_modules/@armyc2.c5isr.renderer/mil-sym-ts-web/C5Ren.d.mts",
);
const TARGET = resolve("src/symbology/data/drawRules.ts");
const check = process.argv.includes("--check");

const source = readFileSync(DECLARATIONS, "utf8");

/**
 * Only the first `DrawRules` class.
 *
 * There are two: `DrawRules` for tactical graphics and `MODrawRules` for meteorological
 * ones, and their constant names overlap. `MSInfo.getDrawRule()` on a control measure
 * returns the first kind, so taking the file's first class is right — but it is right by
 * a fact about the file, so the boundary is asserted rather than assumed.
 */
const start = source.indexOf("declare class DrawRules {");
if (start < 0) {
  console.error("No `declare class DrawRules` in the declarations.");
  process.exit(2);
}
const end = source.indexOf("\n}", start);
const block = source.slice(start, end);
if (block.includes("declare class MODrawRules")) {
  console.error("The DrawRules block ran into MODrawRules — the file's shape changed.");
  process.exit(2);
}

/** One `/** … *\/ static readonly NAME: number;` pair. */
const ENTRY = /\/\*\*([\s\S]*?)\*\/\s*static readonly (\w+):\s*number;/g;

/** Pull one labelled paragraph out of a JSDoc comment. */
function section(text, label) {
  const at = text.indexOf(`${label}:`);
  if (at < 0) {
    return "";
  }
  const rest = text.slice(at + label.length + 1);
  // Paragraphs are separated by a blank comment line; "Used by:" ends the useful part.
  const stop = rest.search(/\n\s*\*\s*\n|\n\s*\*\s*(Size\/Shape|Orientation|Used by):/);
  return (stop < 0 ? rest : rest.slice(0, stop))
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const rules = [];
for (const match of block.matchAll(ENTRY)) {
  const [, doc, name] = match;
  rules.push({
    name,
    anchorPoints: section(doc, "Anchor Points"),
    sizeShape: section(doc, "Size/Shape"),
    orientation: section(doc, "Orientation"),
  });
}

if (rules.length < 50) {
  console.error(`Only ${rules.length} rules extracted — the JSDoc shape has changed.`);
  process.exit(2);
}

const described = rules.filter((rule) => rule.anchorPoints !== "").length;

const escape = (text) => text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const rendered = `// GENERATED FILE — do not edit by hand.
//
// MIL-STD-2525's anchor point rules, extracted from
// node_modules/@armyc2.c5isr.renderer/mil-sym-ts-web/C5Ren.d.mts by
// scripts/gen-draw-rules.mjs. ${rules.length} rules, ${described} of them with an
// anchor-point description.
//
// \`MSInfo.getDrawRule()\` gives a number and \`DrawRules\` gives that number a name, but
// neither says what the points MEAN — and for the arrow, corridor and rectangle rules the
// points are not a path. AXIS2's first point is the tip of the arrowhead and its last is a
// width, so a tool that collects clicks as a tail-to-tip path draws it backwards.
//
// The text is the standard's own, quoted verbatim. Regenerate with:
//
//   node scripts/gen-draw-rules.mjs

export interface DrawRuleText {
  /** What each anchor point means, in the standard's words. */
  readonly anchorPoints: string;
  /** What the points determine about size and shape. */
  readonly sizeShape: string;
  /** Which way the symbol faces, where the standard says. */
  readonly orientation: string;
}

/** Keyed by \`DrawRules\` constant name — \`AXIS2\`, \`AREA1\`, \`CORRIDOR1\`. */
export const DRAW_RULE_TEXT: Readonly<Record<string, DrawRuleText>> = {
${rules
  .map(
    (rule) => `  ${rule.name}: {
    anchorPoints: "${escape(rule.anchorPoints)}",
    sizeShape: "${escape(rule.sizeShape)}",
    orientation: "${escape(rule.orientation)}",
  },`,
  )
  .join("\n")}
};

export const DRAW_RULE_COUNT = ${rules.length};
`;

if (check) {
  const committed = readFileSync(TARGET, "utf8");
  if (committed === rendered) {
    console.log(`Draw rules are current: ${rules.length} rules, ${described} described.`);
    process.exit(0);
  }
  console.error("Draw rules are out of date — run without --check to rewrite.");
  process.exit(1);
}

writeFileSync(TARGET, rendered);
console.log(`Wrote ${TARGET}: ${rules.length} rules, ${described} with descriptions.`);
