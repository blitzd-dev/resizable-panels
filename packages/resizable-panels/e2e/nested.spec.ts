import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  clickToggle,
  dragHandle,
  expectSumInvariant,
  readContainerSize,
  readRenderedSize,
  setViewport,
  waitForSettled,
} from "./helpers";

const SIDEBAR = "sidebar";
const TERMINAL = "terminal";
const INSPECTOR = "inspector";

function scope(page: Page): Locator {
  return page.locator("body");
}

async function snapshot(s: Locator) {
  // Sidebar/inspector are in the outer horizontal group; terminal is in the
  // inner vertical group nested inside the peer. Read width for the
  // horizontal-axis panels, height for the vertical-axis one.
  return {
    sidebar: await readRenderedSize(s, SIDEBAR, "width"),
    inspector: await readRenderedSize(s, INSPECTOR, "width"),
    terminal: await readRenderedSize(s, TERMINAL, "height"),
    containerW: await readContainerSize(s, "width"),
  };
}

function near(actual: number, target: number, tolerance = 2): boolean {
  return Math.abs(actual - target) <= tolerance;
}

test.describe("Nested groups — full-viewport", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/test/nested");
    await waitForSettled(scope(page));
    await page.waitForTimeout(50);
  });

  // ─── initial state ─────────────────────────────────────────────────────────

  test.describe("initial state", () => {
    test("outer horizontal group sums to viewport width", async ({ page }) => {
      await expectSumInvariant(scope(page), "width");
    });

    test("dockeds resolve to their declared percentages on both axes", async ({
      page,
    }) => {
      const s = await snapshot(scope(page));
      expect(near(s.sidebar, s.containerW * 0.22, 4)).toBe(true);
      expect(near(s.inspector, s.containerW * 0.22, 4)).toBe(true);
      // Terminal height = 35% of inner group height. Inner group height ≈
      // viewport height (the peer fills the outer group). Viewport is 800.
      expect(near(s.terminal, 800 * 0.35, 6)).toBe(true);
    });
  });

  // ─── outer-group toggles ───────────────────────────────────────────────────

  test.describe("outer toggles (horizontal axis)", () => {
    test("close + reopen sidebar round-trips", async ({ page }) => {
      const s = scope(page);
      const before = await snapshot(s);
      await clickToggle(s, SIDEBAR);
      await waitForSettled(s);
      expect(await readRenderedSize(s, SIDEBAR)).toBeLessThan(1);
      await expectSumInvariant(s);

      await clickToggle(s, SIDEBAR);
      await waitForSettled(s);
      const after = await snapshot(s);
      expect(near(after.sidebar, before.sidebar, 2)).toBe(true);
      expect(near(after.inspector, before.inspector, 2)).toBe(true);
      // Terminal (inner-group axis) is unaffected by outer toggles.
      expect(near(after.terminal, before.terminal, 2)).toBe(true);
    });

    test("close + reopen inspector round-trips", async ({ page }) => {
      const s = scope(page);
      const before = await snapshot(s);
      await clickToggle(s, INSPECTOR);
      await waitForSettled(s);
      expect(await readRenderedSize(s, INSPECTOR)).toBeLessThan(1);

      await clickToggle(s, INSPECTOR);
      await waitForSettled(s);
      const after = await snapshot(s);
      expect(near(after.inspector, before.inspector, 2)).toBe(true);
      expect(near(after.sidebar, before.sidebar, 2)).toBe(true);
      expect(near(after.terminal, before.terminal, 2)).toBe(true);
    });
  });

  // ─── inner-group toggle (regression target) ────────────────────────────────

  test.describe("inner toggle (vertical axis)", () => {
    test("close + reopen terminal round-trips on the vertical axis", async ({
      page,
    }) => {
      const s = scope(page);
      const before = await snapshot(s);
      await clickToggle(s, TERMINAL);
      await waitForSettled(s);
      expect(await readRenderedSize(s, TERMINAL, "height")).toBeLessThan(1);

      await clickToggle(s, TERMINAL);
      await waitForSettled(s);
      const after = await snapshot(s);
      expect(near(after.terminal, before.terminal, 2)).toBe(true);
    });

    test("closing terminal does NOT shift sidebar or inspector (the recent bug)", async ({
      page,
    }) => {
      // This is the regression target: closing the inner vertical group's
      // docked used to flip `isResizing = true` on the outer group via a
      // cross-axis ResizeObserver fire, suppressing the close transition
      // and (more visibly) shifting outer panels around as flex reflowed.
      const s = scope(page);
      const before = await snapshot(s);
      await clickToggle(s, TERMINAL);
      await waitForSettled(s);
      const after = await snapshot(s);
      // Sidebar and inspector unchanged (within 1 px).
      expect(near(after.sidebar, before.sidebar, 1)).toBe(true);
      expect(near(after.inspector, before.inspector, 1)).toBe(true);
      // Outer group width invariant still holds.
      await expectSumInvariant(s, "width");
    });
  });

  // ─── drag (horizontal axis) ────────────────────────────────────────────────

  test.describe("outer drag", () => {
    test("drag sidebar right grows sidebar, shrinks peer", async ({ page }) => {
      const s = scope(page);
      const before = await snapshot(s);
      await dragHandle(s, { panelId: SIDEBAR, delta: 50 });
      await waitForSettled(s);
      const after = await snapshot(s);
      expect(near(after.sidebar, before.sidebar + 50, 2)).toBe(true);
      expect(near(after.inspector, before.inspector, 2)).toBe(true);
      expect(near(after.terminal, before.terminal, 2)).toBe(true);
      await expectSumInvariant(s, "width");
    });

    test("drag inspector outward grows inspector, shrinks peer", async ({
      page,
    }) => {
      const s = scope(page);
      const before = await snapshot(s);
      await dragHandle(s, { panelId: INSPECTOR, delta: 50 });
      await waitForSettled(s);
      const after = await snapshot(s);
      expect(near(after.inspector, before.inspector + 50, 2)).toBe(true);
      expect(near(after.sidebar, before.sidebar, 2)).toBe(true);
      expect(near(after.terminal, before.terminal, 2)).toBe(true);
      await expectSumInvariant(s, "width");
    });
  });

  // ─── drag (vertical axis) ──────────────────────────────────────────────────

  test.describe("inner drag", () => {
    test("the active inner divider paints above outer dividers at intersections", async ({
      page,
    }) => {
      const terminalHandle = page.getByTestId("terminal-handle");
      const inspectorHandle = page.getByTestId("inspector-handle");
      const terminalBox = await terminalHandle.boundingBox();
      const inspectorBox = await inspectorHandle.boundingBox();
      if (!terminalBox || !inspectorBox) {
        throw new Error("Expected nested resize handles");
      }

      await page.mouse.move(
        terminalBox.x + terminalBox.width / 2,
        terminalBox.y + terminalBox.height / 2,
      );
      await page.mouse.down();
      await expect(terminalHandle).toHaveAttribute("data-active", "");
      await expect(terminalHandle).toHaveCSS("z-index", "30");
      await expect(inspectorHandle).toHaveCSS("z-index", "20");

      const topHandleAtIntersection = await page.evaluate(
        ({ x, y }) =>
          document
            .elementFromPoint(x, y)
            ?.closest<HTMLElement>("[data-resizable-panels-resize-handle]")
            ?.getAttribute("data-testid"),
        {
          // Sample just inside the nested group's clipped right edge, where
          // the horizontal terminal line crosses the vertical outer seam.
          x: inspectorBox.x + inspectorBox.width / 2 - 0.25,
          y: terminalBox.y + terminalBox.height / 2,
        },
      );
      expect(topHandleAtIntersection).toBe("terminal-handle");
      await page.mouse.up();
    });

    test("drag terminal up grows terminal, shrinks editor (peer)", async ({
      page,
    }) => {
      const s = scope(page);
      const before = await snapshot(s);
      // Terminal is side="end" in the vertical group. dragHandle with
      // positive delta grows the panel — for end-side in a vertical group
      // that means cursor moves UP (negative y in screen coords). The
      // helper handles the sign for us.
      await dragHandle(s, { panelId: TERMINAL, delta: 60 });
      await waitForSettled(s);
      const after = await snapshot(s);
      expect(near(after.terminal, before.terminal + 60, 3)).toBe(true);
      // Outer group untouched.
      expect(near(after.sidebar, before.sidebar, 2)).toBe(true);
      expect(near(after.inspector, before.inspector, 2)).toBe(true);
    });

    test("drag terminal down shrinks terminal", async ({ page }) => {
      const s = scope(page);
      const before = await snapshot(s);
      await dragHandle(s, { panelId: TERMINAL, delta: -50 });
      await waitForSettled(s);
      const after = await snapshot(s);
      expect(near(after.terminal, before.terminal - 50, 3)).toBe(true);
      expect(near(after.sidebar, before.sidebar, 2)).toBe(true);
      expect(near(after.inspector, before.inspector, 2)).toBe(true);
    });
  });

  // ─── viewport resize ───────────────────────────────────────────────────────

  test.describe("viewport resize", () => {
    test("outer + inner groups both track the viewport sum invariant", async ({
      page,
    }) => {
      const s = scope(page);
      for (const [w, h] of [
        [1600, 900],
        [1024, 700],
        [800, 600],
      ] as const) {
        await setViewport(page, w, h, s);
        await page.waitForTimeout(50);
        await expectSumInvariant(s, "width");
        // Terminal's height should still be within bounds (15% min, 65% max
        // of inner group height ≈ viewport height).
        const terminal = await readRenderedSize(s, TERMINAL, "height");
        expect(terminal).toBeGreaterThanOrEqual(h * 0.15 - 2);
        expect(terminal).toBeLessThanOrEqual(h * 0.65 + 2);
      }
    });

    test("close terminal then resize viewport: no glitch", async ({ page }) => {
      const s = scope(page);
      await clickToggle(s, TERMINAL);
      // Don't wait for settle — resize mid-animation. Same pattern as the
      // outer-group race test in four-columns.spec.ts.
      await page.waitForTimeout(80);
      await page.setViewportSize({ width: 900, height: 600 });
      await waitForSettled(s);
      await expectSumInvariant(s, "width");
      expect(await readRenderedSize(s, TERMINAL, "height")).toBeLessThan(1);
    });
  });
});
