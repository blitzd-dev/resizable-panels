import { expect, type Page, test } from "@playwright/test";
import { clickToggle, readRenderedSize, waitForSettled } from "./helpers";

async function collapseRail(page: Page) {
  const scope = page.locator("body");
  const panel = scope.locator('[data-resizable-panels-panel-id="nav"]');
  const handle = page.getByTestId("collapse-below-handle");
  const box = await handle.boundingBox();
  if (!box) throw new Error("collapseBelow handle not found");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 175, y);
  await page.mouse.up();
  await expect(panel).toHaveAttribute("data-state", "collapsed");
  await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(48, 0);
  return { handle, panel, scope };
}

test.describe("collapseBelow", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("keyboard Home crosses the same collapse threshold as pointer input", async ({
    page,
  }) => {
    await page.goto("/test/collapse-below");
    const panel = page.locator('[data-resizable-panels-panel-id="nav"]');
    const handle = page.getByTestId("collapse-below-handle");

    await handle.focus();
    await page.keyboard.press("Home");

    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await waitForSettled(page.locator("body"));
    await expect
      .poll(() => readRenderedSize(page.locator("body"), "nav"))
      .toBeLessThan(1);
  });

  test("docked panel animates closed by default as soon as it crosses collapseBelow", async ({
    page,
  }) => {
    await page.goto("/test/collapse-below");

    const scope = page.locator("body");
    const panelId = "nav";

    await expect
      .poll(() => readRenderedSize(scope, panelId))
      .toBeGreaterThan(200);

    const panel = scope
      .locator(`[data-resizable-panels-panel-id="${panelId}"]`)
      .first();
    const handle = scope.locator(
      `[data-resizable-panels-resize-handle][data-before-panel="${panelId}"]`,
    );
    const box = await handle.boundingBox();
    if (!box) throw new Error("collapseBelow handle not found");

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // The expanded panel hits its 140px minSize wall first. Additional
    // pointer travel counts toward collapseBelow without rendering an
    // invalid size between minSize and collapsedSize.
    await page.mouse.move(startX - 100, startY);
    await expect(panel).toHaveAttribute("data-state", "expanded");
    await expect
      .poll(() => readRenderedSize(scope, panelId))
      .toBeCloseTo(140, 0);
    await page.mouse.move(startX - 175, startY);

    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await expect(panel).toHaveCSS("transition-property", "width");
    await expect(panel).toHaveCSS("transition-duration", "0.3s");
    await expect.poll(() => readRenderedSize(scope, panelId)).toBeLessThan(1);
    await expect(panel).toHaveAttribute("aria-hidden", "true");
    await expect
      .poll(() => panel.evaluate((node) => (node as HTMLElement).inert))
      .toBe(true);
    await page.mouse.up();

    await waitForSettled(scope);

    await expect.poll(() => readRenderedSize(scope, panelId)).toBeLessThan(1);
    const peer = scope.locator('[data-kind="peer"]');
    await expect
      .poll(async () => {
        const rendered = await peer.evaluate(
          (node) => node.getBoundingClientRect().width,
        );
        const allocated = await peer.evaluate((node) =>
          Number.parseFloat(getComputedStyle(node).flexBasis),
        );
        return Math.abs(rendered - allocated);
      })
      .toBeLessThan(1);
    await expect(scope.getByText(/collapsed$/)).toBeVisible();

    await clickToggle(scope, panelId);
    await waitForSettled(scope);

    await expect
      .poll(() => readRenderedSize(scope, panelId))
      .toBeGreaterThanOrEqual(140);
  });

  test("collapseBelowBehavior instant snaps closed without a transition", async ({
    page,
  }) => {
    await page.goto("/test/collapse-below?instant");

    const scope = page.locator("body");
    const panel = scope.locator('[data-resizable-panels-panel-id="nav"]');
    const handle = scope.locator(
      '[data-resizable-panels-resize-handle][data-before-panel="nav"]',
    );
    const box = await handle.boundingBox();
    if (!box) throw new Error("collapseBelow handle not found");

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 175, startY);

    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await expect(panel).toHaveCSS("transition-property", "none");
    await expect.poll(() => readRenderedSize(scope, "nav")).toBeLessThan(1);
    await page.mouse.up();
  });

  test("a non-zero collapsedSize remains an accessible interactive rail", async ({
    page,
  }) => {
    await page.goto("/test/collapse-below?rail");

    const scope = page.locator("body");
    const panel = scope.locator('[data-resizable-panels-panel-id="nav"]');
    const handle = scope.locator(
      '[data-resizable-panels-resize-handle][data-before-panel="nav"]',
    );
    const railButton = page.getByTestId("rail-expand");
    const railButtonBefore = await railButton.boundingBox();
    if (!railButtonBefore) throw new Error("rail button not found");
    const box = await handle.boundingBox();
    if (!box) throw new Error("collapseBelow handle not found");

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 175, startY);
    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await page.mouse.up();

    await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(48, 0);
    const collapsedContent = await panel
      .locator("[data-resizable-panels-panel-content]")
      .boundingBox();
    if (!collapsedContent) throw new Error("collapsed rail content not found");
    expect(collapsedContent.width).toBeCloseTo(48, 0);
    await expect(panel).not.toHaveAttribute("aria-hidden", "true");
    await expect
      .poll(() => panel.evaluate((node) => (node as HTMLElement).inert))
      .toBe(false);
    const railButtonAfter = await railButton.boundingBox();
    if (!railButtonAfter) throw new Error("collapsed rail button not found");
    expect(railButtonAfter.x).toBeCloseTo(railButtonBefore.x, 0);

    await railButton.focus();
    await expect(railButton).toBeFocused();
    await railButton.click();
    await expect(panel).toHaveAttribute("data-state", "expanded");
    await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(220, 0);
  });

  test("a resizable collapsed rail opens when its handle is clicked", async ({
    page,
  }) => {
    await page.goto("/test/collapse-below?rail");
    const { handle, panel, scope } = await collapseRail(page);

    await expect(handle).not.toHaveAttribute("aria-disabled", "true");
    await expect(handle).toHaveAttribute("tabindex", "0");
    await handle.click();

    await expect(panel).toHaveAttribute("data-state", "expanded");
    await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(220, 0);
  });

  test("a resizable collapsed rail opens when its handle is dragged outward", async ({
    page,
  }) => {
    await page.goto("/test/collapse-below?rail");
    const { handle, panel, scope } = await collapseRail(page);
    const box = await handle.boundingBox();
    if (!box) throw new Error("collapsed rail handle not found");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    // The rail stays collapsed until the pointer reaches the valid expanded
    // wall (minSize=140px for this fixture).
    await page.mouse.move(x + 6, y);
    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(48, 0);

    // A single move can cross the threshold and establish a cursor-derived
    // target above minSize. Opening uses one fixed easing timeline rather
    // than restarting it on later pointermove events.
    await page.mouse.move(x + 120, y);
    await expect(panel).toHaveAttribute("data-state", "expanded");
    const openingFrames: number[] = [];
    for (let index = 0; index < 6; index++) {
      await page.waitForTimeout(20);
      const width = await panel.evaluate(
        (node) => node.getBoundingClientRect().width,
      );
      openingFrames.push(width);
    }
    expect(openingFrames[0]).toBeGreaterThanOrEqual(48);
    expect(openingFrames.at(-1)).toBeGreaterThan(openingFrames[0] ?? 0);
    expect(
      openingFrames.some((width) => width > 48 && width < 168),
      `no intermediate opening frame was sampled: ${openingFrames.join(", ")}`,
    ).toBe(true);
    await expect
      .poll(() =>
        panel.evaluate((node) => getComputedStyle(node).transitionDuration),
      )
      .toBe("0s");
    const openingGeometry = await panel.evaluate((node) => {
      const content = node.querySelector(
        "[data-resizable-panels-panel-content]",
      );
      if (!content) return null;
      return {
        panelWidth: node.getBoundingClientRect().width,
        contentWidth: content.getBoundingClientRect().width,
      };
    });
    if (!openingGeometry) throw new Error("opening rail content not found");
    expect(openingGeometry.contentWidth).toBeCloseTo(
      openingGeometry.panelWidth,
      0,
    );

    // Later pointer movement is added directly to the fixed opening tween;
    // it neither freezes the destination nor restarts easing.
    const beforePointerMove = openingGeometry.panelWidth;
    await page.mouse.move(x + 125, y);
    await page.waitForTimeout(20);
    await expect
      .poll(() => readRenderedSize(scope, "nav"))
      .toBeGreaterThan(beforePointerMove);
    await page.mouse.move(x + 135, y);
    await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(183, 0);

    // After the one fixed tween, resize input remains direct 1:1.
    await page.mouse.move(x + 140, y);
    await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(188, 0);
    await page.mouse.up();

    await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(188, 0);
  });

  test("a drag-open animation lands at the cursor without another pointer move", async ({
    page,
  }) => {
    await page.goto("/test/collapse-below?rail");
    const { handle, panel, scope } = await collapseRail(page);
    const box = await handle.boundingBox();
    if (!box) throw new Error("collapsed rail handle not found");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 120, y);

    await expect(panel).toHaveAttribute("data-state", "expanded");
    await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(168, 0);
    await page.mouse.up();
    await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(168, 0);
  });

  test("a collapsed rail stays locked when released below the threshold", async ({
    page,
  }) => {
    await page.goto("/test/collapse-below?rail");
    const { handle, panel, scope } = await collapseRail(page);
    const box = await handle.boundingBox();
    if (!box) throw new Error("collapsed rail handle not found");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 8, y);
    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(48, 0);
    await page.mouse.up();

    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(48, 0);
  });

  test("hysteresis prevents chatter across repeated threshold reversals", async ({
    page,
  }) => {
    await page.goto("/test/collapse-below?rail");
    const { handle, panel } = await collapseRail(page);
    const box = await handle.boundingBox();
    if (!box) throw new Error("collapsed rail handle not found");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();

    // A collapsed-start session stays locked below minSize, opens at minSize,
    // then remains open through the reverse hysteresis band.
    await page.mouse.move(x + 80, y);
    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await page.mouse.move(x + 92, y);
    await expect(panel).toHaveAttribute("data-state", "expanded");
    await page.mouse.move(x + 80, y);
    await expect(panel).toHaveAttribute("data-state", "expanded");
    await page.waitForTimeout(450);

    // Crossing the rail boundary closes. Returning to the neutral band does
    // not immediately reopen; only its upper boundary reverses state again.
    await page.mouse.move(x, y);
    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await page.mouse.move(x + 80, y);
    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await page.mouse.move(x + 92, y);
    await expect(panel).toHaveAttribute("data-state", "expanded");
    await page.mouse.up();
  });

  test("reversing the same drag above collapseBelow reopens the panel", async ({
    page,
  }) => {
    await page.goto("/test/collapse-below");
    const scope = page.locator("body");
    const panel = scope.locator('[data-resizable-panels-panel-id="nav"]');
    const handle = scope.locator(
      '[data-resizable-panels-resize-handle][data-before-panel="nav"]',
    );
    const box = await handle.boundingBox();
    if (!box) throw new Error("collapseBelow handle not found");
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 175, startY);
    await expect(panel).toHaveAttribute("data-state", "collapsed");

    // Reopening after a live collapse also requires reaching at least
    // minSize, so the animation destination coincides with the cursor.
    await page.mouse.move(startX - 81, startY);
    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await page.mouse.move(startX - 80, startY);
    await expect(panel).toHaveAttribute("data-state", "expanded");
    await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(140, 0);
    await page.mouse.up();
    await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(140, 0);
  });
});
