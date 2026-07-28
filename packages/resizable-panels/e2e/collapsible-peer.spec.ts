import { expect, type Locator, test } from "@playwright/test";

const width = (panel: Locator) =>
  panel.evaluate((element) => element.getBoundingClientRect().width);

test.describe("collapsible peers", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto("/test/collapsible-peer");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("imperative collapse preserves preferred size and restores it", async ({
    page,
  }) => {
    const panel = page.locator('[data-resizable-panels-panel-id="peer-a"]');
    const state = page.getByTestId("peer-state");
    const events = page.getByTestId("peer-events");
    await expect.poll(() => width(panel)).toBeCloseTo(300, 0);
    await expect(events).toHaveAttribute("data-resize", "0");
    await expect(events).toHaveAttribute("data-collapse", "0");

    await page.getByTestId("collapse-peer").click();
    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await expect.poll(() => width(panel)).toBeCloseTo(40, 0);
    await expect(state).toHaveAttribute("data-preferred", "300");
    await expect(events).toHaveAttribute("data-collapse", "1");

    await page.getByTestId("expand-peer").click();
    await expect.poll(() => width(panel)).toBeCloseTo(300, 0);
    await expect(events).toHaveAttribute("data-expand", "1");
  });

  test("maximize expands a collapsed peer to its resolved maximum", async ({
    page,
  }) => {
    const panel = page.locator('[data-resizable-panels-panel-id="peer-a"]');
    await page.getByTestId("collapse-peer").click();
    await expect.poll(() => width(panel)).toBeCloseTo(40, 0);

    await page.getByTestId("maximize-peer").click();
    await expect(panel).toHaveAttribute("data-state", "expanded");
    await expect.poll(() => width(panel)).toBeCloseTo(600, 0);
    await expect(page.getByTestId("peer-state")).toHaveAttribute(
      "data-preferred",
      "600",
    );
  });

  test("Enter collapses an adjacent panel but cannot reopen it from the disabled handle", async ({
    page,
  }) => {
    const panel = page.locator('[data-resizable-panels-panel-id="peer-a"]');
    const handle = page.getByTestId("peer-handle");
    await handle.focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => width(panel)).toBeCloseTo(40, 0);
    await expect(handle).toHaveAttribute("aria-disabled", "true");
    await expect(handle).toHaveAttribute("tabindex", "-1");
    await page.keyboard.press("Enter");
    await expect.poll(() => width(panel)).toBeCloseTo(40, 0);
    await page.getByTestId("expand-peer").click();
    await expect.poll(() => width(panel)).toBeCloseTo(300, 0);
    await expect(handle).not.toHaveAttribute("aria-disabled", "true");
  });

  test("supports fine and coarse keyboard steps and custom hit margins", async ({
    page,
  }) => {
    const panel = page.locator('[data-resizable-panels-panel-id="peer-a"]');
    const handle = page.getByTestId("peer-handle");
    await expect(handle).toHaveCSS("width", "12px");
    await handle.focus();
    await page.keyboard.press("Alt+ArrowRight");
    await expect.poll(() => width(panel)).toBeCloseTo(302, 0);
    await page.keyboard.press("Shift+ArrowRight");
    await expect.poll(() => width(panel)).toBeCloseTo(342, 0);
  });

  test("collapse state and expanded size persist across reload", async ({
    page,
  }) => {
    const panel = page.locator('[data-resizable-panels-panel-id="peer-a"]');
    await page.getByTestId("resize-peer").click();
    await page.getByTestId("collapse-peer").click();
    await expect.poll(() => width(panel)).toBeCloseTo(40, 0);
    await page.waitForTimeout(300);
    await page.reload();
    await expect.poll(() => width(panel)).toBeCloseTo(40, 0);
    await expect(page.getByTestId("peer-state")).toHaveAttribute(
      "data-preferred",
      "360",
    );
  });

  test("crossing collapseBelow collapses during the drag and callbacks are semantic", async ({
    page,
  }) => {
    const panel = page.locator('[data-resizable-panels-panel-id="peer-a"]');
    const handle = page.getByTestId("peer-handle");
    const events = page.getByTestId("peer-events");
    const box = await handle.boundingBox();
    if (!box) throw new Error("Expected peer handle");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 240, y, { steps: 8 });

    await expect(panel).toHaveAttribute("data-state", "collapsed");
    // The peer animates flex-basis AND its min floor on the same curve (F1),
    // so the transition shorthand lists both.
    await expect(panel).toHaveCSS(
      "transition-property",
      "flex-basis, min-width",
    );
    await expect(panel).toHaveCSS("transition-duration", "0.3s, 0.3s");
    await expect(panel).toHaveCSS(
      "transition-timing-function",
      "cubic-bezier(0.4, 0, 0.2, 1), cubic-bezier(0.4, 0, 0.2, 1)",
    );
    await expect.poll(() => width(panel)).toBeCloseTo(40, 0);
    await expect(events).toHaveAttribute("data-collapse", "1");
    await page.mouse.up();
    const sibling = page.locator('[data-resizable-panels-panel-id="peer-b"]');
    await expect
      .poll(async () => {
        const rendered = await width(sibling);
        const allocated = await sibling.evaluate((node) =>
          Number.parseFloat(getComputedStyle(node).flexBasis),
        );
        return Math.abs(rendered - allocated);
      })
      .toBeLessThan(1);
    await expect
      .poll(async () => Number(await events.getAttribute("data-resize")))
      .toBeGreaterThan(0);
    await expect(events).toHaveAttribute("data-expand", "0");
  });

  test("cascades past a collapsed peer without resizing it", async ({
    page,
  }) => {
    await page.goto("/test/collapsible-peer?cascade");
    await page.waitForTimeout(100);
    const a = page.locator('[data-resizable-panels-panel-id="cascade-a"]');
    const b = page.locator('[data-resizable-panels-panel-id="cascade-b"]');
    const c = page.locator('[data-resizable-panels-panel-id="cascade-c"]');
    const handle = page.getByTestId("cascade-handle");
    const aBefore = await width(a);
    const box = await handle.boundingBox();
    if (!box) throw new Error("Expected cascade handle");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 100, y, { steps: 8 });
    await page.mouse.up();

    await expect.poll(() => width(b)).toBeCloseTo(40, 0);
    await expect.poll(() => width(c)).toBeCloseTo(400, 0);
    await expect.poll(() => width(a)).toBeGreaterThan(aBefore + 50);
  });
});

test.describe("coarse pointer hit areas", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("uses the configured coarse margin", async ({ page }) => {
    await page.goto("/test/collapsible-peer");
    await expect(page.getByTestId("peer-handle")).toHaveCSS("width", "36px");
  });
});
