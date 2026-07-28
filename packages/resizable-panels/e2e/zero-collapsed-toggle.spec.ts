import { expect, type Locator, test } from "@playwright/test";

/**
 * R-18 — Enter reopens a zero-collapsed panel. New contract: the handle
 * adjacent to a zero-collapsed collapsible panel is `data-toggle-only` —
 * still focusable (Tab reaches it), Enter expands the panel back to its
 * preferred size, while pointer drag on the dead seam stays fully inert
 * (no movement, no resize lifecycle). Pre-R-18 the handle was completely
 * disabled (`tabindex="-1"`, `aria-disabled`), leaving keyboard users no
 * path back without an app-provided control.
 */

const width = (target: Locator) =>
  target.evaluate((element) => element.getBoundingClientRect().width);

test.describe("zero-collapsed panels stay keyboard-reachable (R-18)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto("/test/zero-collapsed-toggle");
  });

  test("Tab reaches the toggle-only handle and Enter restores the panel's preference", async ({
    page,
  }) => {
    const zed = page.locator('[data-resizable-panels-panel-id="zed"]');
    const handle = page.getByTestId("zed-handle");
    const state = page.getByTestId("zed-state");

    await expect.poll(() => width(zed)).toBeCloseTo(220, 0);
    // Commit a non-default preference so the reopen proves restoration.
    await page.getByTestId("resize-zed").click();
    await expect.poll(() => width(zed)).toBeCloseTo(260, 0);

    await page.getByTestId("collapse-zed").click();
    await expect(zed).toHaveAttribute("data-state", "collapsed");
    await expect.poll(() => width(zed)).toBeCloseTo(0, 0);

    // Toggle-only, not disabled: focusable, Enter-actionable, drag-dead.
    await expect(handle).toHaveAttribute("data-toggle-only", "");
    await expect(handle).toHaveAttribute("tabindex", "0");
    await expect(handle).not.toHaveAttribute("aria-disabled", "true");
    await expect(handle).not.toHaveAttribute("data-disabled", "");
    // The separator cannot travel: a zero-width announced range stays
    // coherent, and the value text names the collapsed side.
    await expect(handle).toHaveAttribute("aria-valuenow", "0");
    await expect(handle).toHaveAttribute("aria-valuemin", "0");
    await expect(handle).toHaveAttribute("aria-valuemax", "0");
    await expect(handle).toHaveAttribute(
      "aria-valuetext",
      /before panel collapsed/,
    );

    // Tab order: the last toolbar button precedes the group, so one Tab
    // lands on the handle — it is genuinely in the focus order.
    await page.getByTestId("expand-zed").focus();
    await page.keyboard.press("Tab");
    await expect(handle).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(zed).toHaveAttribute("data-state", "expanded");
    await expect.poll(() => width(zed)).toBeCloseTo(260, 0);
    await expect(state).toHaveAttribute("data-preferred", "260");
    // Back to a normal drag handle.
    await expect(handle).not.toHaveAttribute("data-toggle-only", "");
    await expect(handle).toHaveAttribute("tabindex", "0");
  });

  test("pointer drag on the zero-collapsed seam stays inert; Enter still works after it", async ({
    page,
  }) => {
    const zed = page.locator('[data-resizable-panels-panel-id="zed"]');
    const main = page.locator('[data-resizable-panels-panel-id="main"]');
    const handle = page.getByTestId("zed-handle");
    const lifecycle = page.getByTestId("zed-lifecycle");

    await page.getByTestId("collapse-zed").click();
    await expect(zed).toHaveAttribute("data-state", "collapsed");
    await expect.poll(() => width(zed)).toBeCloseTo(0, 0);
    const mainBefore = await width(main);

    const box = await handle.boundingBox();
    if (!box) throw new Error("Expected zed handle");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 150, box.y + 200, {
      steps: 8,
    });
    await page.mouse.up();

    // Drag stays disabled by design: no geometry change, no lifecycle.
    await expect(zed).toHaveAttribute("data-state", "collapsed");
    await expect.poll(() => width(zed)).toBeCloseTo(0, 0);
    expect(await width(main)).toBeCloseTo(mainBefore, 0);
    await expect(lifecycle).toHaveAttribute("data-start", "0");
    await expect(lifecycle).toHaveAttribute("data-end", "0");

    // The failed drag must not have consumed the handle's keyboard path.
    await handle.focus();
    await page.keyboard.press("Enter");
    await expect(zed).toHaveAttribute("data-state", "expanded");
    await expect.poll(() => width(zed)).toBeCloseTo(220, 0);
  });

  test("keyboard focus on the zero-collapsed edge seam shows the separator line (R-23)", async ({
    page,
  }) => {
    const zed = page.locator('[data-resizable-panels-panel-id="zed"]');
    const handle = page.getByTestId("zed-handle");
    const line = handle.locator("[data-resizable-panels-resize-handle-line]");

    await page.getByTestId("collapse-zed").click();
    await expect(zed).toHaveAttribute("data-state", "collapsed");
    await expect.poll(() => width(zed)).toBeCloseTo(0, 0);
    // The seam sits at the group's content edge, where resting lines are
    // hidden — pre-R-23 keyboard focus was therefore invisible here.
    await expect(handle).toHaveAttribute("data-toggle-only", "");
    await expect(line).toHaveCount(0);

    await page.getByTestId("expand-zed").focus();
    await page.keyboard.press("Tab");
    await expect(handle).toBeFocused();
    // Focus must be visible: the line renders and lights while focused,
    // even at the content edge.
    await expect(line).toHaveCount(1);
    await expect(line).toHaveCSS("opacity", "0.6");

    // Moving focus away hides it again.
    await page.getByTestId("expand-zed").focus();
    await expect(line).toHaveCount(0);
  });
});
