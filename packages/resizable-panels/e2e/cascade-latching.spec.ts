import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * `cascade="latching"` (R-25): within a held pointer drag, cascade pushes
 * are one-way. Reversing direction rebases the session at the directional
 * extreme, so panels regrow starting from the boundary-adjacent panel and
 * far panels keep their pushed size. The default `"reversible"` mode is
 * covered by the existing drag/cascade suites, which assert the unwind
 * behavior and run unchanged.
 *
 * Fixture geometry (600px group): a 150 (min 100) | b 100 (min 20) | c 350.
 * Dragging the b|c seam left 120 shrinks b to 20 (80px) then cascades 40px
 * into a (→ 110). Under latching, reversing 60px while held regrows b to 80
 * and leaves a at 110; under reversible the same pointer position restores
 * a to 150 with b at 40.
 */

const panel = (page: Page, id: string) =>
  page.locator(`[data-resizable-panels-panel-id="${id}"]`);

const width = (target: Locator) =>
  target.evaluate((element) => element.getBoundingClientRect().width);

async function pressHandle(handle: Locator): Promise<{ x: number; y: number }> {
  const page = handle.page();
  const box = await handle.boundingBox();
  if (!box) throw new Error("Expected resize handle");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  return { x, y };
}

test.describe("cascade latching — reversal while held", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto("/test/cascade-latching");
  });

  test("reversing regrows the adjacent panel; the far panel keeps its pushed size", async ({
    page,
  }) => {
    const a = panel(page, "a");
    const b = panel(page, "b");
    const c = panel(page, "c");
    const handle = page.getByTestId("b-c-handle");
    const lifecycle = page.getByTestId("latching-lifecycle");

    const { x, y } = await pressHandle(handle);
    // Push left through b into a: b bottoms at its 20px min, the remaining
    // 40px cascades into a.
    await page.mouse.move(x - 120, y, { steps: 8 });
    await expect.poll(() => width(b)).toBeCloseTo(20, 0);
    await expect.poll(() => width(a)).toBeCloseTo(110, 0);
    await expect.poll(() => width(c)).toBeCloseTo(470, 0);

    // Reverse WHILE HELD: the latch rebases at the extreme, so the
    // boundary-adjacent b regrows and a keeps its pushed 110 — reversible
    // semantics would restore a to 150 first (b only 40) at this pointer
    // position.
    await page.mouse.move(x - 60, y, { steps: 6 });
    await expect.poll(() => width(b)).toBeCloseTo(80, 0);
    await expect.poll(() => width(a)).toBeCloseTo(110, 0);
    await expect.poll(() => width(c)).toBeCloseTo(410, 0);

    // The event contract is rebase-blind: onResizeEnd still reports the
    // ORIGINAL session start as initialValue.
    await page.mouse.up();
    await expect.poll(() => width(a)).toBeCloseTo(110, 0);
    await expect.poll(() => width(b)).toBeCloseTo(80, 0);
    await expect(lifecycle).toHaveAttribute("data-end-handle", "h2");
    await expect(lifecycle).toHaveAttribute("data-end-initial", /a:150 b:100/);
    await expect(lifecycle).toHaveAttribute("data-end-canceled", "false");
  });

  test("±1px jitter mid-push never latches: final sizes equal the clean run", async ({
    page,
  }) => {
    const a = panel(page, "a");
    const b = panel(page, "b");
    const c = panel(page, "c");
    const handle = page.getByTestId("b-c-handle");

    const { x, y } = await pressHandle(handle);
    await page.mouse.move(x - 60, y, { steps: 6 });
    // Pointer micro-jitter around -60: every retreat stays within the 2px
    // dead-band, so nothing rebases.
    for (const jitter of [-59, -60, -61, -60, -59, -60]) {
      await page.mouse.move(x + jitter, y);
    }
    await page.mouse.move(x - 120, y, { steps: 6 });

    // Identical to an uninterrupted push to -120 (b at min, 40 into a).
    await expect.poll(() => width(b)).toBeCloseTo(20, 0);
    await expect.poll(() => width(a)).toBeCloseTo(110, 0);
    await expect.poll(() => width(c)).toBeCloseTo(470, 0);
    await page.mouse.up();
  });

  test("dead-band boundary: a 2px retreat unwinds reversibly, a 3px retreat latches", async ({
    page,
  }) => {
    const a = panel(page, "a");
    const b = panel(page, "b");
    const handle = page.getByTestId("b-c-handle");

    const { x, y } = await pressHandle(handle);
    await page.mouse.move(x - 120, y, { steps: 8 });
    await expect.poll(() => width(a)).toBeCloseTo(110, 0);

    // 2px back from the extreme: inside the dead-band the session origin is
    // unchanged, so the tick unwinds reversibly — the FAR panel regains the
    // 2px (a 110 → 112), exactly as reversible mode would.
    await page.mouse.move(x - 118, y);
    await expect.poll(() => width(a)).toBeCloseTo(112, 0);
    await expect.poll(() => width(b)).toBeCloseTo(20, 0);

    // One more pixel crosses the band: the session rebases at the extreme
    // (nothing is lost to the band) and the retreat becomes adjacent-first
    // growth — b takes all 3px and a returns to its pushed 110.
    await page.mouse.move(x - 117, y);
    await expect.poll(() => width(b)).toBeCloseTo(23, 0);
    await expect.poll(() => width(a)).toBeCloseTo(110, 0);
    await page.mouse.up();
  });

  test("keyboard steps stay atomic single deltas on a latching group", async ({
    page,
  }) => {
    const a = panel(page, "a");
    const b = panel(page, "b");
    const handle = page.getByTestId("b-c-handle");

    await handle.focus();
    await handle.press("ArrowLeft");
    await handle.press("ArrowLeft");
    await expect.poll(() => width(b)).toBeCloseTo(80, 0);
    await expect.poll(() => width(a)).toBeCloseTo(150, 0);
    await handle.press("ArrowRight");
    await expect.poll(() => width(b)).toBeCloseTo(90, 0);
    await expect.poll(() => width(a)).toBeCloseTo(150, 0);
  });

  test("latches in RTL against the mirrored axis", async ({ page }) => {
    await page.goto("/test/cascade-latching?rtl");
    const a = panel(page, "a");
    const b = panel(page, "b");
    const handle = page.getByTestId("b-c-handle");

    const { x, y } = await pressHandle(handle);
    // RTL mirrors the axis: dragging visually RIGHT is the logical push
    // that shrinks b then cascades into a.
    await page.mouse.move(x + 120, y, { steps: 8 });
    await expect.poll(() => width(b)).toBeCloseTo(20, 0);
    await expect.poll(() => width(a)).toBeCloseTo(110, 0);

    // Reverse while held: adjacent-first regrowth, far panel stays pushed.
    await page.mouse.move(x + 60, y, { steps: 6 });
    await expect.poll(() => width(b)).toBeCloseTo(80, 0);
    await expect.poll(() => width(a)).toBeCloseTo(110, 0);
    await page.mouse.up();
  });
});

test.describe("cascade latching — collapseBelow interaction", () => {
  test("hysteresis reopen works from the rebased geometry; the far panel stays pushed", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto("/test/cascade-latching?collapsible");
    const far = panel(page, "far");
    const col = panel(page, "col");
    const main = panel(page, "main");
    const handle = page.getByTestId("col-main-handle");

    // far 120 (min 60) | col 200 (collapseBelow 120, hysteresis 24,
    // rail 8) | main 280. Drag the col|main seam left past both the
    // collapse threshold and far's min: col snaps to its 8px rail and the
    // cascade pushes far to 60. The pointer overshoots the 252px capacity —
    // the rebase must anchor at the APPLIED extreme, not the raw pointer.
    const { x, y } = await pressHandle(handle);
    await page.mouse.move(x - 320, y, { steps: 10 });
    await expect.poll(() => width(col)).toBeCloseTo(8, 0);
    await expect.poll(() => width(far)).toBeCloseTo(60, 0);
    await expect.poll(() => width(main)).toBeCloseTo(532, 0);

    // Reverse while held to raw -50: from the rebased origin col's raw size
    // grows 8 → 210, crossing the 180px reopen boundary
    // (max(minSize, collapseBelow + hysteresis)) — col reopens while far
    // keeps its pushed 60 (reversible mode would still be collapsed here
    // with far restored to 120).
    await page.mouse.move(x - 50, y, { steps: 8 });
    await expect.poll(() => width(col)).toBeCloseTo(210, 0);
    await expect.poll(() => width(far)).toBeCloseTo(60, 0);
    await expect.poll(() => width(main)).toBeCloseTo(330, 0);

    await page.mouse.up();
    await expect.poll(() => width(col)).toBeCloseTo(210, 0);
    await expect.poll(() => width(far)).toBeCloseTo(60, 0);
  });
});
