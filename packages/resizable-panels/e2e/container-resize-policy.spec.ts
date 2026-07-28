import { expect, type Page, test } from "@playwright/test";

const width = (page: Page, id: string) =>
  page
    .locator(`[data-resizable-panels-panel-id="${id}"]`)
    .evaluate((element) => element.getBoundingClientRect().width);

const intersectionWidth = (page: Page, selector: string) =>
  page.locator(selector).evaluate(
    (element) =>
      new Promise<number>((resolve) => {
        const observer = new IntersectionObserver(([entry]) => {
          observer.disconnect();
          resolve(entry.intersectionRect.width);
        });
        observer.observe(element);
      }),
  );

test.describe("container resize policies", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1_200, height: 800 });
  });

  test("fixed panels preserve pixels while proportional panels preserve ratios", async ({
    page,
  }) => {
    await page.goto("/test/container-resize-policy");
    await expect.poll(() => width(page, "nav")).toBeCloseTo(240, 0);
    const editorRatio = (await width(page, "editor")) / 960;

    await page.setViewportSize({ width: 900, height: 800 });

    await expect.poll(() => width(page, "nav")).toBeCloseTo(240, 0);
    await expect
      .poll(async () => (await width(page, "editor")) / 660)
      .toBeCloseTo(editorRatio, 2);
    await expect(page.getByTestId("policy-events")).toHaveAttribute(
      "data-reason",
      "container-resize",
    );
    await expect(page.getByTestId("policy-events")).toHaveAttribute(
      "data-trigger",
      "system",
    );
  });

  test("a docked panel can opt into proportional resizing", async ({
    page,
  }) => {
    await page.goto("/test/container-resize-policy?nav=proportional");
    await expect.poll(() => width(page, "nav")).toBeCloseTo(240, 0);

    await page.setViewportSize({ width: 900, height: 800 });

    await expect.poll(() => width(page, "nav")).toBeCloseTo(180, 0);
  });

  test("keeps peer rendering at allocator maximums and leaves excess space unallocated", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 2_400, height: 800 });
    await page.goto("/test/container-resize-policy");

    const group = page.locator("[data-resizable-panels-panel-group]");
    const editorHandle = page.getByTestId("editor-handle");
    await expect.poll(() => width(page, "editor")).toBeCloseTo(900, 0);
    await expect.poll(() => width(page, "preview")).toBeCloseTo(900, 0);
    await expect(editorHandle).toHaveAttribute("aria-valuenow", "900");
    await expect(editorHandle).toHaveAttribute(
      "aria-valuetext",
      "900 pixels before, 900 pixels after",
    );
    await expect
      .poll(async () => {
        const groupWidth = await group.evaluate(
          (element) => element.getBoundingClientRect().width,
        );
        return (
          groupWidth -
          (await width(page, "nav")) -
          (await width(page, "editor")) -
          (await width(page, "preview"))
        );
      })
      .toBeCloseTo(360, 0);
  });

  test("renders allocator sizes when peer minimums exceed the container", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 200, height: 800 });
    await page.goto("/test/container-resize-policy");

    // Never-squish (design-decisions §2.1): a 200px container cannot hold the
    // floors (nav 100 + editor 120 + preview 120 = 340), so each panel renders
    // its allocator floor and the excess overflows — the group is
    // over-constrained rather than silently squished below the minimums. The
    // rendered sizes are the allocator's, which is what this test guards.
    const editorHandle = page.getByTestId("editor-handle");
    await expect.poll(() => width(page, "nav")).toBeCloseTo(100, 0);
    await expect.poll(() => width(page, "editor")).toBeCloseTo(120, 0);
    await expect.poll(() => width(page, "preview")).toBeCloseTo(120, 0);
    await expect(editorHandle).toHaveAttribute("aria-valuenow", "120");
    await expect(editorHandle).toHaveAttribute(
      "aria-valuetext",
      "120 pixels before, 120 pixels after",
    );
    await expect(
      page.locator("[data-resizable-panels-panel-group]"),
    ).toHaveAttribute("data-overconstrained");
  });

  test("double-click resets the configured adjacent panel", async ({
    page,
  }) => {
    await page.goto("/test/container-resize-policy");
    const handle = page.getByTestId("editor-handle");
    await handle.focus();
    await handle.press("ArrowRight");
    await expect.poll(() => width(page, "editor")).toBeCloseTo(370, 0);

    await handle.dblclick();

    await expect.poll(() => width(page, "editor")).toBeCloseTo(360, 0);
    await expect(page.getByTestId("policy-events")).toHaveAttribute(
      "data-reason",
      "reset",
    );
    await expect(page.getByTestId("policy-events")).toHaveAttribute(
      "data-trigger",
      "pointer",
    );
  });

  test("group disabled blocks pointer, keyboard, toggle, and reset input", async ({
    page,
  }) => {
    await page.goto("/test/container-resize-policy?disabled");
    const handle = page.getByTestId("editor-handle");
    const navHandle = page.getByTestId("nav-handle");
    const before = await width(page, "editor");
    const navBefore = await width(page, "nav");
    await expect(handle).toHaveAttribute("aria-disabled", "true");
    await expect(handle).toHaveAttribute("tabindex", "-1");

    await handle.press("ArrowRight");
    await handle.dblclick({ force: true });
    await navHandle.press("Enter");
    const box = await navHandle.boundingBox();
    if (!box) throw new Error("Expected disabled nav handle");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2);
    await page.mouse.up();

    await expect.poll(() => width(page, "editor")).toBeCloseTo(before, 0);
    await expect.poll(() => width(page, "nav")).toBeCloseTo(navBefore, 0);
    await expect(
      page.locator('[data-resizable-panels-panel-id="nav"]'),
    ).toHaveAttribute("data-state", "expanded");
    await expect(page.getByTestId("policy-events")).toHaveAttribute(
      "data-count",
      "0",
    );
  });

  // R-18 (2026-07-18): previously this test asserted the zero-collapsed
  // handle was fully disabled (tabindex -1, aria-disabled, Enter inert).
  // The approved contract keeps the seam drag-dead but makes the handle
  // toggle-only: focusable, and Enter expands the collapsed panel.
  test("a zero-collapsed adjacent panel leaves its handle toggle-only: drag dead, Enter expands", async ({
    page,
  }) => {
    await page.goto("/test/container-resize-policy?collapsed-handle");
    const nav = page.locator('[data-resizable-panels-panel-id="nav"]');
    const viewport =
      '[data-resizable-panels-panel-id="nav"] [data-resizable-panels-panel-viewport]';
    const handle = page.getByTestId("nav-handle");
    const handleLine = handle.locator(
      "[data-resizable-panels-resize-handle-line]",
    );

    await expect(handle).not.toHaveAttribute("aria-disabled", "true");
    await expect(handle).toHaveAttribute("tabindex", "0");
    expect(await handleLine.count()).toBe(1);
    await page.getByTestId("collapse-nav").click();
    await expect(nav).toHaveAttribute("data-state", "collapsed");

    // The consumer border follows the shrinking outer panel during the
    // transition instead of disappearing at the start of the collapse.
    await page.waitForTimeout(100);
    const animatedWidth = await width(page, "nav");
    expect(animatedWidth).toBeGreaterThan(0);
    expect(animatedWidth).toBeLessThan(240);
    expect(await handleLine.count()).toBe(1);
    await expect(page.locator(viewport)).toHaveCSS("border-right-width", "1px");
    expect(await intersectionWidth(page, viewport)).toBeGreaterThan(0);

    await expect.poll(() => width(page, "nav")).toBeCloseTo(0, 0);
    await expect(nav).toHaveCSS("overflow", "hidden");
    expect(await intersectionWidth(page, viewport)).toBe(0);
    // Toggle-only, not disabled: still in the focus order, announced as an
    // immovable separator, drag inputs dead (R-18).
    await expect(handle).toHaveAttribute("data-toggle-only", "");
    await expect(handle).not.toHaveAttribute("aria-disabled", "true");
    await expect(handle).toHaveAttribute("tabindex", "0");
    await expect(handle).toHaveAttribute("data-adjacent-collapsed", "");
    expect(await handleLine.count()).toBe(0);

    const eventCount = await page
      .getByTestId("policy-events")
      .getAttribute("data-count");
    await handle.press("ArrowRight");
    await handle.dblclick({ force: true });
    const box = await handle.boundingBox();
    if (!box) throw new Error("Expected collapsed-adjacent handle");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2);
    await page.mouse.up();

    await expect(nav).toHaveAttribute("data-state", "collapsed");
    await expect.poll(() => width(page, "nav")).toBeCloseTo(0, 0);
    await expect(page.getByTestId("policy-events")).toHaveAttribute(
      "data-count",
      eventCount ?? "0",
    );

    // Enter is the one interaction the toggle-only handle keeps: it
    // expands the zero-collapsed panel and the handle returns to normal.
    await handle.press("Enter");
    await expect(nav).toHaveAttribute("data-state", "expanded");
    await expect(handle).not.toHaveAttribute("data-toggle-only", "");
    await expect.poll(() => width(page, "nav")).toBeGreaterThan(0);

    // The app-provided control still round-trips the collapsed state.
    await page.getByTestId("collapse-nav").click();
    await expect(nav).toHaveAttribute("data-state", "collapsed");
    await page.getByTestId("expand-nav").press("Enter");
    await expect(nav).toHaveAttribute("data-state", "expanded");
    await expect(handle).not.toHaveAttribute("aria-disabled", "true");
    await expect(handle).toHaveAttribute("tabindex", "0");
    await expect(handle).not.toHaveAttribute("data-adjacent-collapsed", "");
    await expect.poll(() => width(page, "nav")).toBeGreaterThan(0);
    await expect.poll(() => handleLine.count()).toBe(1);
  });
});
