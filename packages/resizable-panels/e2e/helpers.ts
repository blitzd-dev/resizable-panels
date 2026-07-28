import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Helpers for end-to-end testing the resizable-panels demos. Every assertion
 * here reads the actual DOM (`getBoundingClientRect`, `getComputedStyle`) —
 * ground truth, not React state. That way the tests verify what the user
 * sees, not what the framework *thinks* is rendered.
 */

// ─── reading ─────────────────────────────────────────────────────────────────

/** Return the rendered (post-layout) px size of one panel by its id. Reads
 *  `getBoundingClientRect` so the value reflects what's actually painted,
 *  including any flex-shrink, over-constraint, or transition midpoint. */
export async function readRenderedSize(
  scope: Locator,
  panelId: string,
  axis: "width" | "height" = "width",
): Promise<number> {
  const rect = await scope
    .locator(`[data-resizable-panels-panel-id="${panelId}"]`)
    .first()
    .boundingBox();
  if (!rect) {
    throw new Error(`Panel ${panelId} not found in scope.`);
  }
  return axis === "width" ? rect.width : rect.height;
}

/** Read all dockeds + peers in one demo scope as a Map<id, rendered px>.
 *  Peers may not have ids — those are skipped. */
export async function readAllRenderedSizes(
  scope: Locator,
  axis: "width" | "height" = "width",
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const boxes = await scope.locator(`[data-resizable-panels-panel-id]`).all();
  for (const el of boxes) {
    const id = await el.getAttribute("data-resizable-panels-panel-id");
    const rect = await el.boundingBox();
    if (id && rect) out.set(id, axis === "width" ? rect.width : rect.height);
  }
  return out;
}

/** Return the container size (in px along its main axis) of the group
 *  whose direction matches `axis`. For nested layouts there's one group
 *  per axis — picking by direction makes this unambiguous. */
export async function readContainerSize(
  scope: Locator,
  axis: "width" | "height" = "width",
): Promise<number> {
  const direction = axis === "width" ? "horizontal" : "vertical";
  const rect = await scope
    .locator(
      `[data-resizable-panels-panel-group][data-orientation="${direction}"]`,
    )
    .first()
    .boundingBox();
  if (!rect) {
    throw new Error(`PanelGroup with direction=${direction} not found.`);
  }
  return axis === "width" ? rect.width : rect.height;
}

// ─── interaction ─────────────────────────────────────────────────────────────

type DragHandleOptions = {
  /** Panel whose handle to drag. */
  panelId: string;
  /** Delta to apply along the handle's axis (px). Positive = grow self. */
  delta: number;
  /** How many intermediate mousemoves to fire. More = smoother. Default 24
   *  (≈ 60fps cadence over the default duration). */
  steps?: number;
  /** Total drag duration in ms. Default 380. Spread across `steps`. */
  durationMs?: number;
  /** Easing applied to step progress (0..1 → 0..1). Default smoothstep —
   *  slight acceleration in/out, like a real human drag. Pass `t => t` for
   *  linear interpolation. */
  easing?: (t: number) => number;
  /** Fast-path: skip easing, use 4 steps over 30ms. Useful for *setup*
   *  drags inside a test where the destination state is what matters and
   *  you don't care about the drag itself looking natural. */
  quick?: boolean;
};

/** smoothstep(t) = 3t² − 2t³ — gentle ease-in-out, suitable for cursor
 *  motion. Looks more human than linear and avoids the abrupt start/stop
 *  that fixed-cadence linear drags produce. */
const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** Drag a docked panel's resize handle with realistic intermediate
 *  mousemove events. Handles for start-side panels are on their right
 *  edge; end-side panels are on their left edge — selector picks the
 *  right one automatically. */
export async function dragHandle(
  scope: Locator,
  {
    panelId,
    delta,
    steps,
    durationMs,
    easing,
    quick = false,
  }: DragHandleOptions,
): Promise<void> {
  // Fast path for setup drags.
  const effectiveSteps = steps ?? (quick ? 4 : 24);
  const effectiveDuration = durationMs ?? (quick ? 30 : 380);
  const effectiveEasing = easing ?? (quick ? (t: number) => t : smoothstep);
  const page = scope.page();
  const panel = scope
    .locator(`[data-resizable-panels-panel-id="${panelId}"]`)
    .first();

  // Find the docked panel's side so we know the drag axis sign convention.
  const side = await panel.getAttribute("data-side");
  const adjacencyAttribute =
    side === "start" ? "data-before-panel" : "data-after-panel";
  // data-before/after-panel carry the adjacent panel's semantic panelId.
  const handle = scope.locator(
    `[data-resizable-panels-resize-handle][${adjacencyAttribute}="${panelId}"]`,
  );
  const handleBox = await handle.boundingBox();
  if (!handleBox) {
    throw new Error(`Handle for ${panelId} not found.`);
  }
  const axisAttr = await panel.getAttribute("data-axis");
  const axis = axisAttr === "horizontal" ? "x" : "y";

  // Map "delta = grow self" to cursor direction: start-side handles grow
  // when cursor moves toward the outward side (right for horizontal,
  // bottom for vertical). end-side handles are inverted.
  const sign = side === "start" ? 1 : -1;
  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  const endX = axis === "x" ? startX + delta * sign : startX;
  const endY = axis === "y" ? startY + delta * sign : startY;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Spread the drag across `effectiveSteps` mousemoves at
  // `effectiveDuration / effectiveSteps` intervals — Playwright doesn't
  // support per-step delay natively, so we do it manually. Applying the
  // easing curve to step progress gives a more human-feeling cursor
  // velocity (slight ease-in/out instead of a fixed-rate sweep).
  const interval = Math.max(1, Math.floor(effectiveDuration / effectiveSteps));
  for (let i = 1; i <= effectiveSteps; i++) {
    const t = effectiveEasing(i / effectiveSteps);
    const x = startX + (endX - startX) * t;
    const y = startY + (endY - startY) * t;
    await page.mouse.move(x, y);
    if (i < effectiveSteps) await page.waitForTimeout(interval);
  }
  await page.mouse.up();
}

/** Click the toggle button for a given panel id in the demo's toolbar. */
export async function clickToggle(
  scope: Locator,
  panelId: string,
): Promise<void> {
  const ctrl = scope.getByTestId(`toggle-${panelId}`);
  await ctrl.click();
}

type DragSeamOptions = {
  /** The peer to the LEFT of the seam (or above, in vertical groups). The
   *  drag targets the seam handle that's the *immediate next sibling* of
   *  this peer in document order. */
  leftPeerId: string;
  /** Delta in px. Positive = grow left peer (cursor moves outward from
   *  left peer = right for horizontal, down for vertical). */
  delta: number;
  steps?: number;
  durationMs?: number;
  easing?: (t: number) => number;
  quick?: boolean;
};

/** Drag the explicit resize handle between two adjacent peers. */
export async function dragSeam(
  scope: Locator,
  {
    leftPeerId,
    delta,
    steps,
    durationMs,
    easing,
    quick = false,
  }: DragSeamOptions,
): Promise<void> {
  const page = scope.page();
  const effectiveSteps = steps ?? (quick ? 4 : 24);
  const effectiveDuration = durationMs ?? (quick ? 30 : 380);
  const effectiveEasing = easing ?? (quick ? (t: number) => t : smoothstep);

  const seamHandle = scope
    .locator(
      `[data-resizable-panels-panel-id="${leftPeerId}"] + [data-resizable-panels-resize-handle-slot] [data-resizable-panels-resize-handle]`,
    )
    .first();
  const box = await seamHandle.boundingBox();
  if (!box) {
    throw new Error(`Seam handle after peer "${leftPeerId}" not found.`);
  }
  const orientation = await seamHandle.getAttribute("data-orientation");
  const axis = orientation === "vertical" ? "x" : "y";

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  // Positive delta = grow left peer. For horizontal that's cursor moving
  // right; for vertical (top peer is "left"), it's cursor moving down.
  // Either way the cursor moves in the positive axis direction.
  const endX = axis === "x" ? startX + delta : startX;
  const endY = axis === "y" ? startY + delta : startY;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const interval = Math.max(1, Math.floor(effectiveDuration / effectiveSteps));
  for (let i = 1; i <= effectiveSteps; i++) {
    const t = effectiveEasing(i / effectiveSteps);
    const x = startX + (endX - startX) * t;
    const y = startY + (endY - startY) * t;
    await page.mouse.move(x, y);
    if (i < effectiveSteps) await page.waitForTimeout(interval);
  }
  await page.mouse.up();
}

// ─── viewport ────────────────────────────────────────────────────────────────

/** Resize the browser viewport and wait for any reflow-triggered animations
 *  to settle. Use for testing how a layout responds to window resize. */
export async function setViewport(
  page: Page,
  width: number,
  height: number,
  scope?: Locator,
): Promise<void> {
  await page.setViewportSize({ width, height });
  if (scope) await waitForSettled(scope);
}

/** Resize the viewport in N steps from start to end, with a short delay
 *  between each. Simulates a user dragging the window edge. Returns the
 *  rendered container size sampled at every step — useful for asserting
 *  the panel layout tracks the viewport smoothly. */
export async function sweepViewport(
  page: Page,
  scope: Locator,
  options: {
    fromWidth: number;
    toWidth: number;
    height?: number;
    steps?: number;
    delayMs?: number;
  },
): Promise<number[]> {
  const {
    fromWidth,
    toWidth,
    height = 800,
    steps = 12,
    delayMs = 30,
  } = options;
  const sizes: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const w = Math.round(fromWidth + (toWidth - fromWidth) * t);
    await page.setViewportSize({ width: w, height });
    await page.waitForTimeout(delayMs);
    sizes.push(await readContainerSize(scope));
  }
  return sizes;
}

// ─── waiting ─────────────────────────────────────────────────────────────────

/** Wait until no CSS transitions are running on any docked outer inside the
 *  scope. Uses `Element.getAnimations()` for an accurate readout — pollyfilled
 *  by all modern browsers Playwright supports. Falls back to a small sleep
 *  if the API isn't available. */
export async function waitForSettled(
  scope: Locator,
  timeoutMs = 1500,
): Promise<void> {
  const page = scope.page();
  await page.waitForFunction(
    (root) => {
      if (!root) return false;
      const panels = root.querySelectorAll(
        "[data-resizable-panels-panel][data-kind='docked'], [data-resizable-panels-panel-content]",
      );
      for (const el of panels) {
        const anims = (
          el as Element & { getAnimations?: () => Animation[] }
        ).getAnimations?.();
        if (!anims) continue;
        for (const a of anims) {
          if (a.playState === "running") return false;
        }
      }
      return true;
    },
    await scope.elementHandle(),
    { timeout: timeoutMs },
  );
}

// ─── assertions ──────────────────────────────────────────────────────────────

type SumInvariantBounds = {
  /** Σ of every panel's floor — `collapsedSize` for a collapsed panel,
   *  resolved `minSize` for an expanded one. Defaults to 0 (no floors). */
  sumFloors?: number;
  /** Σ of every panel's ceiling — resolved `maxSize` (`minSize` for a
   *  zero-weight proportional panel). Defaults to Infinity (no ceilings). */
  sumCeilings?: number;
};

/** Assert the sum invariant: rendered panel sizes plus gutters equal
 *  `clamp(containerSize, Σ floors, Σ ceilings)` (within tolerance).
 *
 *  For a layout that fits, the clamp reduces to the container size and this
 *  is the classic "panels fill the group exactly" check. When the container
 *  drops below the floors the group is over-constrained: panels hold their
 *  floors and Σ === Σ floors (the shortfall reports as `overconstrained`).
 *  When the container exceeds the ceilings, Σ === Σ ceilings (the excess
 *  reports as `unallocated`). Callers that never over-constrain and never
 *  bind a maximum can omit `bounds` — the default clamp is a no-op.
 *
 *  In nested layouts there are multiple `[data-resizable-panels-panel-group]` elements,
 *  one per direction. We pick the group matching `axis` so the assertion
 *  is per-group and per-axis: `axis="width"` checks the horizontal group,
 *  `axis="height"` checks the vertical one. */
export async function expectSumInvariant(
  scope: Locator,
  axis: "width" | "height" = "width",
  toleranceP = 2,
  bounds: SumInvariantBounds = {},
): Promise<void> {
  const direction = axis === "width" ? "horizontal" : "vertical";
  const group = scope
    .locator(
      `[data-resizable-panels-panel-group][data-orientation="${direction}"]`,
    )
    .first();
  const groupBox = await group.boundingBox();
  if (!groupBox) {
    throw new Error(`PanelGroup with direction=${direction} not found.`);
  }
  const container = axis === "width" ? groupBox.width : groupBox.height;
  // `:scope >` restricts to direct children of THIS group — important when
  // groups nest, so we don't pick up an inner group's children. Gutter slots
  // (`gutterSize` handles) occupy real layout space, so they count toward
  // the sum alongside the panels; default overlay slots measure 0.
  const panels = group.locator(":scope > [data-resizable-panels-panel]");
  const gutters = group.locator(
    ":scope > [data-resizable-panels-resize-handle-slot]",
  );
  let sum = 0;
  for (const el of [...(await panels.all()), ...(await gutters.all())]) {
    const rect = await el.boundingBox();
    if (rect) sum += axis === "width" ? rect.width : rect.height;
  }
  const floors = bounds.sumFloors ?? 0;
  const ceilings = bounds.sumCeilings ?? Number.POSITIVE_INFINITY;
  // lo-wins clamp, matching the library's own `clamp`.
  const expected = Math.max(floors, Math.min(container, ceilings));
  expect(
    sum,
    `Σ panels+gutters (${sum.toFixed(1)}) should equal clamp(container ${container.toFixed(
      1,
    )}, Σfloors ${floors}, Σceilings ${ceilings}) = ${expected.toFixed(1)} on ${axis}`,
  ).toBeCloseTo(expected, -Math.log10(toleranceP));
}
