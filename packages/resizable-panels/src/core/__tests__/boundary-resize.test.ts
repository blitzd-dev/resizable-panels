import { describe, expect, it } from "vitest";
import { type BoundaryPanel, resizeBoundary } from "../boundary-resize";

const panel = (
  token: string,
  overrides: Partial<BoundaryPanel<string>> = {},
): BoundaryPanel<string> => ({
  token,
  minSize: 100,
  maxSize: 500,
  ...overrides,
});

const sizes = (...entries: [string, number][]) => new Map(entries);

describe("resizeBoundary", () => {
  it("moves a boundary in either direction while preserving the sum", () => {
    const panels = [panel("a"), panel("b")];
    const start = sizes(["a", 300], ["b", 300]);

    const right = resizeBoundary({
      panels,
      boundaryIndex: 1,
      delta: 80,
      fromSizes: start,
    });
    expect(right.sizes).toEqual(sizes(["a", 380], ["b", 220]));
    expect(right.appliedDelta).toBe(80);
    expect(right.limited).toBe(false);

    const left = resizeBoundary({
      panels,
      boundaryIndex: 1,
      delta: -60,
      fromSizes: start,
    });
    expect(left.sizes).toEqual(sizes(["a", 240], ["b", 360]));
    expect(left.appliedDelta).toBe(-60);
    expect([...left.sizes.values()].reduce((a, b) => a + b, 0)).toBe(600);
  });

  it("cascades outward from both sides of the boundary", () => {
    const result = resizeBoundary({
      panels: [panel("a"), panel("b"), panel("c"), panel("d")],
      boundaryIndex: 2,
      delta: 250,
      fromSizes: sizes(["a", 300], ["b", 450], ["c", 150], ["d", 400]),
    });

    // b grows to max first, then a; c shrinks to min first, then d.
    expect(result.sizes).toEqual(
      sizes(["a", 500], ["b", 500], ["c", 100], ["d", 200]),
    );
    expect(result.appliedDelta).toBe(250);
  });

  it("caps movement at the smaller side's capacity", () => {
    const result = resizeBoundary({
      panels: [panel("a"), panel("b")],
      boundaryIndex: 1,
      delta: 500,
      fromSizes: sizes(["a", 450], ["b", 160]),
    });
    expect(result.sizes).toEqual(sizes(["a", 500], ["b", 110]));
    expect(result.appliedDelta).toBe(50);
    expect(result.limited).toBe(true);
  });

  it("allows a directly resized pinned panel but skips it in a cascade", () => {
    const direct = resizeBoundary({
      panels: [panel("a", { pinned: true }), panel("b")],
      boundaryIndex: 1,
      delta: 50,
      fromSizes: sizes(["a", 300], ["b", 300]),
    });
    expect(direct.sizes).toEqual(sizes(["a", 350], ["b", 250]));

    const cascaded = resizeBoundary({
      panels: [panel("a", { pinned: true }), panel("b"), panel("c")],
      boundaryIndex: 2,
      delta: 150,
      fromSizes: sizes(["a", 300], ["b", 450], ["c", 300]),
    });
    expect(cascaded.sizes).toEqual(sizes(["a", 300], ["b", 500], ["c", 250]));
    expect(cascaded.limited).toBe(true);
  });

  it("treats disabled panels as hard resize barriers", () => {
    const result = resizeBoundary({
      panels: [panel("a"), panel("b", { disabled: true }), panel("c")],
      boundaryIndex: 1,
      delta: 50,
      fromSizes: sizes(["a", 300], ["b", 300], ["c", 300]),
    });
    expect(result.sizes).toEqual(sizes(["a", 300], ["b", 300], ["c", 300]));
    expect(result.appliedDelta).toBe(0);
    expect(result.limited).toBe(true);
  });

  it("recomputes from the original snapshot without drift", () => {
    const input = {
      panels: [panel("a"), panel("b")],
      boundaryIndex: 1,
      fromSizes: sizes(["a", 300], ["b", 300]),
    };
    expect(resizeBoundary({ ...input, delta: 180 }).sizes).toEqual(
      sizes(["a", 480], ["b", 120]),
    );
    expect(resizeBoundary({ ...input, delta: 40 }).sizes).toEqual(
      sizes(["a", 340], ["b", 260]),
    );
  });

  it("rejects a boundary outside the panel sequence", () => {
    const result = resizeBoundary({
      panels: [panel("a"), panel("b")],
      boundaryIndex: 0,
      delta: 20,
      fromSizes: sizes(["a", 300], ["b", 300]),
    });
    expect(result.appliedDelta).toBe(0);
    expect(result.limited).toBe(true);
  });
});
