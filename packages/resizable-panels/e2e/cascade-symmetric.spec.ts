import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  dragHandle,
  expectSumInvariant,
  readContainerSize,
  readRenderedSize,
  waitForSettled,
} from "./helpers";

const NAV = "nav";
const LIST = "list";
const INSPECTOR = "inspector";
const SETTINGS = "settings";

function scope(page: Page): Locator {
  return page.locator("body");
}

async function snapshot(s: Locator) {
  return {
    nav: await readRenderedSize(s, NAV),
    list: await readRenderedSize(s, LIST),
    inspector: await readRenderedSize(s, INSPECTOR),
    settings: await readRenderedSize(s, SETTINGS),
    container: await readContainerSize(s),
  };
}

function near(actual: number, target: number, tolerance = 2): boolean {
  return Math.abs(actual - target) <= tolerance;
}

test.describe("Cascade — symmetric, two dockeds each side", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/test/cascade-symmetric");
    await waitForSettled(scope(page));
    await page.waitForTimeout(50);
  });

  // ─── initial state ─────────────────────────────────────────────────────────

  test("initial layout sums to container width", async ({ page }) => {
    await expectSumInvariant(scope(page));
  });

  test("dockeds resolve to declared percentages", async ({ page }) => {
    const s = await snapshot(scope(page));
    expect(near(s.nav, s.container * 0.16, 4)).toBe(true);
    expect(near(s.list, s.container * 0.2, 4)).toBe(true);
    expect(near(s.inspector, s.container * 0.2, 4)).toBe(true);
    expect(near(s.settings, s.container * 0.16, 4)).toBe(true);
  });

  // ─── normal drag (peer absorbs, no cascade) ────────────────────────────────

  test.describe("drag — peer absorbs", () => {
    test("drag list right: only list and peer change", async ({ page }) => {
      const s = scope(page);
      const before = await snapshot(s);
      await dragHandle(s, { panelId: LIST, delta: 50 });
      await waitForSettled(s);
      const after = await snapshot(s);

      expect(near(after.list, before.list + 50, 2)).toBe(true);
      expect(near(after.nav, before.nav, 2)).toBe(true);
      expect(near(after.inspector, before.inspector, 2)).toBe(true);
      expect(near(after.settings, before.settings, 2)).toBe(true);
      await expectSumInvariant(s);
    });

    test("drag inspector outward: only inspector and peer change", async ({
      page,
    }) => {
      const s = scope(page);
      const before = await snapshot(s);
      await dragHandle(s, { panelId: INSPECTOR, delta: 50 });
      await waitForSettled(s);
      const after = await snapshot(s);

      expect(near(after.inspector, before.inspector + 50, 2)).toBe(true);
      expect(near(after.nav, before.nav, 2)).toBe(true);
      expect(near(after.list, before.list, 2)).toBe(true);
      expect(near(after.settings, before.settings, 2)).toBe(true);
      await expectSumInvariant(s);
    });

    test("drag nav/list boundary right: nav grows and list shrinks", async ({
      page,
    }) => {
      const s = scope(page);
      const before = await snapshot(s);
      await dragHandle(s, { panelId: NAV, delta: 50 });
      await waitForSettled(s);
      const after = await snapshot(s);

      expect(near(after.nav, before.nav + 50, 2)).toBe(true);
      expect(near(after.list, before.list - 50, 2)).toBe(true);
      expect(near(after.inspector, before.inspector, 2)).toBe(true);
      expect(near(after.settings, before.settings, 2)).toBe(true);
    });

    test("drag inspector/settings boundary outward: settings grows and inspector shrinks", async ({
      page,
    }) => {
      const s = scope(page);
      const before = await snapshot(s);
      await dragHandle(s, { panelId: SETTINGS, delta: 50 });
      await waitForSettled(s);
      const after = await snapshot(s);

      expect(near(after.settings, before.settings + 50, 2)).toBe(true);
      expect(near(after.nav, before.nav, 2)).toBe(true);
      expect(near(after.list, before.list, 2)).toBe(true);
      expect(near(after.inspector, before.inspector - 50, 2)).toBe(true);
    });
  });

  // ─── inward cascade (drag past self's own min) ─────────────────────────────

  test.describe("inward cascade — past self's min", () => {
    test("drag list left past list.min cascades into nav", async ({ page }) => {
      const s = scope(page);
      const before = await snapshot(s);
      await dragHandle(s, { panelId: LIST, delta: -400 });
      await waitForSettled(s);
      const after = await snapshot(s);

      // list pinned at min (12%).
      expect(near(after.list, after.container * 0.12, 4)).toBe(true);
      // nav shrunk too (leftward chain for start-side inward).
      expect(after.nav).toBeLessThan(before.nav - 5);
      // inspector and settings untouched (chain runs LEFTWARD).
      expect(near(after.inspector, before.inspector, 2)).toBe(true);
      expect(near(after.settings, before.settings, 2)).toBe(true);
      await expectSumInvariant(s);
    });

    test("drag inspector right past inspector.min cascades into settings", async ({
      page,
    }) => {
      const s = scope(page);
      const before = await snapshot(s);
      // Inspector is side="end". Negative delta = inspector shrinks
      // (drag the handle right = toward end edge = grow seam → shrink
      // inspector). For dragHandle, positive delta = grow self; negative
      // = shrink self.
      await dragHandle(s, { panelId: INSPECTOR, delta: -400 });
      await waitForSettled(s);
      const after = await snapshot(s);

      // inspector pinned at min (12%).
      expect(near(after.inspector, after.container * 0.12, 4)).toBe(true);
      // settings shrunk (rightward chain for end-side inward).
      expect(after.settings).toBeLessThan(before.settings - 5);
      // nav and list untouched.
      expect(near(after.nav, before.nav, 2)).toBe(true);
      expect(near(after.list, before.list, 2)).toBe(true);
      await expectSumInvariant(s);
    });
  });

  // ─── outward cascade (over-constraint, peer at min) ────────────────────────

  test.describe("outward cascade — peer at min", () => {
    test("max nav+list+inspector+settings, drag list right: cascade rightward through inspector (then settings)", async ({
      page,
    }) => {
      const s = scope(page);
      // Max all four dockeds. Peer pins at its 12% min. Any further
      // outward drag has to cascade through the chain.
      for (const id of [NAV, LIST, INSPECTOR, SETTINGS]) {
        await dragHandle(s, { panelId: id, delta: 800, quick: true });
        await waitForSettled(s);
      }
      const before = await snapshot(s);
      await dragHandle(s, { panelId: LIST, delta: 30 });
      await waitForSettled(s);
      const after = await snapshot(s);

      // List grew.
      expect(after.list).toBeGreaterThan(before.list);
      // Inspector shrunk first (rightward chain for start-side outward).
      expect(after.inspector).toBeLessThan(before.inspector);
      // Nav unchanged — outward chain runs the opposite direction.
      expect(near(after.nav, before.nav, 2)).toBe(true);
      await expectSumInvariant(s);
    });

    test("max nav+list, drag inspector outward: cascade leftward through list", async ({
      page,
    }) => {
      const s = scope(page);
      // Max only nav and list (the panels on inspector's outward side) so
      // list retains shrink capacity. Maxing inspector + settings too
      // would push list to its own min during inspector's drag cascade
      // and leave no capacity in the chain to absorb the test drag.
      await dragHandle(s, { panelId: NAV, delta: 800, quick: true });
      await waitForSettled(s);
      await dragHandle(s, { panelId: LIST, delta: 800, quick: true });
      await waitForSettled(s);

      const before = await snapshot(s);
      await dragHandle(s, { panelId: INSPECTOR, delta: 30 });
      await waitForSettled(s);
      const after = await snapshot(s);

      // Inspector grew.
      expect(after.inspector).toBeGreaterThan(before.inspector);
      // List shrunk (leftward chain for end-side outward — list is the
      // first docked the chain reaches that has capacity).
      expect(after.list).toBeLessThan(before.list);
      // Settings unchanged — chain runs LEFT from inspector, not right.
      expect(near(after.settings, before.settings, 2)).toBe(true);
      await expectSumInvariant(s);
    });
  });
});
