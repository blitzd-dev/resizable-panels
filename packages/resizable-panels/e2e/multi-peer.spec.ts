import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  dragSeam,
  expectSumInvariant,
  readAllRenderedSizes,
  readContainerSize,
  setViewport,
  waitForSettled,
} from "./helpers";

function scope(page: Page): Locator {
  return page.locator("body");
}

function near(actual: number, target: number, tolerance = 2): boolean {
  return Math.abs(actual - target) <= tolerance;
}

test.describe("Multiple peers — seam handles", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/test/multi-peer");
    await waitForSettled(scope(page));
    await page.waitForTimeout(50);
  });

  // ─── initial distribution ──────────────────────────────────────────────────

  test.describe("initial state", () => {
    test("sums to container width", async ({ page }) => {
      await expectSumInvariant(scope(page));
    });

    test("four peers distribute equally (~25% each)", async ({ page }) => {
      const s = scope(page);
      const container = await readContainerSize(s);
      const sizes = await readAllRenderedSizes(s);
      for (const id of ["a", "b", "c", "d"]) {
        const size = sizes.get(id) ?? 0;
        expect(near(size, container / 4, 4)).toBe(true);
      }
    });
  });

  // ─── seam drag (zero-sum) ──────────────────────────────────────────────────

  test.describe("seam drag", () => {
    test("drag A↔B seam right: A grows, B shrinks, C/D untouched", async ({
      page,
    }) => {
      const s = scope(page);
      const sizesBefore = await readAllRenderedSizes(s);
      await dragSeam(s, { leftPeerId: "a", delta: 60 });
      await waitForSettled(s);
      const sizesAfter = await readAllRenderedSizes(s);

      expect(near(sizesAfter.get("a")!, sizesBefore.get("a")! + 60, 3)).toBe(
        true,
      );
      expect(near(sizesAfter.get("b")!, sizesBefore.get("b")! - 60, 3)).toBe(
        true,
      );
      expect(near(sizesAfter.get("c")!, sizesBefore.get("c")!, 2)).toBe(true);
      expect(near(sizesAfter.get("d")!, sizesBefore.get("d")!, 2)).toBe(true);
      await expectSumInvariant(s);
    });

    test("drag B↔C seam left: B shrinks, C grows, A/D untouched", async ({
      page,
    }) => {
      const s = scope(page);
      const before = await readAllRenderedSizes(s);
      await dragSeam(s, { leftPeerId: "b", delta: -40 });
      await waitForSettled(s);
      const after = await readAllRenderedSizes(s);

      expect(near(after.get("b")!, before.get("b")! - 40, 3)).toBe(true);
      expect(near(after.get("c")!, before.get("c")! + 40, 3)).toBe(true);
      expect(near(after.get("a")!, before.get("a")!, 2)).toBe(true);
      expect(near(after.get("d")!, before.get("d")!, 2)).toBe(true);
      await expectSumInvariant(s);
    });

    test("drag C↔D seam grows C, shrinks D", async ({ page }) => {
      const s = scope(page);
      const before = await readAllRenderedSizes(s);
      await dragSeam(s, { leftPeerId: "c", delta: 50 });
      await waitForSettled(s);
      const after = await readAllRenderedSizes(s);

      expect(near(after.get("c")!, before.get("c")! + 50, 3)).toBe(true);
      expect(near(after.get("d")!, before.get("d")! - 50, 3)).toBe(true);
      expect(near(after.get("a")!, before.get("a")!, 2)).toBe(true);
      expect(near(after.get("b")!, before.get("b")!, 2)).toBe(true);
      await expectSumInvariant(s);
    });
  });

  // ─── cascade ───────────────────────────────────────────────────────────────

  test.describe("cascade", () => {
    test("drag A↔B past B's min cascades into C", async ({ page }) => {
      const s = scope(page);
      const before = await readAllRenderedSizes(s);
      const container = await readContainerSize(s);
      // B starts at 25%, min is 10%. Capacity = 15% × 1280 ≈ 192 px.
      // Drag A↔B by 250 px: B will hit min and the seam should cascade
      // into C (RRP-style cascade through the chain).
      await dragSeam(s, { leftPeerId: "a", delta: 250 });
      await waitForSettled(s);
      const after = await readAllRenderedSizes(s);

      // B at (or near) its min.
      expect(near(after.get("b")!, container * 0.1, 6)).toBe(true);
      // A grew, C shrank to absorb the rest.
      expect(after.get("a")!).toBeGreaterThan(before.get("a")! + 100);
      expect(after.get("c")!).toBeLessThan(before.get("c")! - 5);
      // D should NOT be touched in this regime — single seam cascade only
      // walks as far as needed.
      expect(near(after.get("d")!, before.get("d")!, 4)).toBe(true);
      await expectSumInvariant(s);
    });

    test("zero-sum invariant: every drag preserves Σ peer sizes", async ({
      page,
    }) => {
      const s = scope(page);
      const container = await readContainerSize(s);
      // Several drags in different directions; sum should still match.
      await dragSeam(s, { leftPeerId: "a", delta: 40 });
      await waitForSettled(s);
      await dragSeam(s, { leftPeerId: "c", delta: -30 });
      await waitForSettled(s);
      await dragSeam(s, { leftPeerId: "b", delta: 20 });
      await waitForSettled(s);

      const sizes = await readAllRenderedSizes(s);
      const sum =
        sizes.get("a")! + sizes.get("b")! + sizes.get("c")! + sizes.get("d")!;
      expect(near(sum, container, 4)).toBe(true);
      await expectSumInvariant(s);
    });
  });

  // ─── cursor feedback ──────────────────────────────────────────────────────

  test.describe("cursor feedback", () => {
    test("stays bidirectional during cascade, flips only at hard limit", async ({
      page,
    }) => {
      const s = scope(page);
      const seamHandle = s
        .locator(
          `[data-resizable-panels-panel-id="a"] + [data-resizable-panels-resize-handle-slot] [data-resizable-panels-resize-handle]`,
        )
        .first();
      const box = await seamHandle.boundingBox();
      if (!box) throw new Error("A/B seam handle not found.");

      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down();

      // B has already hit min by this point and the drag has cascaded into
      // C, but the seam can still move right, so keep the normal divider
      // cursor.
      await page.mouse.move(startX + 250, startY, { steps: 12 });
      await expect
        .poll(() => page.evaluate(() => document.body.style.cursor))
        .toBe("col-resize");

      // Past the full shrink-side chain capacity, B/C/D are all pinned at
      // min. The seam can only move back left.
      await page.mouse.move(startX + 620, startY, { steps: 12 });
      await expect
        .poll(() => page.evaluate(() => document.body.style.cursor))
        .toBe("w-resize");

      await page.mouse.up();
    });
  });

  // ─── viewport resize ───────────────────────────────────────────────────────

  test.describe("viewport resize", () => {
    test("peers scale proportionally on viewport grow / shrink", async ({
      page,
    }) => {
      const s = scope(page);
      // Capture ratios at the starting viewport, then resize and check
      // ratios are preserved.
      const beforeContainer = await readContainerSize(s);
      const beforeSizes = await readAllRenderedSizes(s);
      const ratios = new Map<string, number>();
      for (const [id, size] of beforeSizes) {
        ratios.set(id, size / beforeContainer);
      }

      await setViewport(page, 900, 800, s);
      await page.waitForTimeout(80);

      const after = await readAllRenderedSizes(s);
      const afterContainer = await readContainerSize(s);
      for (const [id, expectedRatio] of ratios) {
        const actualRatio = (after.get(id) ?? 0) / afterContainer;
        // ±2 percentage points tolerance (CSS flex rounding + flex-grow
        // distribution).
        expect(Math.abs(actualRatio - expectedRatio)).toBeLessThan(0.02);
      }
      await expectSumInvariant(s);
    });
  });
});
