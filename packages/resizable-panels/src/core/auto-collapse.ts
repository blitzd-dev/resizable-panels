// R-37 `collapsible="auto"` — the pure prefix rule (DESIGN-autocollapse §3/§4
// item 2). The fold set is a pure function of declared floors, gutters, and
// container width; it owns no state that survives a resize and cannot flap,
// because the trigger (container width) is exogenous to the fold it drives.
import { SIZE_EPSILON } from "./size.js";

export type AutoPanel<T> = {
  token: T;
  /** Declaration order index (ascending = declared earlier = more primary). */
  order: number;
  minSize: number; // μ
  collapsedSize: number; // γ
  /** collapsible === "auto" AND not controlled AND armed. */
  auto: boolean;
  /** Asymmetric release band (px): once folded, this panel releases only when
   * W ≥ Tⱼ + band, not at Tⱼ. Absorbs ResizeObserver sub-pixel jitter around
   * the threshold so a boundary-parked width cannot flap (F1/F2). Default 0. */
  releaseBand?: number;
};

/** A panel is auto-eligible iff a fold actually frees space: γ < μ, and the
 * rail is non-zero (refuse-to-arm at collapsedSize ≤ SIZE_EPSILON, C3). */
export function isAutoEligible<T>(p: AutoPanel<T>): boolean {
  return (
    p.auto && p.collapsedSize > SIZE_EPSILON && p.collapsedSize < p.minSize
  );
}

/** Fold order = eligible auto panels, trailing-first (reverse declaration). */
function foldOrder<T>(panels: readonly AutoPanel<T>[]): AutoPanel<T>[] {
  return panels.filter(isAutoEligible).sort((a, b) => b.order - a.order);
}

/** The all-expanded floor sum: Σ minSize over every panel + gutters. */
function expandedFloor<T>(
  panels: readonly AutoPanel<T>[],
  gutters: number,
): number {
  return panels.reduce((s, p) => s + p.minSize, gutters);
}

/**
 * Static thresholds in fold order. Tⱼ is the container width at/below which
 * the j-th fold arms: Tⱼ = B − Σ_{i<j}(μᵢ − γᵢ). Monotone strictly
 * decreasing (each freed = μ − γ > 0 by eligibility), so the rule cannot flap:
 * the trigger (W) is exogenous and untouched by the fold's redistribution.
 */
export function computeAutoThresholds<T>(
  panels: readonly AutoPanel<T>[],
  gutters: number,
): { token: T; threshold: number }[] {
  const order = foldOrder(panels);
  const B = expandedFloor(panels, gutters);
  let freed = 0;
  const out: { token: T; threshold: number }[] = [];
  for (const p of order) {
    out.push({ token: p.token, threshold: B - freed });
    freed += p.minSize - p.collapsedSize;
  }
  return out;
}

/**
 * The fold set at container width W: the shortest trailing-first prefix of
 * eligible panels whose collapse makes the floors fit. All-collapsed hand-off:
 * if every eligible panel is folded and floors still exceed W, the residue
 * overflows through the shipped never-squish path (overconstrained > 0).
 */
export function computeAutoFoldSet<T>(
  panels: readonly AutoPanel<T>[],
  gutters: number,
  containerSize: number,
  previouslyFolded?: ReadonlySet<T>,
): { folded: Set<T>; order: T[]; overconstrained: number } {
  const order = foldOrder(panels);
  const B = expandedFloor(panels, gutters);
  const folded = new Set<T>();
  let floor = B; // running floor with panels up to here still expanded = Tⱼ
  for (const p of order) {
    // Fold edge is Tⱼ (= floor); a panel already folded holds until W rises a
    // release band above it, so ResizeObserver jitter at Tⱼ cannot flap it.
    const wasFolded = previouslyFolded?.has(p.token) ?? false;
    const edge = wasFolded ? floor + (p.releaseBand ?? 0) : floor;
    if (containerSize + SIZE_EPSILON >= edge) break;
    folded.add(p.token);
    floor -= p.minSize - p.collapsedSize;
  }
  return {
    folded,
    order: order.map((p) => p.token),
    overconstrained: Math.max(0, floor - containerSize),
  };
}
