import { expect, type Page, test } from "@playwright/test";
import { dragHandle, dragSeam } from "./helpers";

/**
 * Render-efficiency regression guard.
 *
 * The package routes per-tick drag updates through external stores with
 * per-id subscriptions (panel-store / keyed-store), so dragging one panel
 * must NOT re-render consumers subscribed to other panels. Behavioral
 * specs can't catch this regressing — layouts still end up correct even
 * if everything re-renders on every tick — so this spec counts renders
 * directly via the instrumented /test/render-count page.
 *
 * Verified to fail against the realistic regression (mutation-tested):
 * deriving usePanelControls from the whole-registry snapshot — or moving
 * `panels` back into context — drives untouched consumers to ~50-100
 * renders per drag vs the ≤10 noise budget. (A broad *subscription* with
 * a stable per-id snapshot is benign: useSyncExternalStore bails out on
 * unchanged snapshots, so that mode is intentionally not flagged.)
 *
 * Threshold model (counts are committed renders, taken in a dep-less
 * effect on the instrumented page):
 *  - Every drag flips shared context flags (isDragging on mousedown;
 *    skipAnim+isDragging on mouseup; skipAnim auto-clear) — about 3
 *    committed renders for EVERY consumer, regardless of subscription.
 *    That's the unavoidable noise floor: NOISE_BUDGET = 6.
 *  - A consumer of a panel that IS moving re-renders once per coalesced
 *    drag frame. A 600ms drag spans ~9 frames even on a 15fps CI runner:
 *    TICK_MIN = 8.
 *  A regression (broad fan-out per tick) drives "untouched" consumers to
 *  TICK_MIN-level counts (~25-50 in the mutation run), far past
 *  NOISE_BUDGET.
 */
const NOISE_BUDGET = 6;
const TICK_MIN = 8;

const DRAG = { steps: 24, durationMs: 600 };

async function renderCount(page: Page, id: string): Promise<number> {
  const v = await page.getByTestId(`rc-${id}`).getAttribute("data-renders");
  return Number(v);
}

async function counts(page: Page) {
  return {
    left: await renderCount(page, "left"),
    midA: await renderCount(page, "midA"),
    midB: await renderCount(page, "midB"),
    right: await renderCount(page, "right"),
    registry: await renderCount(page, "registry"),
  };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/test/render-count");
  await page.waitForTimeout(400); // initial mount + auto-distribute settle
});

test("docked drag: the other docked panel's consumer does not render per tick", async ({
  page,
}) => {
  const scope = page.locator("body");
  const before = await counts(page);

  await dragHandle(scope, { panelId: "left", delta: 120, ...DRAG });
  await page.waitForTimeout(300); // let the skip-anim window clear

  const after = await counts(page);
  const delta = (id: keyof typeof before) => after[id] - before[id];

  // The dragged panel's consumer ticks with the drag…
  expect(delta("left")).toBeGreaterThanOrEqual(TICK_MIN);
  // …and the registry-wide consumer does too, by design.
  expect(delta("registry")).toBeGreaterThanOrEqual(TICK_MIN);
  // The untouched docked panel's consumer sees only flag-flip noise.
  expect(delta("right")).toBeLessThanOrEqual(NOISE_BUDGET);
});

test("peer seam drag: docked panels' consumers do not render per tick", async ({
  page,
}) => {
  const scope = page.locator("body");
  const before = await counts(page);

  await dragSeam(scope, { leftPeerId: "midA", delta: 80, ...DRAG });
  await page.waitForTimeout(300);

  const after = await counts(page);
  const delta = (id: keyof typeof before) => after[id] - before[id];

  // Both peers adjacent to the seam tick with the drag.
  expect(delta("midA")).toBeGreaterThanOrEqual(TICK_MIN);
  expect(delta("midB")).toBeGreaterThanOrEqual(TICK_MIN);
  // The docked panels on either end stay at flag-flip noise.
  expect(delta("left")).toBeLessThanOrEqual(NOISE_BUDGET);
  expect(delta("right")).toBeLessThanOrEqual(NOISE_BUDGET);
});

test("idle page: no render churn while nothing changes", async ({ page }) => {
  const before = await counts(page);
  await page.waitForTimeout(600);
  const after = await counts(page);
  expect(after).toEqual(before);
});
