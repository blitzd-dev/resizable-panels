import { describe, expect, it } from "vitest";
// R-37 auto-collapse pure prefix module (fail-first, Batch 4 Stage 1). This
// module does not exist at baseline — the import throws, so every test here is
// RED until Stage 2 lands `src/auto-collapse.ts`. The API mirrors the Stage 1
// prototype (see test-results/r37-batch4/r37-prototype.patch).
import {
  type AutoPanel,
  computeAutoFoldSet,
  computeAutoThresholds,
  isAutoEligible,
} from "../auto-collapse";

const p = (
  token: string,
  order: number,
  overrides: Partial<AutoPanel<string>> = {},
): AutoPanel<string> => ({
  token,
  order,
  minSize: 200,
  collapsedSize: 48,
  auto: true,
  ...overrides,
});

// Canonical layout: nav (primary, declared first) + main (not auto) +
// inspector (trailing). Floors B = 200 + 300 + 240 = 740.
const layout = (): AutoPanel<string>[] => [
  p("nav", 0, { minSize: 200, collapsedSize: 48 }),
  p("main", 1, { minSize: 300, auto: false, collapsedSize: 0 }),
  p("inspector", 2, { minSize: 240, collapsedSize: 48 }),
];

describe("auto-collapse pure prefix", () => {
  it("orders thresholds trailing-first (reverse declaration)", () => {
    const t = computeAutoThresholds(layout(), 0);
    expect(t.map((x) => x.token)).toEqual(["inspector", "nav"]);
    // Tinspector = B = 740 (fold inspector first). Tnav = 740 - (240-48) = 548.
    expect(t[0]).toMatchObject({ token: "inspector", threshold: 740 });
    expect(t[1]).toMatchObject({ token: "nav", threshold: 548 });
  });

  it("gates eligibility on gamma < mu and a non-zero rail", () => {
    expect(isAutoEligible(p("a", 0, { minSize: 240, collapsedSize: 48 }))).toBe(
      true,
    );
    // Rail >= min: a fold would raise the floor, not free it → excluded.
    expect(isAutoEligible(p("b", 0, { minSize: 80, collapsedSize: 120 }))).toBe(
      false,
    );
    // collapsedSize resolves to 0 → refuse to arm (C3).
    expect(isAutoEligible(p("c", 0, { collapsedSize: 0 }))).toBe(false);
    // not auto → never eligible.
    expect(isAutoEligible(p("d", 0, { auto: false }))).toBe(false);
  });

  it("never un-folds as the container shrinks (monotone, no flap)", () => {
    let prev = new Set<string>();
    for (let W = 800; W >= 300; W -= 5) {
      const { folded } = computeAutoFoldSet(layout(), 0, W);
      for (const token of prev) {
        expect(folded.has(token)).toBe(true); // once folded, stays folded
      }
      prev = folded;
    }
  });

  it("folds the shortest trailing-first prefix that makes the floors fit", () => {
    expect([...computeAutoFoldSet(layout(), 0, 800).folded]).toEqual([]);
    expect([...computeAutoFoldSet(layout(), 0, 700).folded]).toEqual([
      "inspector",
    ]);
    expect(new Set(computeAutoFoldSet(layout(), 0, 500).folded)).toEqual(
      new Set(["inspector", "nav"]),
    );
  });

  it("keeps gutters constant across the fold (thresholds shift by exactly the gutter sum)", () => {
    const g0 = computeAutoThresholds(layout(), 0);
    const g24 = computeAutoThresholds(layout(), 24);
    for (let i = 0; i < g0.length; i++) {
      expect(g24[i].threshold - g0[i].threshold).toBe(24);
    }
  });

  it("hands off to never-squish overflow when every eligible panel is folded", () => {
    // Floor with both folded = 48 + 300 + 48 = 396. Below that, the residue
    // overflows (overconstrained > 0) rather than folding further.
    const { folded, overconstrained } = computeAutoFoldSet(layout(), 0, 300);
    expect(new Set(folded)).toEqual(new Set(["inspector", "nav"]));
    expect(overconstrained).toBeCloseTo(96, 0); // 396 - 300
  });
});
