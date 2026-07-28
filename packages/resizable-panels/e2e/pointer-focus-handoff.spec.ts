import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * R-27 — clicking a separator must give it focus. `useResizeSession`
 * prevents the pointerdown default once a press arms a session (every press
 * since R-03), which suppresses the browser's native click-gives-focus, so
 * pre-fix a click focused NOTHING: the WAI-ARIA window-splitter
 * pointer→keyboard handoff (drag roughly, fine-tune with arrows) was dead
 * and Tab after a click walked from the top of the page. The handle now
 * focuses itself explicitly when a press arms a session (click-no-move
 * included) and on deliberate presses of toggle-only seams, publishing
 * pointer modality (`focusVisible: false`) deterministically so R-23/R-26
 * keyboard-focus presentation never triggers from a click; any keydown
 * upgrades it — exactly the handoff flow.
 *
 * R-29 — the lit presentation (line opacity, `data-active`, z-index bump)
 * keys off that same keyboard-modality bit, not raw focus — the platform
 * `:focus-visible` convention. Pointer-acquired focus is visually silent
 * (focus itself persists: activeElement, arrows, Tab order all unchanged);
 * the first keydown upgrades the modality and lights the seam on that same
 * keystroke; Tab-acquired focus lights immediately.
 */

const width = (target: Locator) =>
  target.evaluate((element) => element.getBoundingClientRect().width);

async function clickWithoutMoving(page: Page, target: Locator) {
  const box = await target.boundingBox();
  if (!box) throw new Error("Expected a visible press target");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

test.describe("pointer press hands the separator keyboard focus (R-27)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
  });

  test("a click without movement focuses the handle and emits nothing", async ({
    page,
  }) => {
    await page.goto("/test/state-api");
    const handle = page.getByTestId("state-handle");
    const events = page.getByTestId("state-events");

    await clickWithoutMoving(page, handle);
    await expect(handle).toBeFocused();

    // The click-no-move press still respects R-03: no lifecycle, no value.
    await expect(events).toHaveAttribute("data-start", "0");
    await expect(events).toHaveAttribute("data-end", "0");
    await expect(events).toHaveAttribute("data-value", "0");
  });

  test("arrows fine-tune immediately after the click — the pointer→keyboard handoff", async ({
    page,
  }) => {
    await page.goto("/test/state-api");
    const handle = page.getByTestId("state-handle");
    const events = page.getByTestId("state-events");
    const left = page.locator('[data-resizable-panels-panel-id="left"]');
    await expect.poll(() => width(left)).toBeCloseTo(260, 0);

    await clickWithoutMoving(page, handle);
    await expect(handle).toBeFocused();
    await page.keyboard.press("ArrowLeft");

    // One atomic keyboard step, attributed to the keyboard trigger — no
    // pointer lifecycle rides along.
    await expect.poll(() => width(left)).toBeCloseTo(250, 0);
    await expect(events).toHaveAttribute("data-value", "1");
    await expect(events).toHaveAttribute("data-trigger", "keyboard");
    await expect(events).toHaveAttribute("data-start", "0");
    await expect(events).toHaveAttribute("data-end", "0");
  });

  test("Tab after the click continues from the separator, not the top of the page", async ({
    page,
  }) => {
    await page.goto("/test/state-api");
    const handle = page.getByTestId("state-handle");

    await clickWithoutMoving(page, handle);
    await expect(handle).toBeFocused();
    await page.keyboard.press("Tab");

    // Focus moved onward from the handle in DOM order. Pre-fix the click
    // focused nothing, so Tab restarted at the top of the page and landed
    // ON the handle (the fixture has no focusable element before it).
    const relation = await page.evaluate(() => {
      const separator = document.querySelector('[data-testid="state-handle"]');
      const active = document.activeElement;
      if (!separator || !active) return null;
      return {
        isHandle: active === separator,
        followsHandle: Boolean(
          separator.compareDocumentPosition(active) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      };
    });
    expect(relation).toEqual({ isHandle: false, followsHandle: true });
  });

  test("focus survives a full drag and release; arrows keep working", async ({
    page,
  }) => {
    await page.goto("/test/state-api");
    const handle = page.getByTestId("state-handle");
    const events = page.getByTestId("state-events");
    const left = page.locator('[data-resizable-panels-panel-id="left"]');
    await expect.poll(() => width(left)).toBeCloseTo(260, 0);

    const box = await handle.boundingBox();
    if (!box) throw new Error("Expected state handle");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 40, y, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => width(left)).toBeCloseTo(300, 0);

    // No blur on drag end: the handle answers arrows immediately.
    await expect(handle).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => width(left)).toBeCloseTo(290, 0);
    await expect(events).toHaveAttribute("data-trigger", "keyboard");
  });

  test("a press on a disabled handle does not move focus", async ({ page }) => {
    await page.goto("/test/explicit-handle?disabled");
    const handle = page.getByTestId("explicit-handle");
    await expect(handle).toHaveAttribute("tabindex", "-1");

    // Real pointer: the disabled handle is pointer-events: none, so the
    // press falls through to the panel beneath and focus stays on body.
    const box = await handle.boundingBox();
    if (!box) throw new Error("Expected disabled handle");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect(handle).not.toBeFocused();

    // Even a press delivered straight to the element (consumer-dispatched)
    // arms nothing and must not steal focus.
    await handle.dispatchEvent("pointerdown", {
      pointerId: 9,
      pointerType: "mouse",
      clientX: box.x + box.width / 2,
      clientY: box.y + box.height / 2,
      button: 0,
    });
    await expect(handle).not.toBeFocused();
    expect(
      await page.evaluate(() => document.activeElement === document.body),
    ).toBe(true);
  });

  test("click-acquired focus stays pointer-modality until a key upgrades it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto("/test/coincident-handles");
    const a = page.locator('[data-resizable-panels-panel-id="a"]');
    const b = page.locator('[data-resizable-panels-panel-id="b"]');
    const before = page.getByTestId("a-b-handle");
    const after = page.getByTestId("b-c-handle");
    const beforeLine = before.locator(
      "[data-resizable-panels-resize-handle-line]",
    );
    const afterLine = after.locator(
      "[data-resizable-panels-resize-handle-line]",
    );

    // Converge the seams: b → 0, split hit areas, one visual seam.
    const dragBox = await after.boundingBox();
    if (!dragBox) throw new Error("Expected resize handle");
    const dragX = dragBox.x + dragBox.width / 2;
    const dragY = dragBox.y + dragBox.height / 2;
    await page.mouse.move(dragX, dragY);
    await page.mouse.down();
    await page.mouse.move(dragX - 200, dragY, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => width(b)).toBeCloseTo(0, 0);

    // Click the RIGHT half (b-c) without moving, then park the pointer:
    // focus stays on b-c (no blur on park), but pointer-acquired focus is
    // NOT keyboard-visible, so DOM-order line dedup must hold — the line
    // stays with a-b even while b-c is the focused handle. This pins the
    // programmatic press-focus to the pointer-modality path regardless of
    // each engine's :focus-visible heuristic (R-23/R-26 contract).
    await clickWithoutMoving(page, after);
    await expect(after).toBeFocused();
    await page.mouse.move(10, 10);
    await expect(after).toBeFocused();
    await expect(beforeLine).toHaveCount(1);
    await expect(afterLine).toHaveCount(0);

    // ArrowLeft is the handoff: it both resizes from the click-focused
    // handle (b is wedged at 0, so the step cascades into a — the seam
    // stays coincident) and upgrades focus to keyboard modality, moving
    // the shared seam's line to the focused b-c handle.
    const aBefore = await width(a);
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => width(a)).toBeCloseTo(aBefore - 10, 0);
    await expect.poll(() => width(b)).toBeCloseTo(0, 0);
    await expect(afterLine).toHaveCount(1);
    await expect(beforeLine).toHaveCount(0);
  });

  test("pointer-acquired focus is visually silent; the first arrow press resizes AND lights it (R-29)", async ({
    page,
  }) => {
    await page.goto("/test/state-api");
    const handle = page.getByTestId("state-handle");
    const line = handle.locator("[data-resizable-panels-resize-handle-line]");
    const left = page.locator('[data-resizable-panels-panel-id="left"]');
    await expect.poll(() => width(left)).toBeCloseTo(260, 0);

    // Click the seam, then move the pointer out of the hit area: the handle
    // is still the active element — the R-27 handoff — but pointer-acquired
    // focus must not light it (pre-R-29 it stayed lit until blur).
    await clickWithoutMoving(page, handle);
    await expect(handle).toBeFocused();
    await page.mouse.move(10, 10);
    await expect(handle).toBeFocused();
    await expect(handle).not.toHaveAttribute("data-active");
    await expect(line).toHaveCSS("opacity", "0");
    await expect(handle).toHaveCSS("z-index", "20");

    // The first arrow press is the handoff's visual half: the SAME
    // keystroke that upgrades the modality both moves the seam and lights
    // the line — never "resize now, light on the next key".
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => width(left)).toBeCloseTo(250, 0);
    await expect(handle).toHaveAttribute("data-active", "");
    await expect(line).toHaveCSS("opacity", "0.6");
    await expect(handle).toHaveCSS("z-index", "30");
  });

  test("a bare modifier press upgrades the modality without resizing (R-29)", async ({
    page,
  }) => {
    await page.goto("/test/state-api");
    const handle = page.getByTestId("state-handle");
    const line = handle.locator("[data-resizable-panels-resize-handle-line]");
    const events = page.getByTestId("state-events");
    const left = page.locator('[data-resizable-panels-panel-id="left"]');
    await expect.poll(() => width(left)).toBeCloseTo(260, 0);

    await clickWithoutMoving(page, handle);
    await page.mouse.move(10, 10);
    await expect(handle).toBeFocused();
    await expect(handle).not.toHaveAttribute("data-active");

    // The upgrade matches the R-26 keydown semantics exactly: ANY keydown
    // that reaches the library handler flips the modality to visible —
    // resize key or not — mirroring the platform :focus-visible
    // convention. A bare Shift press lights the seam and changes nothing
    // else: no geometry, no value events.
    await page.keyboard.press("Shift");
    await expect(handle).toHaveAttribute("data-active", "");
    await expect(line).toHaveCSS("opacity", "0.6");
    await expect.poll(() => width(left)).toBeCloseTo(260, 0);
    await expect(events).toHaveAttribute("data-value", "0");
    await expect(events).toHaveAttribute("data-start", "0");
    await expect(events).toHaveAttribute("data-end", "0");
  });

  test("Tab-acquired focus lights the separator immediately (R-29/R-23)", async ({
    page,
  }) => {
    await page.goto("/test/state-api");
    const handle = page.getByTestId("state-handle");
    const line = handle.locator("[data-resizable-panels-resize-handle-line]");

    // From the top of the page: the fixture has no focusable element before
    // the handle, so one Tab reaches it with keyboard modality — lit at
    // once, no keydown-on-the-handle required.
    await page.keyboard.press("Tab");
    await expect(handle).toBeFocused();
    await expect(handle).toHaveAttribute("data-active", "");
    await expect(line).toHaveCSS("opacity", "0.6");

    // Blur clears everything, exactly as before.
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await expect(handle).not.toBeFocused();
    await expect(handle).not.toHaveAttribute("data-active");
    await expect(line).toHaveCSS("opacity", "0");
  });

  test("a click on a toggle-only seam focuses it so Enter is discoverable", async ({
    page,
  }) => {
    await page.goto("/test/zero-collapsed-toggle");
    const zed = page.locator('[data-resizable-panels-panel-id="zed"]');
    const handle = page.getByTestId("zed-handle");
    const line = handle.locator("[data-resizable-panels-resize-handle-line]");

    await page.getByTestId("collapse-zed").click();
    await expect(zed).toHaveAttribute("data-state", "collapsed");
    await expect.poll(() => width(zed)).toBeCloseTo(0, 0);
    await expect(handle).toHaveAttribute("data-toggle-only", "");

    // The drag-dead seam arms no session, but a deliberate press is still
    // an interaction with the separator: it takes focus. The press is
    // pointer modality, so the content-edge line suppression holds (the
    // R-23 keyboard treatment must not trigger from a click).
    await clickWithoutMoving(page, handle);
    await expect(handle).toBeFocused();
    await expect(line).toHaveCount(0);

    // Enter is now one keystroke away — the R-18 reopen path.
    await page.keyboard.press("Enter");
    await expect(zed).toHaveAttribute("data-state", "expanded");
    await expect.poll(() => width(zed)).toBeCloseTo(220, 0);
  });
});
