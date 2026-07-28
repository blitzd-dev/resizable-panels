import type { PanelContainerResizeBehavior } from "../types.js";
import { clamp } from "./size.js";

export type ContainerLayoutPanel<T> = {
  token: T;
  behavior: PanelContainerResizeBehavior;
  collapsed: boolean;
  collapsedSize: number;
  currentSize?: number;
  defaultSize?: number;
  minSize: number;
  maxSize: number;
};

export type ContainerLayoutResult<T> = {
  sizes: Map<T, number>;
  /** True when an all-fixed layout needed a deterministic flexible fallback. */
  usedFallback: boolean;
  /** Space that could not be allocated without exceeding a panel maximum. */
  unallocated: number;
  /** Space by which the panels' floors exceed the container — the shortfall
   * the group overflows and clips (never-squish). Symmetric with
   * `unallocated`; at most one of the two is non-zero. */
  overconstrained: number;
};

/**
 * Allocate a group's main-axis size in one deterministic pass.
 *
 * A declared size is a declared size (design-decisions §1.3/§2.1): panels are
 * never compressed below their floor — `collapsedSize` for a collapsed rail,
 * `minSize` for an expanded panel. Collapsed panels reserve `collapsedSize`;
 * expanded fixed panels yield surplus toward their `minSize` first, then
 * expanded proportional panels stop AT their `minSize`. When the floors exceed
 * the container the excess overflows past the group's end edge and the
 * shortfall is reported through `overconstrained` (symmetric with the
 * maximum-binding `unallocated`) so the React layer can declare and warn.
 * Otherwise proportional panels divide the remainder preserving their relative
 * weights and respecting min/max constraints.
 *
 * A group with no proportional panel promotes its last expanded panel as a
 * fallback. This preserves the sum invariant and is surfaced through
 * `usedFallback` so the React layer can issue a development diagnostic.
 */
export function distributeContainerLayout<T>(
  containerSize: number,
  panels: readonly ContainerLayoutPanel<T>[],
): ContainerLayoutResult<T> {
  const sizes = new Map<T, number>();
  const active = panels.filter((panel) => !panel.collapsed);
  const containerAvailable = Math.max(0, containerSize);
  let available = containerAvailable;
  let usedFallback = false;

  // `overconstrained` falls out of the committed sizes rather than being
  // tracked per branch, so every early return stays honest.
  const finish = (unallocated: number): ContainerLayoutResult<T> => {
    let total = 0;
    for (const size of sizes.values()) total += size;
    return {
      sizes,
      usedFallback,
      unallocated,
      overconstrained: Math.max(0, total - containerAvailable),
    };
  };

  const collapsed = panels.filter((panel) => panel.collapsed);
  // A collapsed rail keeps its declared `collapsedSize` at any container
  // size — no compression exception (design-decisions §2.2).
  for (const panel of collapsed) {
    const size = Math.max(0, panel.collapsedSize);
    sizes.set(panel.token, size);
    available -= size;
  }
  available = Math.max(0, available);

  let proportional = active.filter(
    (panel) => panel.behavior === "proportional",
  );
  let fixed = active.filter((panel) => panel.behavior === "fixed");
  if (proportional.length === 0 && fixed.length > 0) {
    usedFallback = true;
    proportional = [fixed[fixed.length - 1]];
    fixed = fixed.slice(0, -1);
  }

  const fixedSizes = new Map<T, number>();
  let fixedSum = 0;
  for (const panel of fixed) {
    const size = clamp(
      preferredSize(panel, available / Math.max(1, active.length)),
      panel.minSize,
      panel.maxSize,
    );
    fixedSizes.set(panel.token, size);
    fixedSum += size;
  }

  const minimumProportionalSum = proportional.reduce(
    (sum, panel) => sum + panel.minSize,
    0,
  );
  const desiredProportionalSpace = available - fixedSum;

  // Fixed reservations yield surplus before proportional panels, but never
  // below their own floor; what cannot be recovered overflows.
  if (desiredProportionalSpace < minimumProportionalSum && fixedSum > 0) {
    const fixedMinSum = fixed.reduce((sum, panel) => sum + panel.minSize, 0);
    const targetFixedSum = Math.max(
      fixedMinSum,
      available - minimumProportionalSum,
    );
    // Surplus is removed proportionally to shrink capacity (`size − minSize`);
    // `targetFixedSum ≥ fixedMinSum` keeps one pass sufficient.
    const toRemove = fixedSum - targetFixedSum;
    const totalCapacity = fixed.reduce(
      (sum, panel) =>
        sum + Math.max(0, (fixedSizes.get(panel.token) ?? 0) - panel.minSize),
      0,
    );
    if (toRemove > 0 && totalCapacity > 0) {
      const shrinkRatio = Math.min(1, toRemove / totalCapacity);
      fixedSum = 0;
      for (const panel of fixed) {
        const current = fixedSizes.get(panel.token) ?? 0;
        const capacity = Math.max(0, current - panel.minSize);
        const size = current - capacity * shrinkRatio;
        fixedSizes.set(panel.token, size);
        fixedSum += size;
      }
    }
  }

  for (const [token, size] of fixedSizes) sizes.set(token, size);

  const proportionalSpace = Math.max(0, available - fixedSum);
  if (proportional.length === 0) {
    return finish(Math.max(0, available - fixedSum));
  }

  if (proportionalSpace < minimumProportionalSum) {
    // Container below the declared floors: allocate exactly `minSize` and
    // let the excess overflow.
    for (const panel of proportional) {
      sizes.set(panel.token, panel.minSize);
    }
    return finish(0);
  }

  // Find the scale whose clamped weighted sizes exactly fill the flexible
  // space. Binary search is small, deterministic, and handles panels hitting
  // different min/max bounds without branchy redistribution loops.
  const explicitWeights = proportional.map((panel) => {
    if (panel.currentSize !== undefined) {
      return Math.max(0, panel.currentSize);
    }
    if (panel.defaultSize !== undefined) {
      return Math.max(0, panel.defaultSize);
    }
    return undefined;
  });
  const explicitSum = explicitWeights.reduce<number>(
    (sum, value) => sum + (value ?? 0),
    0,
  );
  const missingCount = explicitWeights.filter(
    (value) => value === undefined,
  ).length;
  const leftover = Math.max(0, proportionalSpace - explicitSum);
  const automaticWeight =
    missingCount > 0 && leftover > 0
      ? leftover / missingCount
      : proportionalSpace / proportional.length;
  const weights = explicitWeights.map((value, index) =>
    Math.max(0, proportional[index].minSize, value ?? automaticWeight),
  );
  // A zero weight is deliberately ineligible for proportional growth. This
  // is what keeps an explicit zero distinct from an unresolved automatic
  // panel. It can still be raised by a positive minimum constraint.
  const reachableMaximum = proportional.reduce(
    (sum, panel, index) =>
      sum + (weights[index] > 0 ? panel.maxSize : panel.minSize),
    0,
  );
  if (proportionalSpace >= reachableMaximum) {
    for (let index = 0; index < proportional.length; index++) {
      const panel = proportional[index];
      sizes.set(
        panel.token,
        weights[index] > 0 ? panel.maxSize : panel.minSize,
      );
    }
    return finish(Math.max(0, proportionalSpace - reachableMaximum));
  }
  let low = 0;
  let high = 1;
  while (
    sumScaled(proportional, weights, high) < proportionalSpace &&
    high < Number.MAX_SAFE_INTEGER
  ) {
    high *= 2;
  }
  for (let index = 0; index < 60; index++) {
    const middle = (low + high) / 2;
    if (sumScaled(proportional, weights, middle) < proportionalSpace) {
      low = middle;
    } else {
      high = middle;
    }
  }
  for (let index = 0; index < proportional.length; index++) {
    const panel = proportional[index];
    sizes.set(
      panel.token,
      clamp(weights[index] * high, panel.minSize, panel.maxSize),
    );
  }

  return finish(0);
}

function preferredSize<T>(
  panel: ContainerLayoutPanel<T>,
  fallback: number,
): number {
  if (panel.currentSize !== undefined) {
    return Math.max(0, panel.currentSize);
  }
  if (panel.defaultSize !== undefined) {
    return Math.max(0, panel.defaultSize);
  }
  return Math.max(panel.minSize, fallback);
}

function sumScaled<T>(
  panels: readonly ContainerLayoutPanel<T>[],
  weights: readonly number[],
  scale: number,
): number {
  let sum = 0;
  for (let index = 0; index < panels.length; index++) {
    const panel = panels[index];
    sum += clamp(weights[index] * scale, panel.minSize, panel.maxSize);
  }
  return sum;
}
