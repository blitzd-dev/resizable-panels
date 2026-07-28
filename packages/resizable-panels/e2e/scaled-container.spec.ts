import { expect, type Page, test } from "@playwright/test";
import { waitForSettled } from "./helpers";

/**
 * Groups inside a `transform: scale()` ancestor (zoomed-out previews,
 * pinch-zoomed canvases). Pointer input arrives in visual px; the layout
 * model, configured min/max, and keyboard steps are CSS layout px. The
 * contract: the seam tracks the cursor 1:1, and every clamp stays in
 * layout units regardless of the ancestor scale.
 */

const SCALE = 0.5;

/** Layout px (pre-transform) — the unit `defaultSize`/`minSize`/`maxSize`
 *  and the keyboard step speak. */
async function readLayoutWidth(page: Page, panelId: string): Promise<number> {
  return page.evaluate((id) => {
    const el = document.querySelector<HTMLElement>(
      `[data-resizable-panels-panel-id="${id}"]`,
    );
    if (!el) throw new Error(`Panel ${id} not found`);
    return el.offsetWidth;
  }, panelId);
}

/** Visual px (post-transform) — what the user sees and drags against. */
async function readVisualWidth(page: Page, panelId: string): Promise<number> {
  const box = await page
    .locator(`[data-resizable-panels-panel-id="${panelId}"]`)
    .boundingBox();
  if (!box) throw new Error(`Panel ${panelId} not found`);
  return box.width;
}

async function dragHandle(page: Page, visualDx: number): Promise<number> {
  const handle = page.getByTestId("scaled-handle");
  const box = await handle.boundingBox();
  if (!box) throw new Error("scaled handle not found");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  const steps = Math.max(4, Math.ceil(Math.abs(visualDx) / 25));
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x + (visualDx * i) / steps, y);
  }
  const endX = x + visualDx;
  await page.mouse.up();
  return endX;
}

test.describe("scaled ancestor", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/test/scaled-container");
    await expect.poll(() => readLayoutWidth(page, "nav")).toBeCloseTo(200, 0);
  });

  test("pointer drag resizes in layout px and the seam tracks the cursor", async ({
    page,
  }) => {
    const visualDx = 60;
    const cursorX = await dragHandle(page, visualDx);
    await waitForSettled(page.locator("body"));

    // Visual dx / SCALE = layout dx (60 / 0.5 = 120 → nav 200 → 320).
    const expectedLayout = 200 + visualDx / SCALE;
    expect(await readLayoutWidth(page, "nav")).toBeCloseTo(expectedLayout, 0);
    expect(await readVisualWidth(page, "nav")).toBeCloseTo(
      expectedLayout * SCALE,
      0,
    );

    // The seam ends under the pointer, not trailing it.
    const seam = await page.getByTestId("scaled-handle").boundingBox();
    if (!seam) throw new Error("scaled handle not found");
    expect(Math.abs(seam.x + seam.width / 2 - cursorX)).toBeLessThanOrEqual(2);
  });

  test("min/max clamps stay in layout units under the transform", async ({
    page,
  }) => {
    // Far past max: 400 layout px is 200 visual px away at most; overshoot.
    await dragHandle(page, 400);
    await waitForSettled(page.locator("body"));
    expect(await readLayoutWidth(page, "nav")).toBeCloseTo(400, 0);

    // Far past min.
    await dragHandle(page, -400);
    await waitForSettled(page.locator("body"));
    expect(await readLayoutWidth(page, "nav")).toBeCloseTo(100, 0);
  });

  test("keyboard steps stay in layout px regardless of scale", async ({
    page,
  }) => {
    await page.getByTestId("scaled-handle").focus();
    await page.keyboard.press("ArrowRight");
    await waitForSettled(page.locator("body"));
    expect(await readLayoutWidth(page, "nav")).toBeCloseTo(210, 0);
  });
});
