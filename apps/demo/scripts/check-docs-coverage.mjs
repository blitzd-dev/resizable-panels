/**
 * Docs export-coverage check.
 *
 * Fails when a public export of `@blitzd/resizable-panels` is not mentioned
 * anywhere in the documentation prose, so a new export can never ship without
 * docs.
 *
 * How it works
 * 1. Parses the public export list (values and types) out of the library's
 *    `src/index.ts`.
 * 2. Builds a corpus from the docs content files.
 * 3. Requires every exported name to appear in that corpus as a whole word.
 *
 * Assumptions, and why they are safe
 * - `src/index.ts` only ever re-exports through `export { ... } from "..."`
 *   and `export type { ... } from "..."`. Rather than trust that, the parser
 *   removes every block it understands and then throws if any `export` text
 *   survives, so an unrecognized form (`export *`, `export default`, an inline
 *   `export const`) fails loudly instead of silently shrinking the checklist.
 * - `content/type-reference.ts` is excluded from the corpus. It is a routing
 *   and category registry keyed by type name, not documentation. Counting it
 *   would let a name satisfy coverage merely by being registered, with no
 *   entry rendered on any page.
 * - Import statements are stripped from the corpus. Re-exporting or importing
 *   a name is not documenting it.
 * - Matching is a whole-word regex, not a substring test, so `Panel` is not
 *   satisfied by `PanelGroup`.
 *
 * The check proves a name is mentioned; it cannot prove the mention is any
 * good. It is a floor, not a substitute for review.
 *
 * Usage: node apps/demo/scripts/check-docs-coverage.mjs
 */

import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const indexPath = resolve(repoRoot, "packages/resizable-panels/src/index.ts");
const contentDirectory = resolve(repoRoot, "apps/demo/src/pages/docs/content");

/** Registry modules that are keyed by export name but document nothing. */
const CORPUS_EXCLUDED_FILES = new Set(["type-reference.ts"]);

/** Strip line and block comments so commented-out exports never count. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function parsePublicExports(source) {
  const withoutComments = stripComments(source);
  const names = new Set();
  const reExportBlock =
    /export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'][^"']+["']\s*;?/g;

  const residual = withoutComments.replace(reExportBlock, (_match, body) => {
    for (const rawSpecifier of body.split(",")) {
      const specifier = rawSpecifier.trim();
      if (specifier === "") continue;
      // `type Foo`, `Foo as Bar`, and `type Foo as Bar` all resolve to the
      // name consumers actually import.
      const withoutTypeKeyword = specifier.replace(/^type\s+/, "");
      const [local, alias] = withoutTypeKeyword.split(/\s+as\s+/);
      names.add((alias ?? local).trim());
    }
    return "";
  });

  if (/\bexport\b/.test(residual)) {
    const offending = residual
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.includes("export"));
    throw new Error(
      [
        `Unrecognized export syntax in ${relative(repoRoot, indexPath)}:`,
        ...offending.map((line) => `  ${line}`),
        "",
        'This checker only understands `export { ... } from "..."` and',
        '`export type { ... } from "..."`. Teach it the new form before',
        "relying on it, otherwise exports would go unchecked.",
      ].join("\n"),
    );
  }

  if (names.size === 0) {
    throw new Error(
      `Parsed zero public exports from ${relative(repoRoot, indexPath)}. The parser is broken or the entry point moved.`,
    );
  }

  return [...names].sort();
}

function buildDocsCorpus() {
  const files = readdirSync(contentDirectory)
    .filter((file) => /\.tsx?$/.test(file))
    .filter((file) => !CORPUS_EXCLUDED_FILES.has(file))
    .sort();

  if (files.length === 0) {
    throw new Error(`No docs content files found in ${contentDirectory}.`);
  }

  const text = files
    .map((file) => readFileSync(resolve(contentDirectory, file), "utf8"))
    // An import is a reference, not an explanation.
    .map((source) =>
      source.replace(/^\s*import\b[\s\S]*?from\s*["'][^"']*["'];?\s*$/gm, ""),
    )
    .join("\n");

  return { files, text };
}

const publicExports = parsePublicExports(readFileSync(indexPath, "utf8"));
const corpus = buildDocsCorpus();

const undocumented = publicExports.filter(
  (name) => !new RegExp(`\\b${name}\\b`).test(corpus.text),
);

if (undocumented.length > 0) {
  console.error(
    [
      `${undocumented.length} public export${undocumented.length === 1 ? " is" : "s are"} undocumented:`,
      "",
      ...undocumented.map((name) => `  - ${name}`),
      "",
      `Every name exported from ${relative(repoRoot, indexPath)} must be`,
      `mentioned in ${relative(repoRoot, contentDirectory)}/.`,
      "",
      "Document each one on the page that teaches its behavior, and add types",
      "to the type reference (content/types.tsx plus content/type-reference.ts).",
      "If an export is not meant to be public, remove it from index.ts instead.",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(
  `All ${publicExports.length} public exports are documented across ${corpus.files.length} docs content files.`,
);
