import { expect, type Page, test } from "@playwright/test";
import { waitForSettled } from "./helpers";

/**
 * R-02/R-03 regression: on an over-constrained group, a pointer
 * press-and-release on a seam with zero movement must follow the §4 event
 * contract — a no-move pointer session emits NOTHING (the resize lifecycle
 * brackets actual movement, R-03) — and must not rebase the dockeds'
 * preferred sizes to their compressed rendered sizes (R-02). At the R-02
 * baseline, `beginResize` synced preferred ← rendered on pointer-down, so a
 * plain click emitted `onValueChange` (reason "resize") and permanently
 * destroyed the user's preference (pref 300 → rendered ~215). Before R-03,
 * the same click also emitted an `onResizeStart`/`onResizeEnd` pair.
 */

const PREFERRED = 300; // the fixture's docked defaultSize

const renderedWidth = (page: Page, id: string) =>
  page
    .locator(`[data-resizable-panels-panel-id="${id}"]`)
    .evaluate((element) => element.getBoundingClientRect().width);

async function readState(page: Page) {
  const button = page.getByTestId("read-no-move-click-state");
  await button.click();
  return JSON.parse((await button.getAttribute("data-snapshot")) ?? "null");
}

test("a no-move click on an over-constrained seam emits nothing and preserves preferred sizes", async ({
  page,
}) => {
  await page.goto("/test/overconstrained-no-move-click");

  // Precondition: the layout is genuinely over-constrained — both dockeds
  // render well below their preferred 300 (520 container − 80 peer floor
  // leaves 440 for 600 of preference). The initial compression animates, so
  // wait for it to finish before measuring — otherwise the seam is a moving
  // target and the click can land on a panel instead of the handle.
  const group = page.getByTestId("no-move-click-group");
  await expect.poll(() => renderedWidth(page, "left")).toBeLessThan(PREFERRED);
  await waitForSettled(group);
  await expect.poll(() => renderedWidth(page, "right")).toBeLessThan(PREFERRED);
  let state = await readState(page);
  expect(state.left.preferred).toBe(PREFERRED);
  expect(state.right.preferred).toBe(PREFERRED);
  expect(state.left.rendered).toBeLessThan(PREFERRED);

  const events = page.getByTestId("no-move-click-events");
  await expect(events).toHaveAttribute("data-start", "0");
  await expect(events).toHaveAttribute("data-end", "0");
  // Mount and numeric-default canonicalization must not have emitted.
  await expect(events).toHaveAttribute("data-value", "0");

  // Press and release the seam without any pointer movement.
  const seam = page.getByTestId("left-seam");
  const box = await seam.boundingBox();
  if (!box) throw new Error("left-seam handle not found");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();

  // The lifecycle brackets actual movement (R-03): a click without a
  // qualifying move emits NOTHING — no start, no end, no value change.
  // Deterministic read: the old press-time start fired synchronously inside
  // pointerdown and the end via a microtask after pointerup, so both would
  // already have landed before this evaluation reaches the page.
  await expect(events).toHaveAttribute("data-start", "0");
  await expect(events).toHaveAttribute("data-end", "0");
  await expect(events).toHaveAttribute("data-value", "0");

  // Preferred sizes survived the click.
  state = await readState(page);
  expect(state.left.preferred).toBe(PREFERRED);
  expect(state.right.preferred).toBe(PREFERRED);

  // The preference is still live, not just reported: growing the container
  // lets both dockeds express their original 300 again. At the R-02 baseline
  // this failed — the click had persisted the compressed size as the
  // preference.
  await page.getByTestId("set-roomy").click();
  await expect
    .poll(() => renderedWidth(page, "left"))
    .toBeCloseTo(PREFERRED, 0);
  await expect
    .poll(() => renderedWidth(page, "right"))
    .toBeCloseTo(PREFERRED, 0);

  // Re-check after the container change settled everything: no deferred
  // lifecycle event trickled in behind the earlier assertions.
  await expect(events).toHaveAttribute("data-start", "0");
  await expect(events).toHaveAttribute("data-end", "0");
});
