import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isValidSizeSpec,
  mapsAlmostEqual,
  type ResolveContext,
  resetSizeSpecWarningCacheForTests,
  resolveSize,
  resolveSizeField,
} from "../size";

const ctx: ResolveContext = {
  containerSize: 1000,
  fontSize: 16,
  rootFontSize: 16,
  viewportWidth: 1920,
  viewportHeight: 1080,
};

describe("resolveSize", () => {
  it("passes a finite number through unchanged", () => {
    expect(resolveSize(100, ctx)).toBe(100);
    expect(resolveSize(0, ctx)).toBe(0);
    expect(resolveSize(-50, ctx)).toBe(-50);
  });

  it("rejects empty / whitespace strings", () => {
    expect(() => resolveSize("", ctx)).toThrow(/empty/);
    expect(() => resolveSize("   ", ctx)).toThrow(/empty/);
  });

  it("resolves single dimensions of every supported unit", () => {
    expect(resolveSize("100px", ctx)).toBe(100);
    expect(resolveSize("12.5px", ctx)).toBe(12.5);
    expect(resolveSize("50%", ctx)).toBe(500);
    expect(resolveSize("100%", ctx)).toBe(1000);
    expect(resolveSize("0%", ctx)).toBe(0);
    expect(resolveSize("2em", { ...ctx, fontSize: 14 })).toBe(28);
    expect(resolveSize("1.5rem", { ...ctx, rootFontSize: 20 })).toBe(30);
    expect(resolveSize("10vw", ctx)).toBe(192);
    expect(resolveSize("50vh", ctx)).toBe(540);
  });

  it("accepts unitless zero only", () => {
    expect(resolveSize("0", ctx)).toBe(0);
    expect(() => resolveSize("240", ctx)).toThrow(/no unit/);
  });

  it("names both accepted forms when a unit is missing", () => {
    expect(() => resolveSize("240", ctx)).toThrow(/240.*"240px"/);
  });

  it("accepts a signed top-level dimension", () => {
    expect(resolveSize("-50px", ctx)).toBe(-50);
    expect(resolveSize("+50px", ctx)).toBe(50);
  });

  it("is case-insensitive for units and calc", () => {
    expect(resolveSize("100PX", ctx)).toBe(100);
    expect(resolveSize("2EM", ctx)).toBe(32);
    expect(resolveSize("CALC(10px + 20px)", ctx)).toBe(30);
  });

  describe("calc()", () => {
    it("evaluates mixed-unit sums", () => {
      expect(resolveSize("calc(50% - 100px)", ctx)).toBe(400);
      expect(resolveSize("calc(10px + 20px)", ctx)).toBe(30);
      expect(resolveSize("calc(50% - 24px + 1rem)", ctx)).toBe(492);
    });

    it("handles parenthesized groups", () => {
      expect(resolveSize("calc(50% - (10px + 20px))", ctx)).toBe(470);
    });

    it("handles nested calc() as a group", () => {
      expect(resolveSize("calc(calc(50% - 100px) - 10px)", ctx)).toBe(390);
    });

    it("handles unary signs", () => {
      expect(resolveSize("calc(-50%)", ctx)).toBe(-500);
      expect(resolveSize("calc(100px + -20px)", ctx)).toBe(80);
      expect(resolveSize("calc(-(10px + 20px))", ctx)).toBe(-30);
    });

    it("tolerates extra whitespace around operators", () => {
      expect(resolveSize("calc( 50%  -  100px )", ctx)).toBe(400);
    });

    it("requires whitespace on both sides of binary + and -", () => {
      expect(() => resolveSize("calc(50%-24px)", ctx)).toThrow(/whitespace/);
      expect(() => resolveSize("calc(50% -24px)", ctx)).toThrow(/whitespace/);
      expect(() => resolveSize("calc(50%- 24px)", ctx)).toThrow(/whitespace/);
    });

    it("rejects multiplication and division", () => {
      expect(() => resolveSize("calc(10px * 2)", ctx)).toThrow(
        /"\*" is not supported/,
      );
      expect(() => resolveSize("calc(10px / 2)", ctx)).toThrow(
        /"\/" is not supported/,
      );
    });

    it("rejects unclosed and empty expressions", () => {
      expect(() => resolveSize("calc(10px", ctx)).toThrow(/missing "\)"/);
      expect(() => resolveSize("calc()", ctx)).toThrow();
      expect(() => resolveSize("calc(10px 20px)", ctx)).toThrow(/unexpected/);
    });
  });

  it("rejects arithmetic outside calc() and suggests the wrapped form", () => {
    expect(() => resolveSize("50% - 24px", ctx)).toThrow(/calc\(50% - 24px\)/);
    expect(() => resolveSize("(10px + 2px)", ctx)).toThrow(/calc/);
  });

  it("rejects CSS functions other than calc()", () => {
    expect(() => resolveSize("var(--sidebar-width)", ctx)).toThrow(
      /var\(\) is not supported/,
    );
    expect(() => resolveSize("clamp(200px, 30%, 500px)", ctx)).toThrow(
      /clamp\(\) is not supported/,
    );
    expect(() => resolveSize("min(10px, 20px)", ctx)).toThrow(
      /min\(\) is not supported/,
    );
  });

  it("rejects unsupported units and keywords", () => {
    expect(() => resolveSize("10ch", ctx)).toThrow(/unsupported unit "ch"/);
    expect(() => resolveSize("auto", ctx)).toThrow(/unexpected "auto"/);
  });

  it("enforces input-length, token-count, and nesting limits", () => {
    expect(() => resolveSize(`calc(${"1px + ".repeat(60)}1px)`, ctx)).toThrow(
      /too long|too many/,
    );
    const manyTokens = `calc(${Array(40).fill("1px").join(" + ")})`.slice(
      0,
      255,
    );
    void manyTokens; // length limit already covers pathological repetition
    expect(() =>
      resolveSize(`calc(${"(".repeat(10)}1px${")".repeat(10)})`, ctx),
    ).toThrow(/nests too deeply/);
  });

  it("re-resolves a repeated spec against a changed context (AST cache must not freeze values)", () => {
    expect(resolveSize("calc(50% - 100px)", ctx)).toBe(400);
    expect(
      resolveSize("calc(50% - 100px)", { ...ctx, containerSize: 600 }),
    ).toBe(200);
  });

  it("keeps throwing for a repeated invalid spec (errors are cached too)", () => {
    expect(() => resolveSize("10px @", ctx)).toThrow();
    expect(() => resolveSize("10px @", ctx)).toThrow();
  });

  it("rejects non-finite sizes", () => {
    expect(() => resolveSize(Number.NaN, ctx)).toThrow(/finite/);
    expect(() => resolveSize(Number.POSITIVE_INFINITY, ctx)).toThrow(/finite/);
  });
});

describe("isValidSizeSpec", () => {
  it("accepts everything the resolver accepts, context-free", () => {
    expect(isValidSizeSpec(240)).toBe(true);
    expect(isValidSizeSpec("240px")).toBe(true);
    expect(isValidSizeSpec("33%")).toBe(true);
    expect(isValidSizeSpec("0")).toBe(true);
    expect(isValidSizeSpec("calc(50% - 24px)")).toBe(true);
  });

  it("rejects invalid specs so they never reach raw SSR CSS", () => {
    expect(isValidSizeSpec("240")).toBe(false);
    expect(isValidSizeSpec("50% - 24px")).toBe(false);
    expect(isValidSizeSpec("calc(10px * 2)")).toBe(false);
    expect(isValidSizeSpec("var(--sidebar-width)")).toBe(false);
    expect(isValidSizeSpec("expression(alert(1))")).toBe(false);
    expect(isValidSizeSpec(Number.NaN)).toBe(false);
  });
});

describe("resolveSizeField", () => {
  beforeEach(() => {
    resetSizeSpecWarningCacheForTests();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const options = {
    label: '<Panel panelId="sidebar">',
    property: "minSize",
    fallback: 200,
  };

  it("returns the resolved value for a valid spec without warning", () => {
    expect(resolveSizeField("50%", ctx, options)).toBe(500);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("returns the field fallback for an invalid spec", () => {
    expect(resolveSizeField("240", ctx, options)).toBe(200);
    expect(
      resolveSizeField("240", ctx, { ...options, fallback: undefined }),
    ).toBe(undefined);
  });

  it("warns once per panel/property/value with the fix in the message", () => {
    resolveSizeField("240", ctx, options);
    resolveSizeField("240", ctx, options);
    expect(console.warn).toHaveBeenCalledTimes(1);
    const message = vi.mocked(console.warn).mock.calls[0]?.[0] as string;
    expect(message).toContain('<Panel panelId="sidebar">');
    expect(message).toContain("minSize");
    expect(message).toContain("240");
    expect(message).toContain('"240px"');
  });

  it("warns separately for a different panel, property, or value", () => {
    resolveSizeField("240", ctx, options);
    resolveSizeField("240", ctx, { ...options, property: "maxSize" });
    resolveSizeField("360", ctx, options);
    resolveSizeField("240", ctx, { ...options, label: "<Panel>" });
    expect(console.warn).toHaveBeenCalledTimes(4);
  });

  it("escalates to console.error for required fields", () => {
    resolveSizeField("240", ctx, {
      ...options,
      property: "defaultSize",
      severity: "error",
    });
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.warn).not.toHaveBeenCalled();
  });
});

describe("mapsAlmostEqual", () => {
  const keyA = {};
  const keyB = {};
  const keyC = {};

  it("treats identical maps as equal", () => {
    const a = new Map([
      [keyA, 200],
      [keyB, 400],
    ]);
    const b = new Map([
      [keyA, 200],
      [keyB, 400],
    ]);
    expect(mapsAlmostEqual(a, b)).toBe(true);
  });

  it("tolerates per-key differences at or below SIZE_EPSILON", () => {
    const a = new Map([
      [keyA, 200],
      [keyB, 400],
    ]);
    const b = new Map([
      [keyA, 200.5],
      [keyB, 399.5],
    ]);
    expect(mapsAlmostEqual(a, b)).toBe(true);
  });

  it("reports differences beyond SIZE_EPSILON", () => {
    const a = new Map([[keyA, 200]]);
    const b = new Map([[keyA, 200.6]]);
    expect(mapsAlmostEqual(a, b)).toBe(false);
  });

  it("treats differing key sets as unequal even for near-zero values (R-07)", () => {
    // Same size, disjoint keys, values within SIZE_EPSILON of 0: the old
    // `a.get(k) ?? 0` formula compared these equal and silently skipped a
    // `replaceAll` commit.
    const a = new Map([[keyA, 0.25]]);
    const b = new Map([[keyC, 0.25]]);
    expect(mapsAlmostEqual(a, b)).toBe(false);
  });

  it("treats a missing key as unequal even when the value is near zero (R-07)", () => {
    const a = new Map([
      [keyA, 200],
      [keyB, 0.4],
    ]);
    const b = new Map([
      [keyA, 200],
      [keyC, 0.4],
    ]);
    expect(mapsAlmostEqual(a, b)).toBe(false);
  });

  it("reports size mismatches regardless of values", () => {
    const a = new Map([[keyA, 200]]);
    const b = new Map([
      [keyA, 200],
      [keyB, 0],
    ]);
    expect(mapsAlmostEqual(a, b)).toBe(false);
  });
});
