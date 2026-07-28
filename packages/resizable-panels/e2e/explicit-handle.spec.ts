import { expect, type Locator, test } from "@playwright/test";

const renderedWidth = (panel: Locator) =>
  panel.evaluate((element) => element.getBoundingClientRect().width);

test.describe("Explicit PanelResizeHandle", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto("/test/explicit-handle");
  });

  test("exposes complete separator metadata", async ({ page }) => {
    const handle = page.getByTestId("explicit-handle");
    const left = page.locator('[data-resizable-panels-panel-id="left"]');
    const main = page.locator('[data-resizable-panels-panel-id="main"]');

    await expect(handle).toHaveAttribute("role", "separator");
    await expect(handle).toHaveAttribute("aria-orientation", "vertical");
    await expect(handle).toHaveAttribute("aria-valuemin", "100");
    await expect(handle).toHaveAttribute("aria-valuemax", "500");
    await expect(handle).toHaveAttribute("aria-valuenow", "300");
    await expect(handle).toHaveAttribute(
      "aria-controls",
      `${await left.getAttribute("id")} ${await main.getAttribute("id")}`,
    );
  });

  test("limits the announced range to opposite-side capacity", async ({
    page,
  }) => {
    await page.goto("/test/explicit-handle?constrained");
    const handle = page.getByTestId("explicit-handle");

    await expect(handle).toHaveAttribute("aria-valuenow", "300");
    await expect(handle).toHaveAttribute("aria-valuemin", "230");
    await expect(handle).toHaveAttribute("aria-valuemax", "370");
  });

  test("exposes active state for hover and keyboard focus", async ({
    page,
  }) => {
    const handle = page.getByTestId("explicit-handle");
    const line = handle.locator("[data-resizable-panels-resize-handle-line]");

    await expect(handle).not.toHaveAttribute("data-active", "");
    await expect(line).toHaveCSS("opacity", "0");

    await handle.hover();
    await expect(handle).toHaveAttribute("data-active", "");
    await expect(line).toHaveCSS("opacity", "0.6");

    await page.mouse.move(0, 0);
    await expect(handle).not.toHaveAttribute("data-active", "");

    // Keyboard-modality focus lights immediately (R-29 pins the lit state
    // to focus-visible, not raw focus): Tab from the top of the page — the
    // fixture has no focusable element before the handle — instead of
    // programmatic focus(), whose :focus-visible outcome is
    // engine-heuristic-dependent.
    await page.keyboard.press("Tab");
    await expect(handle).toBeFocused();
    await expect(handle).toHaveAttribute("data-active", "");
    await expect(line).toHaveCSS("opacity", "0.6");

    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await expect(handle).not.toHaveAttribute("data-active", "");
  });

  test("resizes with pointer input and updates aria-valuenow", async ({
    page,
  }) => {
    const handle = page.getByTestId("explicit-handle");
    const left = page.locator('[data-resizable-panels-panel-id="left"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error("Expected explicit handle");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await expect(handle).toHaveAttribute("data-active", "");
    await expect(handle).toHaveCSS("z-index", "30");
    await page.mouse.move(x + 80, y, { steps: 8 });
    await page.mouse.up();

    await expect.poll(() => renderedWidth(left)).toBeCloseTo(380, 0);
    await expect(handle).toHaveAttribute("aria-valuenow", "380");
    // Releasing directly over the moved handle returns to hover-active.
    await expect(handle).toHaveAttribute("data-active", "");
    await expect(handle).toHaveCSS("z-index", "30");
    // The press focused the separator (R-27) — focus itself persists after
    // parking the pointer, so arrows still answer from here — but
    // pointer-acquired focus is visually silent (R-29): away from the
    // pointer the handle presents at rest until a keydown upgrades the
    // modality. Blur clears the focus without any presentation change.
    await page.mouse.move(0, 0);
    await expect(handle).toBeFocused();
    await expect(handle).not.toHaveAttribute("data-active");
    await expect(handle).toHaveCSS("z-index", "20");
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await expect(handle).not.toBeFocused();
    await expect(handle).not.toHaveAttribute("data-active");
    await expect(handle).toHaveCSS("z-index", "20");
  });

  test("supports arrows and Home/End", async ({ page }) => {
    const handle = page.getByTestId("explicit-handle");
    const left = page.locator('[data-resizable-panels-panel-id="left"]');

    await handle.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => renderedWidth(left)).toBeCloseTo(310, 0);

    await page.keyboard.press("Home");
    await expect.poll(() => renderedWidth(left)).toBeCloseTo(100, 0);

    await page.keyboard.press("End");
    await expect.poll(() => renderedWidth(left)).toBeCloseTo(500, 0);
  });

  test("maps pointer and arrow movement correctly in RTL", async ({ page }) => {
    await page.goto("/test/explicit-handle?rtl");
    const handle = page.getByTestId("explicit-handle");
    const first = page.locator('[data-resizable-panels-panel-id="left"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error("Expected RTL handle");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // The first DOM panel is on the visual right in RTL. Moving the separator
    // right therefore shrinks that panel.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 80, y, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => renderedWidth(first)).toBeCloseTo(220, 0);

    await handle.focus();
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => renderedWidth(first)).toBeCloseTo(230, 0);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => renderedWidth(first)).toBeCloseTo(220, 0);

    // Home/End retain primary-panel semantics independent of text direction.
    await page.keyboard.press("Home");
    await expect.poll(() => renderedWidth(first)).toBeCloseTo(100, 0);
    await page.keyboard.press("End");
    await expect.poll(() => renderedWidth(first)).toBeCloseTo(500, 0);
  });

  test("nested groups resolve their own text direction", async ({ page }) => {
    await page.goto("/test/explicit-handle?rtl&nested");
    const outerFirst = page.locator('[data-resizable-panels-panel-id="left"]');
    const innerFirst = page.locator(
      '[data-resizable-panels-panel-id="inner-first"]',
    );
    const innerHandle = page.getByTestId("inner-handle");

    await innerHandle.focus();
    await page.keyboard.press("ArrowRight");

    // The inner LTR group grows its first panel even though its outer group
    // and inherited document direction are RTL.
    await expect.poll(() => renderedWidth(innerFirst)).toBeCloseTo(210, 0);
    await expect.poll(() => renderedWidth(outerFirst)).toBeCloseTo(300, 0);
  });

  test("accepts touch pointer events", async ({ page }) => {
    const handle = page.getByTestId("explicit-handle");
    const left = page.locator('[data-resizable-panels-panel-id="left"]');
    const box = await handle.boundingBox();
    if (!box) throw new Error("Expected explicit handle");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await handle.dispatchEvent("pointerdown", {
      pointerId: 7,
      pointerType: "touch",
      clientX: x,
      clientY: y,
      button: 0,
    });
    await handle.dispatchEvent("pointermove", {
      pointerId: 7,
      pointerType: "touch",
      clientX: x + 50,
      clientY: y,
      buttons: 1,
    });
    await handle.dispatchEvent("pointerup", {
      pointerId: 7,
      pointerType: "touch",
      clientX: x + 50,
      clientY: y,
      button: 0,
    });

    await expect.poll(() => renderedWidth(left)).toBeCloseTo(350, 0);
  });

  test("a disabled adjacent panel locks the separator", async ({ page }) => {
    await page.goto("/test/explicit-handle?disabled");
    const handle = page.getByTestId("explicit-handle");
    const left = page.locator('[data-resizable-panels-panel-id="left"]');

    await expect(handle).toHaveAttribute("aria-disabled", "true");
    await expect(handle).toHaveAttribute("tabindex", "-1");
    await handle.dispatchEvent("pointerdown", {
      pointerId: 8,
      pointerType: "mouse",
      clientX: 300,
      clientY: 300,
      button: 0,
    });
    await handle.dispatchEvent("pointermove", {
      pointerId: 8,
      pointerType: "mouse",
      clientX: 400,
      clientY: 300,
      buttons: 1,
    });
    await expect.poll(() => renderedWidth(left)).toBeCloseTo(300, 0);
  });
});
