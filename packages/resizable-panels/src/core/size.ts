import { errorDev, IS_DEVELOPMENT, warnDev } from "../shared/diagnostics.js";
import type { SizeSpec } from "../types.js";

/**
 * Size resolution for panel dimensions.
 *
 * Sizes accept a number (px) or a string in a strict CSS-compatible subset:
 *
 * ```ebnf
 * size      = dimension | zero | calc
 * dimension = signed-decimal, unit
 * zero      = "0"
 * unit      = "px" | "%" | "em" | "rem" | "vw" | "vh"
 * calc      = "calc(", sum, ")"
 * sum       = unary, { whitespace, ("+" | "-"), whitespace, unary }
 * unary     = [ "+" | "-" ], primary
 * primary   = dimension | zero | "(", sum, ")"
 * ```
 *
 * Every accepted string is also valid CSS with identical meaning, so raw
 * specs can be emitted into SSR/bootstrap styles after validation. The
 * reverse does not hold: units are required on nonzero values, arithmetic
 * must be wrapped in `calc()`, `*` and `/` are not supported, and CSS
 * functions other than `calc()` (`var()`, `clamp()`, ...) are rejected —
 * the allocator needs deterministic, synchronous pixel resolution across
 * SSR, imperative actions, and browsers.
 *
 * Resolution is dynamic: `resolveSize` evaluates a cached context-free AST
 * against the live group/viewport/font metrics on every call, so a `"50%"`
 * panel tracks the container as it resizes — the same way CSS does.
 */

/** Clamp `v` into `[lo, hi]`. */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** The layout's sub-pixel tolerance: size differences at or below this are
 *  imperceptible and not worth a store commit or re-render. */
export const SIZE_EPSILON = 0.5;

/** True when `a` and `b` differ by more than `SIZE_EPSILON`. */
export function sizesDiffer(a: number, b: number): boolean {
  return Math.abs(a - b) > SIZE_EPSILON;
}

/**
 * True when two size maps hold the same keys with per-key values within
 * `SIZE_EPSILON` of each other. A key present in only one map is a
 * difference regardless of its value — treating a missing entry as `0`
 * would let same-size maps with different key sets compare equal whenever
 * the differing values are near zero, silently skipping a store commit
 * (R-07).
 */
export function mapsAlmostEqual<K>(
  a: ReadonlyMap<K, number>,
  b: ReadonlyMap<K, number>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of b) {
    if (!a.has(k)) return false;
    if (sizesDiffer(a.get(k) as number, v)) return false;
  }
  return true;
}

export type ResolveContext = {
  /** Group container size along the axis of layout, in px. */
  containerSize: number;
  /** Computed font-size of the panel itself, in px (1em). */
  fontSize: number;
  /** Computed font-size of the document root, in px (1rem). */
  rootFontSize: number;
  /** Viewport width, in px (100vw). */
  viewportWidth: number;
  /** Viewport height, in px (100vh). */
  viewportHeight: number;
};

// ─── grammar limits ─────────────────────────────────────────────────────────
// Specs are authored constants; these bounds are far above anything sane and
// exist so a dynamically generated pathological string cannot stall parsing.
const MAX_INPUT_LENGTH = 256;
const MAX_TOKENS = 64;
const MAX_NESTING_DEPTH = 8;

type SizeUnit = "px" | "%" | "em" | "rem" | "vw" | "vh";

const UNITS: readonly SizeUnit[] = ["px", "%", "em", "rem", "vw", "vh"];

/** Context-free parsed form of a string spec. Evaluated per call so
 * relative units track the live context. */
type SizeNode =
  | { t: "dim"; v: number; u: SizeUnit }
  | { t: "sum"; terms: readonly { sign: 1 | -1; node: SizeNode }[] };

/** Resolve a SizeSpec to pixels using the given context. Throws on any spec
 * outside the documented grammar; callers that accept consumer input use
 * `resolveSizeField` for field-specific fallbacks instead. */
export function resolveSize(spec: SizeSpec, ctx: ResolveContext): number {
  if (typeof spec === "number") return requireFiniteSize(spec, spec);
  const node = parseSizeSpec(spec);
  return requireFiniteSize(evaluateNode(node, ctx), spec);
}

/** Context-free validity check. Use before emitting a raw string spec into
 * SSR/bootstrap CSS, where an invalid value would otherwise reach the
 * stylesheet verbatim. */
export function isValidSizeSpec(spec: SizeSpec): boolean {
  if (typeof spec === "number") return Number.isFinite(spec);
  try {
    parseSizeSpec(spec);
    return true;
  } catch {
    return false;
  }
}

function requireFiniteSize(value: number, spec: SizeSpec): number {
  if (Number.isFinite(value)) return value;
  throw new Error(`size must resolve to a finite number; received "${spec}"`);
}

// ─── field-aware safe resolution ────────────────────────────────────────────

export type SizeFieldOptions<F extends number | undefined> = {
  /** Diagnostic owner label, e.g. `<Panel panelId="sidebar">`. */
  label: string;
  /** The prop or action the spec came from, e.g. `minSize`. */
  property: string;
  /** Field-specific fallback returned when the spec is invalid. */
  fallback: F;
  /** `error` for required fields whose loss changes layout meaning
   * (a docked panel's `defaultSize`); defaults to `warn`. */
  severity?: "warn" | "error";
};

/**
 * `resolveSize` for consumer-authored input: invalid specs report a
 * development diagnostic — once per panel/property/value — and return the
 * caller's field-specific fallback instead of throwing. Production builds
 * stay silent; the fallback alone keeps layout math safe.
 */
export function resolveSizeField<F extends number | undefined>(
  spec: SizeSpec,
  ctx: ResolveContext,
  options: SizeFieldOptions<F>,
): number | F {
  try {
    return resolveSize(spec, ctx);
  } catch (err) {
    reportInvalidSize(spec, options, err);
    return options.fallback;
  }
}

// Warn-once registry keyed by panel/property/value. Module-level so remounts
// and re-renders cannot repeat a diagnostic the developer already saw;
// bounded as a safety net against dynamically generated invalid specs.
const REPORTED_SPECS_MAX = 512;
const reportedSpecs = new Set<string>();

function reportInvalidSize(
  spec: SizeSpec,
  options: SizeFieldOptions<number | undefined>,
  err: unknown,
): void {
  if (!IS_DEVELOPMENT) return;
  const key = `${options.label}|${options.property}|${String(spec)}`;
  if (reportedSpecs.has(key)) return;
  if (reportedSpecs.size >= REPORTED_SPECS_MAX) reportedSpecs.clear();
  reportedSpecs.add(key);
  const reason = err instanceof Error ? err.message : String(err);
  const message =
    `${options.label} ${options.property}: ${reason} ` +
    `Accepted sizes: a number of pixels (240), a unit string ` +
    `("240px", "33%", "2rem"), or "calc(50% - 24px)".`;
  if (options.severity === "error") errorDev(message);
  else warnDev(message);
}

/** Test-only: forget which invalid specs were already reported. */
export function resetSizeSpecWarningCacheForTests(): void {
  reportedSpecs.clear();
}

// ─── tokenizer ──────────────────────────────────────────────────────────────

type SizeToken =
  /** Numeric literal with its (possibly empty) unit, e.g. `240px`, `0`. */
  | { t: "num"; v: number; unit: string; raw: string; ws: boolean }
  | { t: "op"; op: "+" | "-" | "*" | "/"; ws: boolean }
  | { t: "open"; ws: boolean }
  | { t: "close"; ws: boolean }
  /** `ident(` — `calc(` opens a group; anything else is rejected. */
  | { t: "func"; name: string; ws: boolean };

const NUMBER_RE = /\d*\.?\d+/y;
const UNIT_RE = /[a-zA-Z%]*/y;
const IDENT_RE = /[a-zA-Z-][a-zA-Z0-9-]*/y;

function tokenizeSpec(input: string): SizeToken[] {
  const tokens: SizeToken[] = [];
  let i = 0;
  while (i < input.length) {
    const start = i;
    while (i < input.length && /\s/.test(input[i]!)) i += 1;
    const ws = i > start || tokens.length === 0;
    if (i >= input.length) break;
    if (tokens.length >= MAX_TOKENS) {
      throw new Error(`size "${truncate(input)}" has too many terms.`);
    }
    const ch = input[i]!;
    if (ch === "(" || ch === ")") {
      tokens.push({ t: ch === "(" ? "open" : "close", ws });
      i += 1;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      // A sign directly attached to a digit is part of the number in CSS
      // (`-24px` is a negative dimension); the parser reunites them, so the
      // tokenizer can always split.
      tokens.push({ t: "op", op: ch, ws });
      i += 1;
      continue;
    }
    NUMBER_RE.lastIndex = i;
    const num = NUMBER_RE.exec(input);
    if (num && num.index === i) {
      i = NUMBER_RE.lastIndex;
      UNIT_RE.lastIndex = i;
      const unit = UNIT_RE.exec(input)?.[0] ?? "";
      i += unit.length;
      tokens.push({
        t: "num",
        v: parseFloat(num[0]),
        unit: unit.toLowerCase(),
        raw: num[0] + unit,
        ws,
      });
      continue;
    }
    IDENT_RE.lastIndex = i;
    const ident = IDENT_RE.exec(input);
    if (ident && ident.index === i) {
      i = IDENT_RE.lastIndex;
      if (input[i] === "(") {
        const name = ident[0].toLowerCase();
        // Rejected here rather than in the parser so the diagnostic names
        // the function instead of tripping over its arguments first.
        if (name !== "calc") {
          throw new Error(
            `${name}() is not supported — sizes must resolve to pixels deterministically. ` +
              `Compute the value in JavaScript and pass the result instead.`,
          );
        }
        i += 1;
        tokens.push({ t: "func", name, ws });
        continue;
      }
      throw new Error(`unexpected "${ident[0]}" in size "${truncate(input)}".`);
    }
    throw new Error(`invalid character "${ch}" in size "${truncate(input)}".`);
  }
  return tokens;
}

function truncate(input: string): string {
  return input.length > 48 ? `${input.slice(0, 48)}…` : input;
}

// ─── parser ─────────────────────────────────────────────────────────────────

// Specs come from props and are static in practice, but every panel
// re-resolves its bounds on every render — the cache makes that a Map hit
// instead of a tokenize + parse per string spec per panel per frame during
// drags. Parse failures are cached too, so a repeated invalid spec rethrows
// without re-parsing. Bounded against pathological dynamic specs.
const AST_CACHE_MAX = 256;
const astCache = new Map<string, SizeNode | { error: Error }>();

function parseSizeSpec(spec: string): SizeNode {
  const trimmed = spec.trim();
  const cached = astCache.get(trimmed);
  if (cached) {
    if ("error" in cached) throw cached.error;
    return cached;
  }
  let result: SizeNode | { error: Error };
  try {
    result = parseTop(trimmed);
  } catch (error) {
    result = { error: error as Error };
  }
  if (astCache.size >= AST_CACHE_MAX) astCache.clear();
  astCache.set(trimmed, result);
  if ("error" in result) throw result.error;
  return result;
}

function parseTop(trimmed: string): SizeNode {
  if (trimmed === "") throw new Error(`size string is empty.`);
  if (trimmed.length > MAX_INPUT_LENGTH) {
    throw new Error(`size "${truncate(trimmed)}" is too long.`);
  }
  const parser = new SpecParser(tokenizeSpec(trimmed), trimmed);
  return parser.parseSize();
}

class SpecParser {
  private i = 0;
  private depth = 0;
  private readonly tokens: SizeToken[];
  private readonly input: string;
  constructor(tokens: SizeToken[], input: string) {
    this.tokens = tokens;
    this.input = input;
  }

  /** `size = dimension | zero | calc` — a single (optionally signed)
   * dimension, or one `calc()`. Arithmetic never appears at the top level. */
  parseSize(): SizeNode {
    const first = this.peek();
    if (first === undefined) throw new Error(`size string is empty.`);
    let node: SizeNode;
    if (first.t === "func") {
      node = this.parseFunction();
    } else if (first.t === "open") {
      throw new Error(
        `expressions must be wrapped in calc(): use "calc${this.input}" instead of "${this.input}".`,
      );
    } else {
      node = this.parseTopDimension();
    }
    const extra = this.peek();
    if (extra !== undefined) {
      if (extra.t === "op") {
        throw new Error(
          `arithmetic must be wrapped in calc(): use "calc(${this.input})" instead of "${this.input}".`,
        );
      }
      this.fail(extra);
    }
    return node;
  }

  /** Top-level `dimension | zero` with an optional attached sign; groups
   * only open through `calc()` at the top level. */
  private parseTopDimension(): SizeNode {
    let sign: 1 | -1 = 1;
    const first = this.peek();
    if (first?.t === "op" && (first.op === "+" || first.op === "-")) {
      sign = first.op === "-" ? -1 : 1;
      this.i += 1;
    }
    const tok = this.peek();
    if (tok?.t !== "num") {
      if (tok === undefined) {
        throw new Error(`size "${this.input}" ends unexpectedly.`);
      }
      this.fail(tok);
    }
    this.i += 1;
    const node = dimension(tok, this.input);
    return sign === 1 ? node : { t: "sum", terms: [{ sign, node }] };
  }

  /** `sum = unary, { whitespace, ("+" | "-"), whitespace, unary }` */
  private parseSum(): SizeNode {
    const terms: { sign: 1 | -1; node: SizeNode }[] = [
      { sign: 1, node: this.parseUnary() },
    ];
    for (;;) {
      const tok = this.peek();
      if (tok === undefined || tok.t === "close") break;
      if (tok.t !== "op" || tok.op === "*" || tok.op === "/") {
        if (tok.t === "op") {
          throw new Error(
            `"${tok.op}" is not supported inside calc() — only "+" and "-" are.`,
          );
        }
        this.fail(tok);
      }
      // CSS requires whitespace around binary "+"/"-" so a negative
      // dimension is never ambiguous; `calc(50% -24px)` is invalid there
      // and here.
      const rhs = this.tokens[this.i + 1];
      if (!tok.ws || rhs === undefined || !rhs.ws) {
        throw new Error(
          `"${tok.op}" inside calc() needs whitespace on both sides, as in "calc(50% ${tok.op} 24px)".`,
        );
      }
      this.i += 1;
      terms.push({ sign: tok.op === "+" ? 1 : -1, node: this.parseUnary() });
    }
    return terms.length === 1 && terms[0]!.sign === 1
      ? terms[0]!.node
      : { t: "sum", terms };
  }

  /** `unary = [ "+" | "-" ], primary` */
  private parseUnary(): SizeNode {
    const tok = this.peek();
    if (tok?.t === "op" && (tok.op === "+" || tok.op === "-")) {
      this.i += 1;
      const operand = this.parsePrimary();
      return tok.op === "-"
        ? { t: "sum", terms: [{ sign: -1, node: operand }] }
        : operand;
    }
    return this.parsePrimary();
  }

  /** `primary = dimension | zero | "(", sum, ")"` — a nested `calc(` is
   * treated exactly like `(`, matching CSS. */
  private parsePrimary(): SizeNode {
    const tok = this.peek();
    if (tok === undefined) {
      throw new Error(`size "${this.input}" ends unexpectedly.`);
    }
    if (tok.t === "open" || tok.t === "func") {
      if (tok.t === "func") return this.parseFunction();
      this.i += 1;
      return this.parseGroupBody();
    }
    if (tok.t === "num") {
      this.i += 1;
      return dimension(tok, this.input);
    }
    this.fail(tok);
  }

  /** The tokenizer only emits `calc(` function tokens. */
  private parseFunction(): SizeNode {
    this.i += 1;
    return this.parseGroupBody();
  }

  private parseGroupBody(): SizeNode {
    this.depth += 1;
    if (this.depth > MAX_NESTING_DEPTH) {
      throw new Error(`size "${truncate(this.input)}" nests too deeply.`);
    }
    const node = this.parseSum();
    const close = this.peek();
    if (close?.t !== "close") {
      throw new Error(`missing ")" in size "${truncate(this.input)}".`);
    }
    this.i += 1;
    this.depth -= 1;
    return node;
  }

  private peek(): SizeToken | undefined {
    return this.tokens[this.i];
  }

  private fail(tok: SizeToken): never {
    const shown =
      tok.t === "num"
        ? tok.raw
        : tok.t === "func"
          ? `${tok.name}(`
          : tok.t === "open"
            ? "("
            : tok.t === "close"
              ? ")"
              : tok.op;
    throw new Error(`unexpected "${shown}" in size "${truncate(this.input)}".`);
  }
}

/** `dimension = signed-decimal, unit` / `zero = "0"`. */
function dimension(
  tok: Extract<SizeToken, { t: "num" }>,
  input: string,
): SizeNode {
  if (tok.unit === "") {
    if (tok.v === 0) return { t: "dim", v: 0, u: "px" };
    throw new Error(
      `"${tok.raw}" has no unit — pass the number ${tok.raw} for pixels or "${tok.raw}px".`,
    );
  }
  if (!(UNITS as readonly string[]).includes(tok.unit)) {
    throw new Error(
      `unsupported unit "${tok.unit}" in size "${truncate(input)}" ` +
        `(supported: px, %, em, rem, vw, vh).`,
    );
  }
  return { t: "dim", v: tok.v, u: tok.unit as SizeUnit };
}

// ─── evaluation ─────────────────────────────────────────────────────────────

function evaluateNode(node: SizeNode, ctx: ResolveContext): number {
  if (node.t === "dim") return convertDimension(node, ctx);
  let total = 0;
  for (const term of node.terms) {
    total += term.sign * evaluateNode(term.node, ctx);
  }
  return total;
}

function convertDimension(
  node: Extract<SizeNode, { t: "dim" }>,
  ctx: ResolveContext,
): number {
  switch (node.u) {
    case "px":
      return node.v;
    case "%":
      return (node.v / 100) * ctx.containerSize;
    case "em":
      return node.v * ctx.fontSize;
    case "rem":
      return node.v * ctx.rootFontSize;
    case "vw":
      return (node.v / 100) * ctx.viewportWidth;
    case "vh":
      return (node.v / 100) * ctx.viewportHeight;
  }
}

/**
 * Build a ResolveContext from the live DOM. Reads the content element's
 * computed font-size for `em`, the document root's for `rem`, and window
 * dimensions for `vw`/`vh`. Falls back to 16px when the document isn't
 * available (SSR) or computed-style returns a non-number.
 *
 * Font sizes are read lazily (and cached) on first access: contexts are
 * built every render of every panel, but `getComputedStyle` forces a style
 * recalc and most specs are px/% — only `em`/`rem` specs should pay for it.
 *
 * Pass the element the consumer applies their styles to (not the
 * structural outer) so `em` reflects the consumer's typography.
 */
export function buildResolveContext(
  contentEl: HTMLElement | null,
  containerSize: number,
): ResolveContext {
  const hasWindow = typeof window !== "undefined";
  let rootFontSize: number | undefined;
  let fontSize: number | undefined;
  return {
    containerSize,
    get rootFontSize() {
      if (rootFontSize === undefined) {
        const root = hasWindow ? document.documentElement : null;
        rootFontSize = root
          ? parseFloat(getComputedStyle(root).fontSize) || 16
          : 16;
      }
      return rootFontSize;
    },
    get fontSize() {
      if (fontSize === undefined) {
        fontSize = contentEl
          ? parseFloat(getComputedStyle(contentEl).fontSize) ||
            this.rootFontSize
          : this.rootFontSize;
      }
      return fontSize;
    },
    viewportWidth: hasWindow ? window.innerWidth : 0,
    viewportHeight: hasWindow ? window.innerHeight : 0,
  };
}
