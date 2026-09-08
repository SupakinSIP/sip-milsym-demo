/**
 * Rebuilds `src/symbology/data/mapArmyCatalog.ts` from a checkout of `sip-map-army`.
 *
 * The fixture is committed because this project has no dependency on that repository and
 * has to be readable and checkable on its own. It is *generated* rather than hand-copied
 * because 927 rows will be regenerated over there eventually, and a fixture nobody can
 * refresh is a fixture that quietly goes stale — which in a coverage comparison means
 * reporting a difference that has since been fixed.
 *
 * Usage, from this project's root:
 *
 *     node scripts/gen-map-army-fixture.mjs ../sip-map-army
 *     node scripts/gen-map-army-fixture.mjs ../sip-map-army --check
 *
 * `--check` writes nothing and exits non-zero if the committed fixture is out of date,
 * which is the form a CI step would take.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repo = process.argv[2];
const check = process.argv.includes("--check");
if (!repo) {
  console.error(
    "Usage: node scripts/gen-map-army-fixture.mjs <path-to-sip-map-army> [--check]",
  );
  process.exit(2);
}

const SOURCE = join(
  repo,
  "packages/symbols/src/generated/warfighting.ts",
);
const TARGET = resolve("src/symbology/data/mapArmyCatalog.ts");

let source;
try {
  source = readFileSync(SOURCE, "utf8");
} catch {
  console.error(`Cannot read ${SOURCE}`);
  process.exit(2);
}

// The label rows, exactly as that file writes them — ten-character key, quoted name.
const labels = source.match(/^ {2}"[A-Z0-9*-]{10}": "[^"]*",$/gm) ?? [];
// The structural list, which is a separate array of bare keys further down the file.
const structuralBlock = source.slice(
  source.indexOf("WARFIGHTING_STRUCTURAL"),
);
const structural = (
  structuralBlock.slice(0, structuralBlock.indexOf("];")).match(
    /"[A-Z0-9*-]{10}"/g,
  ) ?? []
).map((key) => `  ${key},`);

if (labels.length === 0 || structural.length === 0) {
  console.error(
    `Extracted ${labels.length} labels and ${structural.length} structural keys — the ` +
      `source file's shape has changed. Fix the patterns here rather than committing a ` +
      `short fixture.`,
  );
  process.exit(2);
}

const rendered = `// GENERATED FIXTURE — do not edit by hand.
//
// map.army's MIL-STD-2525C catalog, copied here so this project can compute a real
// crosswalk against mil-sym-ts's 2525D tables rather than compare two totals.
//
// Source: sip-map-army/packages/symbols/src/generated/warfighting.ts
//   — WARFIGHTING_LABELS (${labels.length} rows) and WARFIGHTING_STRUCTURAL (${structural.length} keys).
//
// Regenerate with, from this project's root:
//
//   node scripts/gen-map-army-fixture.mjs ../sip-map-army
//
// Keys are milsymbol's own table keys: coding scheme, affiliation placeholder, battle
// dimension, status placeholder, then the six-character function id — so \`S-A-MF----\`
// becomes the 2525C SIDC \`SFAPMF---------\` once the placeholders are filled in.

/** Every drawable warfighting symbol in map.army's catalog: table key → its own name. */
export const MAP_ARMY_LABELS: Readonly<Record<string, string>> = {
${labels.join("\n")}
};

/**
 * The nodes milsymbol draws no icon for — the tree's joints.
 *
 * "Air", "Ground", "Unit": categories, not things on a map. They render as the bare
 * affiliation frame, so they are excluded from every count in \`coverage.ts\`.
 */
export const MAP_ARMY_STRUCTURAL: readonly string[] = [
${structural.join("\n")}
];
`;

if (check) {
  const committed = readFileSync(TARGET, "utf8");
  if (committed === rendered) {
    console.log(`Fixture is current: ${labels.length} labels, ${structural.length} structural.`);
    process.exit(0);
  }
  console.error("Fixture is out of date — run without --check to rewrite it.");
  process.exit(1);
}

writeFileSync(TARGET, rendered);
console.log(
  `Wrote ${TARGET}: ${labels.length} labels, ${structural.length} structural keys.`,
);
