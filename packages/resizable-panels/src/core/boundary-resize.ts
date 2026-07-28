/**
 * Pure resize math for a separator between two ordered panels.
 *
 * A positive delta moves the boundary toward the end of the group: panels on
 * the start side grow and panels on the end side shrink. A negative delta does
 * the opposite. Capacity cascades outward from the boundary on each side and
 * the applied delta is capped by the smaller of the grow and shrink capacity,
 * preserving the total size exactly.
 */

export type BoundaryPanel<T> = {
  token: T;
  minSize: number;
  maxSize: number;
  /** A disabled panel cannot resize directly or indirectly. */
  disabled?: boolean;
  /** A pinned panel may resize at its own adjacent boundary but is skipped by
   * cascades that reach it from farther away. */
  pinned?: boolean;
};

export type BoundaryResizeInput<T> = {
  panels: readonly BoundaryPanel<T>[];
  /** Number of panels before the separator; must be in `1..length - 1`. */
  boundaryIndex: number;
  /** Signed movement from the start of the interaction. */
  delta: number;
  /** Panel sizes captured at interaction start. */
  fromSizes: ReadonlyMap<T, number>;
};

export type BoundaryResizeResult<T> = {
  sizes: Map<T, number>;
  appliedDelta: number;
  limited: boolean;
};

type Capacity<T> = { token: T; amount: number };

export function resizeBoundary<T>({
  panels,
  boundaryIndex,
  delta,
  fromSizes,
}: BoundaryResizeInput<T>): BoundaryResizeResult<T> {
  const sizes = new Map(fromSizes);
  if (delta === 0 || boundaryIndex <= 0 || boundaryIndex >= panels.length) {
    return { sizes, appliedDelta: 0, limited: delta !== 0 };
  }

  const sign: 1 | -1 = delta > 0 ? 1 : -1;
  const growStart = sign > 0 ? boundaryIndex - 1 : boundaryIndex;
  const growStep: 1 | -1 = sign > 0 ? -1 : 1;
  const shrinkStart = sign > 0 ? boundaryIndex : boundaryIndex - 1;
  const shrinkStep: 1 | -1 = sign > 0 ? 1 : -1;

  const grow = collectCapacity({
    panels,
    fromSizes,
    start: growStart,
    step: growStep,
    directIndex: growStart,
    capacity: (size, panel) => panel.maxSize - size,
  });
  const shrink = collectCapacity({
    panels,
    fromSizes,
    start: shrinkStart,
    step: shrinkStep,
    directIndex: shrinkStart,
    capacity: (size, panel) => size - panel.minSize,
  });

  const requested = Math.abs(delta);
  const applied = Math.min(requested, grow.total, shrink.total);
  if (applied <= 0) {
    return { sizes, appliedDelta: 0, limited: requested > 0 };
  }

  applyCapacity(sizes, grow.items, applied, 1);
  applyCapacity(sizes, shrink.items, applied, -1);

  return {
    sizes,
    appliedDelta: sign * applied,
    limited: requested - applied > 0.5,
  };
}

function collectCapacity<T>({
  panels,
  fromSizes,
  start,
  step,
  directIndex,
  capacity,
}: {
  panels: readonly BoundaryPanel<T>[];
  fromSizes: ReadonlyMap<T, number>;
  start: number;
  step: 1 | -1;
  directIndex: number;
  capacity: (size: number, panel: BoundaryPanel<T>) => number;
}): { items: Capacity<T>[]; total: number } {
  const items: Capacity<T>[] = [];
  let total = 0;

  for (let index = start; index >= 0 && index < panels.length; index += step) {
    const panel = panels[index];
    // A disabled panel immediately adjacent to the separator makes that
    // separator immovable in this direction. Farther disabled panels are hard
    // cascade barriers as well; moving through one would visually detach the
    // separator from its neighbor.
    if (panel.disabled) break;
    if (panel.pinned && index !== directIndex) continue;

    const amount = Math.max(
      0,
      capacity(fromSizes.get(panel.token) ?? 0, panel),
    );
    if (amount <= 0) continue;
    items.push({ token: panel.token, amount });
    total += amount;
  }

  return { items, total };
}

function applyCapacity<T>(
  sizes: Map<T, number>,
  capacities: Capacity<T>[],
  amount: number,
  sign: 1 | -1,
) {
  let remaining = amount;
  for (const item of capacities) {
    const applied = Math.min(remaining, item.amount);
    if (applied > 0) {
      sizes.set(item.token, (sizes.get(item.token) ?? 0) + sign * applied);
      remaining -= applied;
    }
    if (remaining <= 0) break;
  }
}
