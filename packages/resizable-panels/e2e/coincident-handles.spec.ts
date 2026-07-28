import { expect, type Locator, type Page, test } from "@playwright/test";

const panel = (page: Page, id: string) =>
  page.locator(`[data-resizable-panels-panel-id="${id}"]`);

const width = (target: Locator) =>
  target.evaluate((element) => element.getBoundingClientRect().width);

// Chromium gives zero-width panels' overflowing content sequential focus
// (scrollable region), so the tab distance between two coincident handles
// is browser-dependent. Walk Tab until the target owns focus.
async function tabTo(page: Page, target: Locator, maxTabs = 4) {
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error("Tab never reached the target element");
}

async function drag(target: Locator, delta: number) {
  const page = target.page();
  const box = await target.boundingBox();
  if (!box) throw new Error("Expected resize handle");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + delta, y, { steps: 8 });
  await page.mouse.up();
}

test.describe("coincident handles around an expanded zero-sized peer", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto("/test/coincident-handles");
  });

  test("uses drag direction to reopen the peer and locks that boundary", async ({
    page,
  }) => {
    const a = panel(page, "a");
    const b = panel(page, "b");
    const c = panel(page, "c");
    const before = page.getByTestId("a-b-handle");
    const after = page.getByTestId("b-c-handle");
    const lifecycle = page.getByTestId("coincident-lifecycle");

    await drag(after, -200);
    await expect.poll(() => width(b)).toBeCloseTo(0, 0);
    await expect(before).toHaveAttribute("data-pointer-hit-area", "before");
    await expect(after).toHaveAttribute("data-pointer-hit-area", "after");

    const beforeBox = await before.boundingBox();
    const afterBox = await after.boundingBox();
    expect(beforeBox).not.toBeNull();
    expect(afterBox).not.toBeNull();
    expect(
      Math.abs(beforeBox!.x + beforeBox!.width - afterBox!.x),
    ).toBeLessThan(0.1);

    // Start on the right half but move left: the seam selects the left
    // boundary so the zero-width peer grows in the drag direction.
    await drag(after, -50);
    await expect.poll(() => width(a)).toBeCloseTo(150, 0);
    await expect.poll(() => width(b)).toBeCloseTo(50, 0);
    await expect.poll(() => width(c)).toBeCloseTo(400, 0);
    await expect(lifecycle).toHaveAttribute("data-start-handle", "a-b");
    await expect(lifecycle).toHaveAttribute("data-update-handle", "a-b");
    await expect(lifecycle).toHaveAttribute("data-end-handle", "a-b");

    await page.reload();
    await drag(page.getByTestId("b-c-handle"), -200);
    // Start on the left half but move right: the opposite boundary wins.
    await drag(page.getByTestId("a-b-handle"), 50);
    await expect.poll(() => width(panel(page, "a"))).toBeCloseTo(200, 0);
    await expect.poll(() => width(panel(page, "b"))).toBeCloseTo(50, 0);
    await expect.poll(() => width(panel(page, "c"))).toBeCloseTo(350, 0);
    await expect(page.getByTestId("coincident-lifecycle")).toHaveAttribute(
      "data-start-handle",
      "b-c",
    );
    await expect(page.getByTestId("coincident-lifecycle")).toHaveAttribute(
      "data-update-handle",
      "b-c",
    );
    await expect(page.getByTestId("coincident-lifecycle")).toHaveAttribute(
      "data-end-handle",
      "b-c",
    );
  });

  test("active and limited presentation follow the session-owning handle, not the pressed one (R-22)", async ({
    page,
  }) => {
    const pressed = page.getByTestId("a-b-handle");
    const owner = page.getByTestId("b-c-handle");
    const lifecycle = page.getByTestId("coincident-lifecycle");

    // Collapse b to zero so the two handles share one visual seam.
    await drag(owner, -200);
    await expect.poll(() => width(panel(page, "b"))).toBeCloseTo(0, 0);
    await expect(pressed).toHaveAttribute("data-pointer-hit-area", "before");
    await expect(owner).toHaveAttribute("data-pointer-hit-area", "after");

    // Press the LEFT half (a-b captures the pointer) and drag right: the
    // group session transfers to the b-c boundary — the seam that moves.
    const box = await pressed.boundingBox();
    if (!box) throw new Error("Expected resize handle");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y, { steps: 6 });

    await expect(lifecycle).toHaveAttribute("data-start-handle", "b-c");
    // The white highlight belongs to the owning handle whose seam is
    // moving under the cursor — never the pressed-but-stationary half.
    await expect(owner).toHaveAttribute("data-active", "");
    await expect(pressed).not.toHaveAttribute("data-active");
    await expect(owner).not.toHaveAttribute("data-limited");

    // Drive c to its 0px floor: the range-limit flag also belongs to the
    // owning handle.
    await page.mouse.move(x + 520, y, { steps: 6 });
    await expect(owner).toHaveAttribute("data-limited", "");
    await expect(pressed).not.toHaveAttribute("data-limited");
    await expect(owner).toHaveAttribute("data-active", "");
    await expect(pressed).not.toHaveAttribute("data-active");

    // Release (and park the pointer away from both handles): session
    // presentation clears on both. The PRESSED handle keeps FOCUS from its
    // press (R-27 — focus follows the element the user actually pressed,
    // even though the session transferred), but pointer-acquired focus is
    // visually silent (R-29): both handles return fully to rest.
    await page.mouse.up();
    await page.mouse.move(10, 10);
    await expect(owner).not.toHaveAttribute("data-active");
    await expect(pressed).toBeFocused();
    await expect(pressed).not.toHaveAttribute("data-active");
    await expect(owner).not.toHaveAttribute("data-limited");
    await expect(pressed).not.toHaveAttribute("data-limited");
  });

  test("the owning handle's separator line survives mid-drag convergence (R-24)", async ({
    page,
  }) => {
    const before = page.getByTestId("a-b-handle");
    const after = page.getByTestId("b-c-handle");
    const beforeLine = before.locator(
      "[data-resizable-panels-resize-handle-line]",
    );
    const afterLine = after.locator(
      "[data-resizable-panels-resize-handle-line]",
    );

    // Converge the seams (b → 0), then separate them again so a fresh
    // full-hit-area drag on b-c can bring them back together while HELD.
    await drag(after, -200);
    await expect.poll(() => width(panel(page, "b"))).toBeCloseTo(0, 0);
    // Press the shared seam and drag right: the b-c boundary opens b.
    await drag(before, 60);
    await expect.poll(() => width(panel(page, "b"))).toBeCloseTo(60, 0);

    // Drag the b-c seam left past the convergence point and HOLD: b hits
    // zero, the cascade continues into a, and both handle slots share one
    // coordinate while the b-c session is still live.
    const box = await after.boundingBox();
    if (!box) throw new Error("Expected resize handle");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 100, y, { steps: 8 });

    await expect.poll(() => width(panel(page, "b"))).toBeCloseTo(0, 0);
    await expect(after).toHaveAttribute("data-active", "");
    // The line belongs to the session-owning handle — the seam the user is
    // holding — not to whichever handle happens to come first in DOM order.
    // The stationary a-b handle's line is the suppressed one.
    await expect(afterLine).toHaveCount(1);
    await expect(beforeLine).toHaveCount(0);

    // Release and park the pointer: steady-state dedup returns to DOM
    // order — exactly one line at the shared coordinate, on a-b — even
    // though b-c keeps focus from its press (R-27): pointer-acquired
    // focus publishes no keyboard-visible modality, so it gets no say in
    // the dedup and no lit presentation either (R-29) — the focused b-c
    // handle rests until a keydown upgrades the modality.
    await page.mouse.up();
    await page.mouse.move(10, 10);
    await expect(beforeLine).toHaveCount(1);
    await expect(afterLine).toHaveCount(0);
    await expect(after).toBeFocused();
    await expect(after).not.toHaveAttribute("data-active");
  });

  test("hovering either half of a coincident seam lights the run's elected line (R-26/R-28)", async ({
    page,
  }) => {
    const before = page.getByTestId("a-b-handle");
    const after = page.getByTestId("b-c-handle");
    const beforeLine = before.locator(
      "[data-resizable-panels-resize-handle-line]",
    );
    const afterLine = after.locator(
      "[data-resizable-panels-resize-handle-line]",
    );

    // Collapse b so the two handles share one visual seam with split hit
    // areas: a-b owns the left half, b-c the right. Blur the press-focused
    // b-c handle (R-27 keeps it focused after release; pointer-modality
    // focus is visually silent and election-inert per R-29, but the blur
    // keeps only hover in play below).
    await drag(after, -200);
    await expect.poll(() => width(panel(page, "b"))).toBeCloseTo(0, 0);
    await expect(before).toHaveAttribute("data-pointer-hit-area", "before");
    await expect(after).toHaveAttribute("data-pointer-hit-area", "after");
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());

    // Hover the RIGHT half: the later-in-DOM b-c handle goes data-active
    // (element state stays truthful to the hovered element), and the run's
    // ELECTED line lights — with no session and no keyboard focus the
    // election is DOM order, so the lit line is a-b's (R-28: hover decides
    // WHETHER the seam lights, never WHICH line shows). The R-26 guarantee
    // stands: approaching from the right must light the seam, never a
    // cursor change with nothing lit.
    const afterBox = await after.boundingBox();
    if (!afterBox) throw new Error("Expected resize handle");
    await page.mouse.move(
      afterBox.x + afterBox.width / 2,
      afterBox.y + afterBox.height / 2,
    );
    await expect(after).toHaveAttribute("data-active", "");
    await expect(beforeLine).toHaveCount(1);
    await expect(beforeLine).toHaveCSS("opacity", "0.6");
    await expect(afterLine).toHaveCount(0);

    // Mirror: hover the LEFT half — the SAME elected line stays lit; only
    // the truthful data-active moves to the hovered element.
    const beforeBox = await before.boundingBox();
    if (!beforeBox) throw new Error("Expected resize handle");
    await page.mouse.move(
      beforeBox.x + beforeBox.width / 2,
      beforeBox.y + beforeBox.height / 2,
    );
    await expect(before).toHaveAttribute("data-active", "");
    await expect(after).not.toHaveAttribute("data-active");
    await expect(beforeLine).toHaveCount(1);
    await expect(beforeLine).toHaveCSS("opacity", "0.6");
    await expect(afterLine).toHaveCount(0);

    // Park the pointer: steady state returns to DOM-order dedup, unlit.
    await page.mouse.move(10, 10);
    await expect(beforeLine).toHaveCount(1);
    await expect(afterLine).toHaveCount(0);
    await expect(before).not.toHaveAttribute("data-active");
    await expect(beforeLine).toHaveCSS("opacity", "0");
  });

  test("a hover sweep across the seam midline keeps ONE lit line at a stable position (R-28)", async ({
    page,
  }) => {
    const before = page.getByTestId("a-b-handle");
    const after = page.getByTestId("b-c-handle");
    const beforeLine = before.locator(
      "[data-resizable-panels-resize-handle-line]",
    );
    const afterLine = after.locator(
      "[data-resizable-panels-resize-handle-line]",
    );
    const anyLine = page.locator("[data-resizable-panels-resize-handle-line]");

    // Collapse b so the two handles share one visual seam with split hit
    // areas, blur the press-focused b-c handle (R-27 keeps it focused
    // until blur; visually silent per R-29, but the blur keeps only hover
    // in play), then park the pointer clear of the seam.
    await drag(after, -200);
    await expect.poll(() => width(panel(page, "b"))).toBeCloseTo(0, 0);
    await expect(before).toHaveAttribute("data-pointer-hit-area", "before");
    await expect(after).toHaveAttribute("data-pointer-hit-area", "after");
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.mouse.move(10, 10);
    await expect(before).not.toHaveAttribute("data-active");
    await expect(after).not.toHaveAttribute("data-active");

    const beforeBox = await before.boundingBox();
    const afterBox = await after.boundingBox();
    if (!beforeBox || !afterBox) throw new Error("Expected resize handles");
    const y = beforeBox.y + beforeBox.height / 2;
    const startX = beforeBox.x + 1;
    const endX = afterBox.x + afterBox.width - 1;

    // First sample (a-b's half) establishes the run's elected line — DOM
    // order, no session or keyboard focus in play — and its position.
    await page.mouse.move(startX, y);
    await expect(beforeLine).toHaveCount(1);
    await expect(beforeLine).toHaveCSS("opacity", "0.6");
    const electedBox = await beforeLine.boundingBox();
    if (!electedBox) throw new Error("Expected the elected line");

    // Sweep across the whole shared hit area — midline included — in 1px
    // steps. At EVERY sample the run presents as ONE seam: exactly one
    // line element in the run, the SAME element at the SAME coordinates,
    // lit. Pre-fix, crossing the hit-area midline swapped the mounted line
    // to the hovered half: an identity flip plus a 1px position jump that
    // read as two handles.
    for (let x = startX; x <= endX; x += 1) {
      await page.mouse.move(x, y);
      await expect(anyLine).toHaveCount(1);
      await expect(beforeLine).toHaveCount(1);
      await expect(afterLine).toHaveCount(0);
      await expect(beforeLine).toHaveCSS("opacity", "0.6");
      // The LINE's own data-active is the run-aware lit state consumers
      // restyling the line key off — set from either half of the seam.
      await expect(beforeLine).toHaveAttribute("data-active", "");
      const sampleBox = await beforeLine.boundingBox();
      expect(sampleBox?.x).toBe(electedBox.x);
      expect(sampleBox?.y).toBe(electedBox.y);
    }

    // While the lit line held still, data-active stayed truthful to the
    // hovered ELEMENT: the sweep ended in b-c's half.
    await expect(after).toHaveAttribute("data-active", "");
    await expect(before).not.toHaveAttribute("data-active");

    // Leaving the hit area unlights the elected line without moving it.
    await page.mouse.move(10, 10);
    await expect(beforeLine).toHaveCount(1);
    await expect(beforeLine).toHaveCSS("opacity", "0");
    await expect(beforeLine).not.toHaveAttribute("data-active");
    await expect(afterLine).toHaveCount(0);
  });

  test("keyboard focus lights the focused handle's line at a coincident seam (R-26/R-23)", async ({
    page,
  }) => {
    const before = page.getByTestId("a-b-handle");
    const after = page.getByTestId("b-c-handle");
    const beforeLine = before.locator(
      "[data-resizable-panels-resize-handle-line]",
    );
    const afterLine = after.locator(
      "[data-resizable-panels-resize-handle-line]",
    );

    await drag(after, -200);
    await expect.poll(() => width(panel(page, "b"))).toBeCloseTo(0, 0);
    // Clear pointer focus/hover so only keyboard focus is in play.
    await page.mouse.click(10, 10);
    await page.mouse.move(10, 10);

    // Tab into the group: a-b first (also the DOM-order primary).
    await tabTo(page, before);
    await expect(before).toBeFocused();
    await expect(beforeLine).toHaveCount(1);
    await expect(beforeLine).toHaveCSS("opacity", "0.6");

    // Tab to b-c: keyboard focus must surface the suppressed handle's
    // line — a focused separator can never be invisible.
    await tabTo(page, after);
    await expect(after).toBeFocused();
    await expect(after).toHaveAttribute("data-active", "");
    await expect(afterLine).toHaveCount(1);
    await expect(afterLine).toHaveCSS("opacity", "0.6");
    await expect(beforeLine).toHaveCount(0);

    // Focus leaves the group: steady-state dedup returns to DOM order.
    await page.keyboard.press("Tab");
    await expect(afterLine).toHaveCount(0);
    await expect(beforeLine).toHaveCount(1);
  });

  test("places the split targets on the corresponding panel sides in RTL", async ({
    page,
  }) => {
    await page.goto("/test/coincident-handles?rtl");
    const before = page.getByTestId("a-b-handle");
    const after = page.getByTestId("b-c-handle");

    await drag(after, 200);
    await expect.poll(() => width(panel(page, "b"))).toBeCloseTo(0, 0);

    const beforeBox = await before.boundingBox();
    const afterBox = await after.boundingBox();
    expect(beforeBox).not.toBeNull();
    expect(afterBox).not.toBeNull();
    expect(Math.abs(afterBox!.x + afterBox!.width - beforeBox!.x)).toBeLessThan(
      0.1,
    );
  });

  test("leaves an interior handle keyboard-only inside a zero-sized run", async ({
    page,
  }) => {
    await page.goto("/test/coincident-handles?run");
    const before = page.getByTestId("a-b-handle");
    const interior = page.getByTestId("b-c-handle");
    const after = page.getByTestId("c-d-handle");

    await expect(before).toHaveAttribute("data-pointer-hit-area", "before");
    await expect(interior).toHaveAttribute("data-pointer-hit-area", "none");
    await expect(interior).toHaveCSS("pointer-events", "none");
    await expect(interior).toHaveAttribute("tabindex", "0");
    await expect(after).toHaveAttribute("data-pointer-hit-area", "after");
  });
});
