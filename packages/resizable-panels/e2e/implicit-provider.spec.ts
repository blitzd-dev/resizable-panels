import { expect, type Locator, type Page, test } from "@playwright/test";
import { dragHandle, readRenderedSize } from "./helpers";

/**
 * §14 implicit provider — real-browser coverage. The fixture at
 * /test/implicit-provider renders NO `PanelProvider` anywhere; every group
 * must install (or reuse) an implicit one. The harness mounts fixtures under
 * React.StrictMode, so every test here is also a providerless StrictMode
 * mount.
 *
 * The competing-sessions test is the §14 body-style-corruption regression:
 * two standalone sibling groups are two implicit providers in one document,
 * and only the document-scoped pointer lease keeps their body cursor /
 * user-select save-restore from interleaving. A sentinel body style is set
 * before dragging and must survive the whole sequence.
 */

const PERSIST_KEY = "implicit-provider-persist";

const bodyStyles = (page: Page) =>
  page.evaluate(() => ({
    cursor: document.body.style.cursor,
    userSelect: document.body.style.userSelect,
  }));

const setSentinelBodyStyles = (page: Page) =>
  page.evaluate(() => {
    document.body.style.cursor = "help";
    document.body.style.userSelect = "text";
  });

const SENTINEL = { cursor: "help", userSelect: "text" };
const DRAGGING = { cursor: "col-resize", userSelect: "none" };

const width = (panel: Locator) =>
  panel.evaluate((element) => element.getBoundingClientRect().width);

const panel = (page: Page, panelId: string) =>
  page.locator(`[data-resizable-panels-panel-id="${panelId}"]`);

/** Real-mouse drag that stays held between move steps so mid-drag state can
 *  be asserted; caller is responsible for `page.mouse.up()`. */
async function holdDrag(page: Page, handle: Locator, dx: number) {
  const box = await handle.boundingBox();
  if (!box) throw new Error("handle not found");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy, { steps: 4 });
  return { cx, cy };
}

/** Synthetic touch-pointer dispatch, so a second "pointer" can poke at a
 *  handle while the real Playwright mouse (a single pointer) is held down
 *  on another one. */
async function dispatchPointer(
  target: Locator,
  type: "pointerdown" | "pointermove" | "pointerup",
  pointerId: number,
  clientX: number,
  clientY: number,
) {
  await target.dispatchEvent(type, {
    pointerId,
    pointerType: "touch",
    clientX,
    clientY,
    button: type === "pointermove" ? -1 : 0,
    buttons: type === "pointerup" ? 0 : 1,
  });
}

test.describe("implicit provider (§14)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
  });

  test("providerless pointer drag resizes and saves/restores body styles", async ({
    page,
  }) => {
    await page.goto("/test/implicit-provider");
    await setSentinelBodyStyles(page);
    const sidebar = panel(page, "sidebar");
    await expect.poll(() => width(sidebar)).toBeCloseTo(240, 0);

    await holdDrag(page, page.getByTestId("solo-handle"), 60);
    // Mid-drag: the implicit provider's session owns the body styles.
    expect(await bodyStyles(page)).toEqual(DRAGGING);
    await expect.poll(() => width(sidebar)).toBeCloseTo(300, 0);

    await page.mouse.up();
    await expect.poll(() => width(sidebar)).toBeCloseTo(300, 0);
    // Post-drag: the pre-drag sentinel styles are restored verbatim.
    expect(await bodyStyles(page)).toEqual(SENTINEL);
  });

  test("providerless keyboard resize steps the panel", async ({ page }) => {
    await page.goto("/test/implicit-provider");
    const sidebar = panel(page, "sidebar");
    const handle = page.getByTestId("solo-handle");
    await expect.poll(() => width(sidebar)).toBeCloseTo(240, 0);

    await handle.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => width(sidebar)).toBeCloseTo(250, 0);
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => width(sidebar)).toBeCloseTo(230, 0);
  });

  test("providerless Enter on the handle collapses and expands", async ({
    page,
  }) => {
    await page.goto("/test/implicit-provider");
    const sidebar = panel(page, "sidebar");
    const handle = page.getByTestId("solo-handle");
    await expect.poll(() => width(sidebar)).toBeCloseTo(240, 0);

    await handle.focus();
    await page.keyboard.press("Enter");
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");
    await expect.poll(() => width(sidebar)).toBeCloseTo(32, 0);

    // The fixture keeps the collapsed sidebar as a 32px rail with
    // `resizableWhenCollapsed`, so the handle stays interactive and Enter
    // reopens the panel at its preferred size.
    await page.keyboard.press("Enter");
    await expect(sidebar).toHaveAttribute("data-state", "expanded");
    await expect.poll(() => width(sidebar)).toBeCloseTo(240, 0);
  });

  test("providerless apiRef getValue and setValue work", async ({ page }) => {
    await page.goto("/test/implicit-provider");
    const sidebar = panel(page, "sidebar");
    const read = page.getByTestId("read-layout");
    await expect.poll(() => width(sidebar)).toBeCloseTo(240, 0);

    await read.click();
    const initial = JSON.parse((await read.getAttribute("data-layout")) ?? "");
    expect(initial.sidebar?.size).toBe(240);

    await page.getByTestId("set-layout").click();
    await expect.poll(() => width(sidebar)).toBeCloseTo(400, 0);
    await read.click();
    const applied = JSON.parse((await read.getAttribute("data-layout")) ?? "");
    expect(applied.sidebar?.size).toBe(400);
  });

  test("providerless StrictMode mount logs no console errors and drags", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));

    // main.tsx wraps every fixture in <StrictMode>, so this is a
    // providerless double-invoked mount.
    await page.goto("/test/implicit-provider");
    const sidebar = panel(page, "sidebar");
    await expect.poll(() => width(sidebar)).toBeCloseTo(240, 0);
    await dragHandle(page.locator("body"), {
      panelId: "sidebar",
      delta: 80,
      quick: true,
    });
    await expect.poll(() => width(sidebar)).toBeCloseTo(320, 0);
    expect(errors).toEqual([]);
  });

  test("providerless persistence restores and writes through the adapter", async ({
    page,
  }) => {
    await page.goto("/test/implicit-provider?persist");
    const sidebar = panel(page, "sidebar");
    await expect.poll(() => width(sidebar)).toBeCloseTo(240, 0);

    await dragHandle(page.locator("body"), {
      panelId: "sidebar",
      delta: 80,
      quick: true,
    });
    await expect.poll(() => width(sidebar)).toBeCloseTo(320, 0);

    // Write-back is debounced 200ms inside PanelGroup; wait it out, then
    // prove the user-supplied sessionStorage adapter received the snapshot.
    await page.waitForTimeout(300);
    const persisted = await page.evaluate((key) => {
      const raw = window.sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, PERSIST_KEY);
    expect(persisted?.panels?.sidebar?.size).toBeCloseTo(320, 0);

    await page.reload();
    await expect.poll(() => width(sidebar)).toBeCloseTo(320, 0);
  });

  test("competing sessions across standalone siblings cannot corrupt body styles", async ({
    page,
  }) => {
    await page.goto("/test/implicit-provider?variant=siblings");
    await setSentinelBodyStyles(page);
    const aSide = panel(page, "a-side");
    const bSide = panel(page, "b-side");
    const handleB = page.getByTestId("handle-b");
    await expect.poll(() => width(aSide)).toBeCloseTo(240, 0);
    await expect.poll(() => width(bSide)).toBeCloseTo(240, 0);

    // Hold a real-mouse drag on group A's handle.
    const { cx, cy } = await holdDrag(page, page.getByTestId("handle-a"), 30);
    expect(await bodyStyles(page)).toEqual(DRAGGING);
    await expect.poll(() => width(aSide)).toBeCloseTo(270, 0);

    // While A's session is live, a second pointer tries to start a session
    // on group B's handle (different implicit provider, same document). The
    // document-scoped lease must reject it: B's sizes never move, and B's
    // provider must not save the mid-drag body styles as "previous".
    const boxB = await handleB.boundingBox();
    if (!boxB) throw new Error("handle-b not found");
    const bx = boxB.x + boxB.width / 2;
    const by = boxB.y + boxB.height / 2;
    await dispatchPointer(handleB, "pointerdown", 77, bx, by);
    await dispatchPointer(handleB, "pointermove", 77, bx + 40, by);
    await page.waitForTimeout(100);
    await expect.poll(() => width(bSide)).toBeCloseTo(240, 0);
    expect(await bodyStyles(page)).toEqual(DRAGGING);
    await dispatchPointer(handleB, "pointerup", 77, bx + 40, by);

    // Finish A's drag: sizes committed, sentinel styles restored verbatim
    // (the regression restored B's saved copy — the drag cursor — instead).
    await page.mouse.move(cx + 60, cy, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => width(aSide)).toBeCloseTo(300, 0);
    await expect.poll(() => width(bSide)).toBeCloseTo(240, 0);
    expect(await bodyStyles(page)).toEqual(SENTINEL);

    // The lease was released: B can now run a normal session, and the
    // sentinel survives that session too.
    await holdDrag(page, handleB, 50);
    expect(await bodyStyles(page)).toEqual(DRAGGING);
    await page.mouse.up();
    await expect.poll(() => width(bSide)).toBeCloseTo(290, 0);
    expect(await bodyStyles(page)).toEqual(SENTINEL);
  });

  test("nested providerless groups share the outer implicit provider", async ({
    page,
  }) => {
    await page.goto("/test/implicit-provider?variant=nested");
    const scope = page.locator("body");
    const probe = page.getByTestId("probe-inner-terminal");
    await expect(probe).toHaveAttribute("data-found", "true");

    // Drag the outer group's handle.
    const sidebarBefore = await readRenderedSize(scope, "sidebar");
    await dragHandle(scope, { panelId: "sidebar", delta: 60, quick: true });
    await expect
      .poll(() => readRenderedSize(scope, "sidebar"))
      .toBeCloseTo(sidebarBefore + 60, 0);

    // Drag the inner (vertical) group's handle.
    const terminalBefore = await readRenderedSize(scope, "terminal", "height");
    await dragHandle(scope, { panelId: "terminal", delta: 40, quick: true });
    await expect
      .poll(() => readRenderedSize(scope, "terminal", "height"))
      .toBeCloseTo(terminalBefore + 40, 0);

    // The probe lives in the OUTER tree but addresses the INNER group by
    // groupId — it resolves only if both groups share one implicit
    // provider, and it must track the inner panel's rendered size.
    const terminal = await readRenderedSize(scope, "terminal", "height");
    await expect
      .poll(async () => Number(await probe.textContent()))
      .toBeCloseTo(terminal, 0);
  });
});
