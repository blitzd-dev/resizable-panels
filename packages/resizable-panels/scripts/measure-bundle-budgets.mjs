/**
 * §6 bundle budgets: measure what a downstream production bundler retains
 * for representative import shapes of the PACKED package (real tarball,
 * installed into a temp project — never source aliases).
 *
 * Pinned bundler: the workspace's rolldown (the same engine rolldown-vite
 * builds with). React stays external, NODE_ENV is folded to production,
 * output is minified, and the reported number is the gzipped bundle size.
 *
 * Manual gate for v1 (CI enforcement is Tier 2): exits non-zero when any
 * fixture exceeds its budget.
 */

import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { rolldown } from "rolldown";

const packageRoot = dirname(
  fileURLToPath(new URL("../package.json", import.meta.url)),
);
const packageJson = JSON.parse(
  readFileSync(resolve(packageRoot, "package.json"), "utf8"),
);
const packageName = packageJson.name;
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const FIXTURES = [
  {
    name: "PanelProvider only",
    budgetKiB: 4,
    source: `export { PanelProvider } from ${JSON.stringify(packageName)};`,
  },
  {
    name: "Panel only",
    // Raised 10 → 10.25 (owner, 2026-07-21, never-squish) → 10.75
    // (2026-07-22, R-37 auto-collapse; per the owner's recorded stance:
    // "not being strict about size … if it makes the features better we
    // can increase"). Budgets guard bloat, not deliberate features.
    budgetKiB: 10.75,
    source: `export { Panel } from ${JSON.stringify(packageName)};`,
  },
  // Budget calibration (owner decision, 2026-07-18): the narrow-import
  // fixtures above stay TIGHT — they guard tree-shaking/modularity (§6),
  // where growth is always a structural regression. The two full-library
  // fixtures below get honest headroom instead: their growth tracks
  // deliberate feature decisions 1:1, so a hair-trigger ceiling only
  // meters approved work. Small-package intent is preserved by
  // re-ratcheting budgets to measured +10% at each release, so drift
  // between releases still fails loudly.
  {
    name: "Standard component set",
    // Raised 30 → 31.5 (2026-07-22, R-37 auto-collapse; same recorded
    // owner stance as Panel-only above) → 32.5 (2026-07-23, panel-group
    // decomposition into focused group hooks: the module seams' deps-object
    // property keys survive minification where the old single-module
    // internals mangled fully — ~1 KiB gzip across the composed set. The
    // narrow fixtures were unaffected, so modularity/tree-shaking held.)
    budgetKiB: 32.5,
    source: `export { PanelProvider, PanelGroup, Panel, PanelResizeHandle } from ${JSON.stringify(packageName)};`,
  },
  {
    name: "All runtime exports",
    // Raised 32 → 33 (2026-07-23, panel-group decomposition — see above).
    budgetKiB: 33,
    source: `export * from ${JSON.stringify(packageName)};`,
  },
];

const temporaryRoot = mkdtempSync(join(tmpdir(), "resizable-panels-budgets-"));
process.on("exit", () => {
  rmSync(temporaryRoot, { recursive: true, force: true });
});

// Pack and install the real tarball so exports mapping, files filtering,
// and declaration/runtime layout are all the shipped ones.
const archiveDirectory = join(temporaryRoot, "archive");
mkdirSync(archiveDirectory);
execFileSync(
  npm,
  ["pack", "--ignore-scripts", "--pack-destination", archiveDirectory],
  { cwd: packageRoot, stdio: ["ignore", "ignore", "inherit"] },
);
const archives = readdirSync(archiveDirectory).filter((name) =>
  name.endsWith(".tgz"),
);
if (archives.length !== 1) {
  throw new Error(`Expected one package archive, found ${archives.length}.`);
}

const consumerRoot = join(temporaryRoot, "consumer");
mkdirSync(consumerRoot);
writeFileSync(
  join(consumerRoot, "package.json"),
  JSON.stringify({ name: "budget-consumer", private: true, type: "module" }),
);
execFileSync(
  npm,
  [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    join(archiveDirectory, archives[0]),
  ],
  { cwd: consumerRoot, stdio: ["ignore", "ignore", "inherit"] },
);

async function measure(fixture) {
  const entry = join(consumerRoot, `${fixture.name.replaceAll(" ", "-")}.js`);
  writeFileSync(entry, fixture.source);
  const bundle = await rolldown({
    input: entry,
    external: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
    transform: {
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
    },
  });
  try {
    const { output } = await bundle.generate({ format: "esm", minify: true });
    const code = output
      .filter((chunk) => chunk.type === "chunk")
      .map((chunk) => chunk.code)
      .join("");
    return gzipSync(code, { level: 9 }).length;
  } finally {
    await bundle.close();
  }
}

let failed = false;
const rows = [];
for (const fixture of FIXTURES) {
  const gzipBytes = await measure(fixture);
  const gzipKiB = gzipBytes / 1024;
  const within = gzipKiB <= fixture.budgetKiB;
  if (!within) failed = true;
  rows.push({
    Fixture: fixture.name,
    "Gzip (KiB)": gzipKiB.toFixed(2),
    "Budget (KiB)": fixture.budgetKiB.toFixed(2),
    Status: within ? "ok" : "OVER BUDGET",
  });
}

console.table(rows);
if (failed) {
  console.error("Bundle budget exceeded (§6).");
  process.exit(1);
}
console.log(
  `All ${FIXTURES.length} fixtures within §6 budgets (packed ${archives[0]}, rolldown, production, React external, gzip -9).`,
);
