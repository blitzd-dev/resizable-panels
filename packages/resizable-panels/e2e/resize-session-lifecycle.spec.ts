import { expect, type Locator, test } from "@playwright/test";

const bodyStyles = (page: import("@playwright/test").Page) =>
  page.evaluate(() => ({
    cursor: document.body.style.cursor,
    userSelect: document.body.style.userSelect,
  }));

const width = (panel: Locator) =>
  panel.evaluate((element) => element.getBoundingClientRect().width);

async function dispatchPointer(
  target: Locator,
  type:
    | "pointerdown"
    | "pointermove"
    | "pointerup"
    | "pointercancel"
    | "lostpointercapture",
  pointerId: number,
  clientX: number,
) {
  await target.dispatchEvent(type, {
    pointerId,
    pointerType: "touch",
    clientX,
    clientY: 300,
    button: type === "pointermove" ? -1 : 0,
    buttons: type === "pointerdown" || type === "pointermove" ? 1 : 0,
  });
}

test.describe("resize-session lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto("/test/resize-session-lifecycle");
    await page.evaluate(() => {
      document.body.style.cursor = "crosshair";
      document.body.style.userSelect = "text";
    });
  });

  test("unmounting the active handle ends once and restores global state", async ({
    page,
  }) => {
    const handle = page.getByTestId("session-handle-first");
    const state = page.getByTestId("resize-session-state");
    const events = page.getByTestId("resize-session-events");

    await dispatchPointer(handle, "pointerdown", 11, 300);
    await expect(state).toHaveAttribute("data-dragging", "true");
    expect(await bodyStyles(page)).toEqual({
      cursor: "col-resize",
      userSelect: "none",
    });

    // The lifecycle brackets actual movement (R-03): the session must have
    // begun (crossed the drag threshold) for the unmount ending to have an
    // end event to guarantee. Waiting for the start also orders the unmount
    // after the rAF-coalesced move flush.
    await dispatchPointer(handle, "pointermove", 11, 340);
    await expect(events).toHaveAttribute("data-start", "1");

    await page
      .getByTestId("unmount-first-handle")
      .evaluate((button) => (button as HTMLButtonElement).click());

    await expect(handle).toHaveCount(0);
    await expect(state).toHaveAttribute("data-dragging", "false");
    await expect(events).toHaveAttribute("data-start", "1");
    await expect(events).toHaveAttribute("data-end", "1");
    await expect(events).toHaveAttribute("data-last-canceled", "true");
    await expect(events).toHaveAttribute(
      "data-last-handle",
      "session-handle-first",
    );
    expect(await bodyStyles(page)).toEqual({
      cursor: "crosshair",
      userSelect: "text",
    });

    const second = page.getByTestId("session-handle-second");
    const middle = page.locator(
      '[data-resizable-panels-panel-id="session-middle"]',
    );
    const before = await width(middle);
    await dispatchPointer(second, "pointerdown", 12, 600);
    await dispatchPointer(second, "pointermove", 12, 640);
    await dispatchPointer(second, "pointerup", 12, 640);
    await expect.poll(() => width(middle)).toBeCloseTo(before + 40, 0);
    await expect(state).toHaveAttribute("data-dragging", "false");
    await expect(events).toHaveAttribute("data-end", "2");
    await expect(events).toHaveAttribute("data-last-canceled", "false");
    expect(await bodyStyles(page)).toEqual({
      cursor: "crosshair",
      userSelect: "text",
    });
  });

  test("a competing pointer cannot replace the active owner or finish it", async ({
    page,
  }) => {
    const first = page.getByTestId("session-handle-first");
    const second = page.getByTestId("session-handle-other-group");
    const state = page.getByTestId("resize-session-state");
    const events = page.getByTestId("resize-session-events");

    await dispatchPointer(first, "pointerdown", 21, 300);
    await dispatchPointer(second, "pointerdown", 22, 600);
    // Ownership is press-scoped even though the lifecycle brackets movement
    // (R-03): the first press claims the provider session (data-dragging)
    // before any start event exists, and the competing press is rejected.
    await expect(state).toHaveAttribute("data-dragging", "true");
    await expect(events).toHaveAttribute("data-start", "0");

    // The rejected pointer's movement must not start or move anything.
    await dispatchPointer(second, "pointermove", 22, 680);
    await dispatchPointer(second, "pointerup", 22, 680);
    await expect(events).toHaveAttribute("data-start", "0");
    await expect(events).toHaveAttribute("data-end", "0");
    await expect(state).toHaveAttribute("data-dragging", "true");
    expect(await bodyStyles(page)).toEqual({
      cursor: "col-resize",
      userSelect: "none",
    });

    // The owner's first qualifying move opens the one real session.
    await dispatchPointer(first, "pointermove", 21, 340);
    await dispatchPointer(first, "pointerup", 21, 340);
    await expect(events).toHaveAttribute("data-start", "1");
    await expect(events).toHaveAttribute("data-end", "1");
    await expect(events).toHaveAttribute(
      "data-last-handle",
      "session-handle-first",
    );
    await expect(state).toHaveAttribute("data-dragging", "false");
    expect(await bodyStyles(page)).toEqual({
      cursor: "crosshair",
      userSelect: "text",
    });

    // Completions from both rejected and retired pointers are stale no-ops.
    await dispatchPointer(second, "pointercancel", 22, 680);
    await dispatchPointer(first, "lostpointercapture", 21, 340);
    await expect(events).toHaveAttribute("data-end", "1");
  });

  test("cancel and lost capture share idempotent cleanup and allow reuse", async ({
    page,
  }) => {
    const handle = page.getByTestId("session-handle-second");
    const state = page.getByTestId("resize-session-state");
    const events = page.getByTestId("resize-session-events");

    await dispatchPointer(handle, "pointerdown", 31, 600);
    await dispatchPointer(handle, "pointermove", 31, 630);
    await dispatchPointer(handle, "pointercancel", 31, 630);
    await dispatchPointer(handle, "lostpointercapture", 31, 630);
    await dispatchPointer(handle, "pointerup", 31, 630);
    await expect(events).toHaveAttribute("data-start", "1");
    await expect(events).toHaveAttribute("data-end", "1");
    await expect(events).toHaveAttribute("data-last-canceled", "true");
    await expect(state).toHaveAttribute("data-dragging", "false");
    expect(await bodyStyles(page)).toEqual({
      cursor: "crosshair",
      userSelect: "text",
    });

    await dispatchPointer(handle, "pointerdown", 32, 630);
    await dispatchPointer(handle, "pointermove", 32, 650);
    await dispatchPointer(handle, "lostpointercapture", 32, 650);
    await dispatchPointer(handle, "pointercancel", 32, 650);
    await dispatchPointer(handle, "pointerup", 32, 650);
    await expect(events).toHaveAttribute("data-start", "2");
    await expect(events).toHaveAttribute("data-end", "2");
    await expect(state).toHaveAttribute("data-dragging", "false");
    expect(await bodyStyles(page)).toEqual({
      cursor: "crosshair",
      userSelect: "text",
    });

    // A press-and-release without movement after the abnormal endings is
    // silent (R-03: the lifecycle brackets actual movement) and leaves no
    // stuck claim behind it…
    await dispatchPointer(handle, "pointerdown", 33, 650);
    await dispatchPointer(handle, "pointerup", 33, 650);
    await expect(events).toHaveAttribute("data-start", "2");
    await expect(events).toHaveAttribute("data-end", "2");
    await expect(state).toHaveAttribute("data-dragging", "false");

    // …so a real drag still opens and closes a fresh session normally.
    await dispatchPointer(handle, "pointerdown", 34, 650);
    await dispatchPointer(handle, "pointermove", 34, 670);
    await dispatchPointer(handle, "pointerup", 34, 670);
    await expect(events).toHaveAttribute("data-start", "3");
    await expect(events).toHaveAttribute("data-end", "3");
    await expect(events).toHaveAttribute("data-last-canceled", "false");
  });
});
