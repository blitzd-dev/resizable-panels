import { describe, expect, it } from "vitest";
import {
  type ContainerLayoutPanel,
  distributeContainerLayout,
} from "../container-layout";

const panel = (
  token: string,
  overrides: Partial<ContainerLayoutPanel<string>> = {},
): ContainerLayoutPanel<string> => ({
  token,
  behavior: "proportional",
  collapsed: false,
  collapsedSize: 0,
  currentSize: 300,
  defaultSize: 300,
  minSize: 100,
  maxSize: 800,
  ...overrides,
});

describe("distributeContainerLayout", () => {
  it("keeps fixed panels in pixels and scales proportional panels", () => {
    const result = distributeContainerLayout(1_200, [
      panel("nav", { behavior: "fixed", currentSize: 240 }),
      panel("main", { currentSize: 480 }),
      panel("inspector", { currentSize: 240 }),
    ]);

    expect(result.sizes.get("nav")).toBeCloseTo(240);
    expect(result.sizes.get("main")).toBeCloseTo(640);
    expect(result.sizes.get("inspector")).toBeCloseTo(320);
  });

  it("gives unsized panels the leftover without moving explicit defaults", () => {
    const result = distributeContainerLayout(1_200, [
      panel("explicit", { currentSize: undefined, defaultSize: 300 }),
      panel("automatic", {
        currentSize: undefined,
        defaultSize: undefined,
        maxSize: 1_200,
      }),
    ]);

    expect(result.sizes.get("explicit")).toBeCloseTo(300);
    expect(result.sizes.get("automatic")).toBeCloseTo(900);
  });

  it("preserves an explicit zero instead of treating it as automatic", () => {
    const result = distributeContainerLayout(100, [
      panel("zero", {
        currentSize: 0,
        defaultSize: 0,
        minSize: 0,
        maxSize: 100,
      }),
      panel("remainder", {
        currentSize: 100,
        defaultSize: 100,
        minSize: 0,
        maxSize: 100,
      }),
    ]);

    expect(result.sizes.get("zero")).toBe(0);
    expect(result.sizes.get("remainder")).toBe(100);
    expect(result.unallocated).toBe(0);
  });

  it("reserves collapsed sizes outside the proportional pool", () => {
    const result = distributeContainerLayout(1_000, [
      panel("nav", {
        behavior: "fixed",
        collapsed: true,
        collapsedSize: 48,
      }),
      panel("main", { currentSize: 600 }),
      panel("inspector", { currentSize: 200 }),
    ]);

    expect(result.sizes.get("nav")).toBe(48);
    expect(result.sizes.get("main")).toBeCloseTo(714);
    expect(result.sizes.get("inspector")).toBeCloseTo(238);
  });

  // Contract (design-decisions §2.2): collapsed rails get no exception — a
  // declared size is a declared size. Rails keep `collapsedSize`, expanded
  // panels keep `minSize`, and the shortfall is reported, never absorbed.
  it("keeps declared rail sizes when collapsed rails are over-constrained", () => {
    const result = distributeContainerLayout(90, [
      panel("start", {
        behavior: "fixed",
        collapsed: true,
        collapsedSize: 80,
      }),
      panel("content", { currentSize: 300, minSize: 30 }),
      panel("end", {
        behavior: "fixed",
        collapsed: true,
        collapsedSize: 40,
      }),
    ]);

    expect(result.sizes.get("start")).toBe(80);
    expect(result.sizes.get("content")).toBe(30);
    expect(result.sizes.get("end")).toBe(40);
    expect(
      [...result.sizes.values()].reduce((sum, size) => sum + size, 0),
    ).toBeCloseTo(150);
    expect(result.overconstrained).toBeCloseTo(60);
    expect(result.unallocated).toBe(0);
  });

  // Contract (PLAN Batch 1, container-0 decision): no special case at
  // container 0 — floors hold at any container size and `overconstrained`
  // reports the full shortfall.
  it("holds rail floors at container zero and reports the full shortfall", () => {
    const result = distributeContainerLayout(0, [
      panel("first", { collapsed: true, collapsedSize: 80 }),
      panel("second", { collapsed: true, collapsedSize: 40 }),
    ]);

    expect(result.sizes.get("first")).toBe(80);
    expect(result.sizes.get("second")).toBe(40);
    expect(result.overconstrained).toBeCloseTo(120);
    expect(result.unallocated).toBe(0);
  });

  it("water-fills around min and max constraints", () => {
    const result = distributeContainerLayout(900, [
      panel("small", { currentSize: 100, maxSize: 150 }),
      panel("large", { currentSize: 500 }),
    ]);

    expect(result.sizes.get("small")).toBe(150);
    expect(result.sizes.get("large")).toBeCloseTo(750);
  });

  // Contract (design-decisions §1.3/§2.1): a declared minimum is a floor.
  // Fixed reservations yield surplus first but stop AT Σ(fixed minSize);
  // the excess is reported as `overconstrained`, never squished away.
  it("floors fixed reservations at their minimums instead of squishing them", () => {
    const result = distributeContainerLayout(300, [
      panel("fixed", {
        behavior: "fixed",
        currentSize: 250,
        minSize: 200,
      }),
      panel("flex", { currentSize: 200, minSize: 150 }),
    ]);

    expect(result.sizes.get("fixed")).toBeCloseTo(200);
    expect(result.sizes.get("flex")).toBeCloseTo(150);
    expect(result.overconstrained).toBeCloseTo(50);
    expect(result.unallocated).toBe(0);
  });

  it("uses the last expanded panel when every panel is fixed", () => {
    const result = distributeContainerLayout(800, [
      panel("first", {
        behavior: "fixed",
        currentSize: 300,
      }),
      panel("second", {
        behavior: "fixed",
        currentSize: 300,
      }),
    ]);

    expect(result.usedFallback).toBe(true);
    expect(result.sizes.get("first")).toBeCloseTo(300);
    expect(result.sizes.get("second")).toBeCloseTo(500);
  });

  it("reports space that max constraints cannot absorb", () => {
    const result = distributeContainerLayout(1_000, [
      panel("first", { maxSize: 300 }),
      panel("second", { maxSize: 300 }),
    ]);

    expect(result.sizes.get("first")).toBe(300);
    expect(result.sizes.get("second")).toBe(300);
    expect(result.unallocated).toBe(400);
  });

  // Contract (design-decisions §2.1, never-squish): when the container cannot
  // hold the proportional floors, every proportional panel is allocated
  // exactly `minSize` and the shortfall is reported as `overconstrained`.
  it("allocates exactly minSize and reports the shortfall below the floors", () => {
    const result = distributeContainerLayout(200, [
      panel("first", { minSize: 120 }),
      panel("second", { minSize: 120 }),
    ]);

    expect(result.sizes.get("first")).toBe(120);
    expect(result.sizes.get("second")).toBe(120);
    expect(result.overconstrained).toBeCloseTo(40);
    expect(result.unallocated).toBe(0);
  });

  // Sum invariant (PLAN Batch 1): Σ === clamp(container, Σ floors, Σ ceilings).
  // Shortfall above the ceilings reports as `unallocated`, below the floors as
  // `overconstrained` — symmetric fields, at most one of them non-zero.
  it("reports unallocated above the ceilings and overconstrained below the floors", () => {
    const panels = () => [
      panel("first", { currentSize: 300, minSize: 120, maxSize: 300 }),
      panel("second", { currentSize: 300, minSize: 120, maxSize: 300 }),
    ];

    const above = distributeContainerLayout(700, panels());
    expect(above.sizes.get("first")).toBe(300);
    expect(above.sizes.get("second")).toBe(300);
    expect(above.overconstrained).toBe(0);
    expect(above.unallocated).toBe(100);

    const fitting = distributeContainerLayout(500, panels());
    expect(fitting.sizes.get("first")).toBeCloseTo(250);
    expect(fitting.sizes.get("second")).toBeCloseTo(250);
    expect(fitting.overconstrained).toBe(0);
    expect(fitting.unallocated).toBe(0);

    const below = distributeContainerLayout(200, panels());
    expect(below.sizes.get("first")).toBe(120);
    expect(below.sizes.get("second")).toBe(120);
    expect(below.overconstrained).toBeCloseTo(40);
    expect(below.unallocated).toBe(0);
  });
});
