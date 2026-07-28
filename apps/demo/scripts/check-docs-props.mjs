/**
 * Docs prop-table drift check.
 *
 * Fails when a documented component's prop table disagrees with the prop type
 * in the library source: a prop that exists in the type but has no table row,
 * a table row naming a prop the type does not have, or a literal default in
 * the component signature that the row never states.
 *
 * Why verification rather than generation
 * The tables are hand-written JSX. Their description cells carry <Link>s to
 * the page that teaches a behavior, emphasis, and prose that explains when to
 * reach for a prop — none of which a JSDoc-to-table generator can produce
 * without flattening the docs into a type dump. So the source of truth stays
 * the source, the writing stays hand-written, and this script asserts the two
 * agree on the facts a machine can check: which props exist, and what their
 * literal defaults are.
 *
 * How it works
 * 1. Indexes every `type X = ...` / `interface X {...}` declaration in the
 *    library files that define component props.
 * 2. Resolves each component's public props type through intersections,
 *    unions, parentheses, and object literals down to a flat set of prop
 *    names. `Omit<HTMLAttributes<HTMLDivElement>, ...>` resolves to the
 *    "native attributes" bucket rather than to individual names.
 * 3. Parses `<Table rows={[...]} />` blocks out of the component's docs pages
 *    and reads the first cell of each row — the prop name column.
 * 4. Compares the two sets in both directions, and checks stated defaults.
 *
 * Assumptions, and why they are safe
 * - The resolver understands a fixed grammar of type expressions. Anything
 *   else — a mapped type, a conditional type, `Pick`, an import type — throws
 *   instead of resolving to an empty set, so an unhandled form fails loudly
 *   rather than silently shrinking the checklist.
 * - Members typed `never` are dropped. They are the excluded arm of a
 *   discriminated union (`value?: never`), not props a consumer can pass.
 * - Only top-level members of an object literal count, so the inner keys of
 *   `hitAreaMargins?: { coarse?: number }` are not mistaken for props.
 * - Comments are stripped before parsing. JSDoc in these files is dense with
 *   `key: value` prose that would otherwise read as members.
 * - A prop is covered by a row on ANY of the component's declared docs pages.
 *   Panel's collapse props are taught on the collapsing page, and that page
 *   is a first-class part of Panel's prop documentation, not an exemption.
 * - Defaults are read only from a component's own destructuring pattern. When
 *   a component takes `props` whole (PanelGroup, Panel — their defaults are
 *   mode-dependent and resolved deeper in), no defaults are extracted and
 *   none are asserted. The check reports its own coverage so a reader can see
 *   how much it proved.
 *
 * The check proves the tables list the right props with the right stated
 * defaults. It cannot prove a description is accurate or well written.
 *
 * Usage: node apps/demo/scripts/check-docs-props.mjs
 */

import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const sourceDirectory = resolve(repoRoot, "packages/resizable-panels/src");
const contentDirectory = resolve(repoRoot, "apps/demo/src/pages/docs/content");

/** Library files that declare component props or the types they build on. */
const SOURCE_FILES = [
  "group/panel-group.tsx",
  "panel/panel.tsx",
  "handle/panel-resize-handle.tsx",
  "types.ts",
];

/**
 * Each documented component, its public props type, and the docs pages whose
 * prop tables together document it.
 *
 * `nativeAttrsRow` is the exact row label that tells a reader the component
 * also accepts native div attributes; the props in `nativeAttrsProps` are the
 * ones that row covers by name. Requiring the label to exist means the
 * acknowledgment cannot be deleted without this check noticing.
 */
const COMPONENTS = [
  {
    component: "PanelGroup",
    propsType: "PanelGroupProps",
    docsPages: ["panel-group.tsx"],
    nativeAttrsRow: "className / style / div attrs",
    nativeAttrsProps: ["className", "style"],
  },
  {
    component: "Panel",
    propsType: "PanelProps",
    docsPages: ["panel.tsx", "collapsing.tsx"],
    nativeAttrsRow: "className / style / children / div attrs",
    nativeAttrsProps: ["className", "style", "children"],
  },
  {
    component: "PanelResizeHandle",
    propsType: "PanelResizeHandleProps",
    docsPages: ["panel-resize-handle.tsx"],
    nativeAttrsRow: "className / style / div attrs",
    nativeAttrsProps: [],
  },
];

/**
 * Row labels that are a bare identifier but document a value rather than a
 * prop. Empty today; kept as the single, visible place to record such a row
 * so nobody is tempted to loosen the identifier test instead.
 */
const NON_PROP_ROW_LABELS = new Set();

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * Walks `source` from `start`, tracking nesting and skipping string literals,
 * and calls `visit(index, char, depth)` for each character. Returns the index
 * just past the point where `stop(depth, char)` first returns true.
 */
function scan(source, start, visit, stop) {
  const openers = { "{": "}", "(": ")", "[": "]", "<": ">" };
  const closers = new Set(["}", ")", "]", ">"]);
  let depth = 0;
  let index = start;

  while (index < source.length) {
    const char = source[index];

    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      index += 1;
      while (index < source.length && source[index] !== quote) {
        if (source[index] === "\\") index += 1;
        index += 1;
      }
      index += 1;
      continue;
    }

    // An arrow (`=>`) is not a closing angle bracket.
    if (char === "=" && source[index + 1] === ">") {
      visit(index, char, depth);
      index += 2;
      continue;
    }

    if (openers[char] !== undefined) {
      visit(index, char, depth);
      depth += 1;
      index += 1;
      continue;
    }

    if (closers.has(char)) {
      depth -= 1;
      if (stop(depth, char)) return index + 1;
      visit(index, char, depth);
      index += 1;
      continue;
    }

    if (stop(depth, char)) return index + 1;
    visit(index, char, depth);
    index += 1;
  }

  return index;
}

/** Index every `type X = ...;` and `interface X {...}` in the source files. */
function indexTypeDeclarations() {
  const declarations = new Map();

  for (const file of SOURCE_FILES) {
    const source = stripComments(
      readFileSync(resolve(sourceDirectory, file), "utf8"),
    );

    const aliasPattern =
      /(?:^|\n)\s*(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=/g;
    let match = aliasPattern.exec(source);
    while (match !== null) {
      const bodyStart = match.index + match[0].length;
      const bodyEnd = scan(
        source,
        bodyStart,
        () => {},
        (depth, char) => depth === 0 && char === ";",
      );
      declarations.set(match[1], {
        kind: "alias",
        body: source.slice(bodyStart, bodyEnd - 1),
        file,
      });
      match = aliasPattern.exec(source);
    }

    const interfacePattern =
      /(?:^|\n)\s*(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)\s*\{/g;
    match = interfacePattern.exec(source);
    while (match !== null) {
      const bodyStart = match.index + match[0].length;
      const bodyEnd = scan(
        source,
        bodyStart,
        () => {},
        (depth, char) => depth === -1 && char === "}",
      );
      declarations.set(match[1], {
        kind: "object",
        body: source.slice(bodyStart, bodyEnd - 1),
        file,
      });
      match = interfacePattern.exec(source);
    }
  }

  return declarations;
}

/** Split a type expression on a top-level operator (`&` or `|`). */
function splitTopLevel(expression, operator) {
  const parts = [];
  let last = 0;

  scan(
    expression,
    0,
    (index, char, depth) => {
      if (depth === 0 && char === operator) {
        parts.push(expression.slice(last, index));
        last = index + 1;
      }
    },
    () => false,
  );

  parts.push(expression.slice(last));
  return parts.map((part) => part.trim()).filter((part) => part !== "");
}

/** Read the top-level member names of an object type body. */
function objectMembers(body) {
  const chunks = [];
  let last = 0;

  scan(
    body,
    0,
    (index, char, depth) => {
      if (depth === 0 && (char === ";" || char === ",")) {
        chunks.push(body.slice(last, index));
        last = index + 1;
      }
    },
    () => false,
  );
  chunks.push(body.slice(last));

  const members = [];
  for (const chunk of chunks) {
    const member =
      /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*(\??)\s*:([\s\S]*)$/.exec(
        chunk,
      );
    if (member === null) continue;
    // The excluded arm of a discriminated union is not a prop.
    if (member[3].trim() === "never") continue;
    members.push(member[1]);
  }
  return members;
}

/**
 * Resolve a type expression to `{ props, nativeAttrs }`. Throws on any form
 * the resolver does not understand, so unhandled syntax fails loudly.
 */
function resolveType(expression, declarations, trail) {
  const path = () =>
    trail.length > 0 ? trail.join(" -> ") : "the root props type";
  const props = new Set();
  let nativeAttrs = false;

  const absorb = (result) => {
    for (const prop of result.props) props.add(prop);
    if (result.nativeAttrs) nativeAttrs = true;
  };

  const text = expression.trim();

  const intersectionParts = splitTopLevel(text, "&");
  if (intersectionParts.length > 1) {
    for (const part of intersectionParts) {
      absorb(resolveType(part, declarations, trail));
    }
    return { props, nativeAttrs };
  }

  const unionParts = splitTopLevel(text, "|");
  if (unionParts.length > 1) {
    // A consumer may pass either arm, so the docs must cover both.
    for (const part of unionParts) {
      absorb(resolveType(part, declarations, trail));
    }
    return { props, nativeAttrs };
  }

  if (text.startsWith("(") && text.endsWith(")")) {
    return resolveType(text.slice(1, -1), declarations, trail);
  }

  if (text.startsWith("{") && text.endsWith("}")) {
    for (const member of objectMembers(text.slice(1, -1))) props.add(member);
    return { props, nativeAttrs };
  }

  // React's element attribute bag, with or without an Omit wrapper.
  if (/^(?:Omit<\s*)?HTMLAttributes\s*<[^>]*>/.test(text)) {
    return { props, nativeAttrs: true };
  }

  const identifier = /^([A-Za-z_$][\w$]*)$/.exec(text);
  if (identifier !== null) {
    const name = identifier[1];
    if (trail.includes(name)) {
      throw new Error(
        `Circular type reference: ${[...trail, name].join(" -> ")}`,
      );
    }
    const declaration = declarations.get(name);
    if (declaration === undefined) {
      // A named type with no members of its own (an enum-like string union
      // imported from elsewhere) cannot contribute props, but silently
      // assuming that would hide a real prop bag. Fail instead.
      throw new Error(
        `Unresolved type \`${name}\` while resolving ${path()}. ` +
          `Add the file that declares it to SOURCE_FILES.`,
      );
    }
    if (declaration.kind === "object") {
      for (const member of objectMembers(declaration.body)) props.add(member);
      return { props, nativeAttrs };
    }
    return resolveType(declaration.body, declarations, [...trail, name]);
  }

  throw new Error(
    [
      `Unrecognized type expression while resolving ${path()}:`,
      `  ${text.replace(/\s+/g, " ").slice(0, 160)}`,
      "",
      "This resolver understands intersections, unions, parentheses, object",
      "literals, HTMLAttributes bags, and named local types. Teach it the new",
      "form before relying on it, otherwise props would go unchecked.",
    ].join("\n"),
  );
}

/** Literal defaults from a component's own destructuring pattern. */
function extractLiteralDefaults(componentName) {
  for (const file of SOURCE_FILES) {
    const source = stripComments(
      readFileSync(resolve(sourceDirectory, file), "utf8"),
    );
    const signature = new RegExp(`function\\s+${componentName}\\s*\\(\\s*\\{`);
    const match = signature.exec(source);
    if (match === null) continue;

    const start = match.index + match[0].length;
    const end = scan(
      source,
      start,
      () => {},
      (depth, char) => depth === -1 && char === "}",
    );
    const pattern = source.slice(start, end - 1);

    const defaults = new Map();
    const assignment =
      /([A-Za-z_$][\w$]*)\s*=\s*("[^"]*"|'[^']*'|true|false|-?\d+(?:\.\d+)?)/g;
    let found = assignment.exec(pattern);
    while (found !== null) {
      defaults.set(found[1], found[2].replace(/^['"]|['"]$/g, ""));
      found = assignment.exec(pattern);
    }
    return defaults;
  }
  return new Map();
}

/** Read `[name, type, description]` rows out of every `<Table>` on a page. */
function extractTableRows(file) {
  const source = readFileSync(resolve(contentDirectory, file), "utf8");
  const rows = [];
  const marker = /rows=\{\s*\[/g;
  let match = marker.exec(source);

  while (match !== null) {
    const start = match.index + match[0].length;
    const end = scan(
      source,
      start,
      () => {},
      (depth, char) => depth === -1 && char === "]",
    );
    const body = source.slice(start, end - 1);

    for (const [rowStart, rowEnd] of collectRowSpans(body)) {
      const row = body.slice(rowStart, rowEnd);
      const label = /^\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*,/.exec(row);
      if (label === null) {
        throw new Error(
          [
            `A prop table row in ${file} does not start with a string literal:`,
            `  ${row.replace(/\s+/g, " ").slice(0, 120)}`,
            "",
            "The name column is typed `string`. If that changed, teach this",
            "parser the new shape before relying on it.",
          ].join("\n"),
        );
      }
      rows.push({
        name: label[1].slice(1, -1).replace(/\\(.)/g, "$1"),
        text: row.replace(/\s+/g, " "),
        file,
      });
    }

    marker.lastIndex = end;
    match = marker.exec(source);
  }

  return rows;
}

/** Depth-tracked spans of each top-level `[...]` row inside a rows array. */
function collectRowSpans(body) {
  const spans = [];
  let depth = 0;
  let start = -1;
  let index = 0;

  while (index < body.length) {
    const char = body[index];

    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      index += 1;
      while (index < body.length && body[index] !== quote) {
        if (body[index] === "\\") index += 1;
        index += 1;
      }
      index += 1;
      continue;
    }

    if (char === "[" || char === "{" || char === "(") {
      if (char === "[" && depth === 0) start = index + 1;
      depth += 1;
    } else if (char === "]" || char === "}" || char === ")") {
      depth -= 1;
      if (char === "]" && depth === 0 && start !== -1) {
        spans.push([start, index]);
        start = -1;
      }
    }

    index += 1;
  }

  return spans;
}

const declarations = indexTypeDeclarations();
if (declarations.size === 0) {
  throw new Error(
    `Indexed zero type declarations from ${relative(repoRoot, sourceDirectory)}. The parser is broken or the files moved.`,
  );
}

const problems = [];
const summaries = [];

for (const config of COMPONENTS) {
  const { props: sourceProps, nativeAttrs } = resolveType(
    config.propsType,
    declarations,
    [],
  );

  if (sourceProps.size === 0) {
    throw new Error(
      `Resolved zero props for ${config.propsType}. The resolver is broken.`,
    );
  }

  const rows = config.docsPages.flatMap(extractTableRows);
  const documented = new Set(rows.map((row) => row.name));
  const nativeAttrsProps = new Set(config.nativeAttrsProps);

  const hasNativeAttrsRow = documented.has(config.nativeAttrsRow);
  if (nativeAttrs && !hasNativeAttrsRow) {
    problems.push(
      `${config.component}: accepts native div attributes, but no row labelled ` +
        `"${config.nativeAttrsRow}" says so on ${config.docsPages.join(", ")}.`,
    );
  }

  const missing = [...sourceProps]
    .filter((prop) => !documented.has(prop))
    .filter((prop) => !(hasNativeAttrsRow && nativeAttrsProps.has(prop)))
    .sort();

  if (missing.length > 0) {
    problems.push(
      `${config.component}: ${missing.length} prop${missing.length === 1 ? "" : "s"} in ` +
        `${config.propsType} with no prop-table row on ${config.docsPages.join(", ")}:\n` +
        missing.map((prop) => `    - ${prop}`).join("\n"),
    );
  }

  const invented = rows
    .filter((row) => /^[a-z][A-Za-z0-9]*$/.test(row.name))
    .filter((row) => !sourceProps.has(row.name))
    .filter((row) => !NON_PROP_ROW_LABELS.has(row.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (invented.length > 0) {
    problems.push(
      `${config.component}: ${invented.length} prop-table row${invented.length === 1 ? "" : "s"} ` +
        `naming a prop that ${config.propsType} does not have:\n` +
        invented.map((row) => `    - ${row.name} (${row.file})`).join("\n"),
    );
  }

  const defaults = extractLiteralDefaults(config.component);
  const wrongDefaults = [];
  for (const [prop, value] of defaults) {
    const row = rows.find((candidate) => candidate.name === prop);
    if (row === undefined) continue;
    if (!row.text.includes(value)) {
      wrongDefaults.push(`${prop} (source default \`${value}\`)`);
    }
  }

  if (wrongDefaults.length > 0) {
    problems.push(
      `${config.component}: ${wrongDefaults.length} row${wrongDefaults.length === 1 ? "" : "s"} ` +
        "never state the default the component actually applies:\n" +
        wrongDefaults.map((entry) => `    - ${entry}`).join("\n"),
    );
  }

  summaries.push(
    `  ${config.component}: ${sourceProps.size} props checked against ` +
      `${rows.length} table rows across ${config.docsPages.join(", ")}` +
      (defaults.size > 0 ? `; ${defaults.size} literal defaults verified` : ""),
  );
}

if (problems.length > 0) {
  console.error(
    [
      `Docs prop tables disagree with the library source in ${problems.length} place${problems.length === 1 ? "" : "s"}:`,
      "",
      ...problems.map((problem) => `  - ${problem}`),
      "",
      `Prop types live in ${relative(repoRoot, sourceDirectory)}/ and the tables in`,
      `${relative(repoRoot, contentDirectory)}/. Fix whichever is wrong; a prop`,
      "that is deliberately taught on another page belongs in that component's",
      "docsPages list in this script, not in an exemption.",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(
  ["Docs prop tables match the library source.", ...summaries].join("\n"),
);
