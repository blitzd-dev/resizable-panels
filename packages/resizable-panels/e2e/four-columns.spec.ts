import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  clickToggle,
  dragHandle,
  expectSumInvariant,
  readContainerSize,
  readRenderedSize,
  setViewport,
  sweepViewport,
  waitForSettled,
} from "./helpers";

const NAV = "nav";
const LIST = "list";
const INSPECTOR = "inspector";

/** The test page fills the viewport — use the body as the scope. */
function scope(page: Page): Locator {
  return page.locator("body");
}

async function snapshot(s: Locator) {
  return {
    nav: await readRenderedSize(s, NAV),
    list: await readRenderedSize(s, LIST),
    inspector: await readRenderedSize(s, INSPECTOR),
    container: await readContainerSize(s),
  };
}

function near(actual: number, target: number, tolerance = 2): boolean {
  return Math.abs(actual - target) <= tolerance;
}

type LayoutMotionSample = {
  afterListLineVisible: boolean;
  beforeListLineVisible: boolean;
  elapsed: number;
  groupRight: number;
  groupSize: number;
  inspectorRight: number;
  listSize: number;
  panelSum: number;
};

async function sampleToggleMotion(
  page: Page,
  targetState: "collapsed" | "expanded",
): Promise<LayoutMotionSample[]> {
  const key = "__fourColumnToggleMotion";
  await page.evaluate(
    ({ key, targetState }) => {
      const group = document.querySelector(
        '[data-resizable-panels-panel-group][data-orientation="horizontal"]',
      );
      const list = document.querySelector(
        '[data-resizable-panels-panel-id="list"]',
      );
      const inspector = document.querySelector(
        '[data-resizable-panels-panel-id="inspector"]',
      );
      const beforeListHandle = document.querySelector(
        '[data-testid="nav-list-handle"]',
      );
      const afterListHandle = document.querySelector(
        '[data-testid="list-main-handle"]',
      );
      if (
        !(group instanceof HTMLElement) ||
        !(list instanceof HTMLElement) ||
        !(inspector instanceof HTMLElement) ||
        !(beforeListHandle instanceof HTMLElement) ||
        !(afterListHandle instanceof HTMLElement)
      ) {
        throw new Error("four-column motion nodes not found");
      }
      const target = window as typeof window & {
        [sampleKey: string]: {
          done: boolean;
          samples: LayoutMotionSample[];
        };
      };
      const timeline = { done: false, samples: [] as LayoutMotionSample[] };
      target[key] = timeline;
      const start = performance.now();
      let stateChanged = false;
      const sample = (time: number) => {
        const groupRect = group.getBoundingClientRect();
        const listRect = list.getBoundingClientRect();
        const inspectorRect = inspector.getBoundingClientRect();
        const panels = Array.from(
          group.querySelectorAll<HTMLElement>(
            ":scope > [data-resizable-panels-panel]",
          ),
        );
        timeline.samples.push({
          afterListLineVisible: Boolean(
            afterListHandle.querySelector(
              "[data-resizable-panels-resize-handle-line]",
            ),
          ),
          beforeListLineVisible: Boolean(
            beforeListHandle.querySelector(
              "[data-resizable-panels-resize-handle-line]",
            ),
          ),
          elapsed: time - start,
          groupRight: groupRect.right,
          groupSize: groupRect.width,
          inspectorRight: inspectorRect.right,
          listSize: listRect.width,
          panelSum: panels.reduce(
            (sum, panel) => sum + panel.getBoundingClientRect().width,
            0,
          ),
        });
        stateChanged ||= list.dataset.state === targetState;
        const running = panels.some((panel) =>
          panel
            .getAnimations({ subtree: true })
            .some((animation) => animation.playState === "running"),
        );
        if ((stateChanged && !running) || time - start > 1_000) {
          timeline.done = true;
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    },
    { key, targetState },
  );

  await clickToggle(scope(page), LIST);
  await page.waitForFunction(
    ({ key }) =>
      (
        window as typeof window & {
          [sampleKey: string]: { done: boolean };
        }
      )[key]?.done,
    { key },
  );
  return page.evaluate(
    ({ key }) =>
      (
        window as typeof window & {
          [sampleKey: string]: { samples: LayoutMotionSample[] };
        }
      )[key].samples,
    { key },
  );
}

function expectContinuouslyFilledMotion(samples: LayoutMotionSample[]) {
  expect(samples.length).toBeGreaterThan(3);
  expect(
    Math.max(...samples.map((sample) => sample.listSize)) -
      Math.min(...samples.map((sample) => sample.listSize)),
  ).toBeGreaterThan(100);
  const minimum = Math.min(...samples.map((sample) => sample.listSize));
  const maximum = Math.max(...samples.map((sample) => sample.listSize));
  expect(
    samples.some(
      (sample) =>
        sample.listSize > minimum + 5 && sample.listSize < maximum - 5,
    ),
  ).toBe(true);
  for (const sample of samples) {
    expect(
      Math.abs(sample.panelSum - sample.groupSize),
      `panels stopped filling the group at ${sample.elapsed.toFixed(1)}ms`,
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(sample.inspectorRight - sample.groupRight),
      `end panel left the group edge at ${sample.elapsed.toFixed(1)}ms`,
    ).toBeLessThanOrEqual(1);
  }
}

test.describe("Four columns — full-viewport layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/test/four-columns");
    await waitForSettled(scope(page));
    await page.waitForTimeout(50);
  });

  // ─── initial layout ────────────────────────────────────────────────────────

  test.describe("initial state", () => {
    test("sums to container width", async ({ page }) => {
      await expectSumInvariant(scope(page));
    });

    test("panels resolve to their percentage defaults", async ({ page }) => {
      const s = await snapshot(scope(page));
      // 18 / 22 / 22 / 38% (peer). Container should be ~1280.
      expect(near(s.container, 1280, 4)).toBe(true);
      expect(near(s.nav, s.container * 0.18, 4)).toBe(true);
      expect(near(s.list, s.container * 0.22, 4)).toBe(true);
      expect(near(s.inspector, s.container * 0.22, 4)).toBe(true);
    });

    test("docked panels use the smooth default easing", async ({ page }) => {
      const panel = page.locator('[data-resizable-panels-panel-id="list"]');
      await expect(panel).toHaveCSS(
        "transition-timing-function",
        "cubic-bezier(0.4, 0, 0.2, 1)",
      );
      await expect(
        panel.locator("[data-resizable-panels-panel-content]"),
      ).toHaveCSS("transition-timing-function", "cubic-bezier(0.4, 0, 0.2, 1)");
    });
  });

  // ─── toggles ───────────────────────────────────────────────────────────────

  test.describe("open / close", () => {
    test("collapse and expand keep every animation frame filled", async ({
      page,
    }) => {
      const collapseSamples = await sampleToggleMotion(page, "collapsed");
      expectContinuouslyFilledMotion(collapseSamples);
      for (const sample of collapseSamples) {
        if (sample.listSize <= 5) continue;
        expect(
          sample.beforeListLineVisible && sample.afterListLineVisible,
          `a list divider disappeared at ${sample.elapsed.toFixed(1)}ms`,
        ).toBe(true);
      }

      const expandSamples = await sampleToggleMotion(page, "expanded");
      expectContinuouslyFilledMotion(expandSamples);
    });

    test("a collapsed middle panel preserves one usable divider between its visible neighbors", async ({
      page,
    }) => {
      const s = scope(page);
      const beforeListHandle = page.getByTestId("nav-list-handle");
      const afterListHandle = page.getByTestId("list-main-handle");
      const lineSelector = "[data-resizable-panels-resize-handle-line]";

      expect(await beforeListHandle.locator(lineSelector).count()).toBe(1);
      expect(await afterListHandle.locator(lineSelector).count()).toBe(1);
      await clickToggle(s, LIST);
      await waitForSettled(s);
      expect(await readRenderedSize(s, LIST)).toBeLessThan(1);
      await expect(beforeListHandle).not.toHaveAttribute(
        "aria-disabled",
        "true",
      );
      await expect(beforeListHandle).toHaveAttribute("tabindex", "0");
      await expect(beforeListHandle).toHaveAttribute(
        "data-before-panel",
        "nav",
      );
      await expect(beforeListHandle).toHaveAttribute(
        "data-after-panel",
        "main",
      );
      await expect(afterListHandle).toHaveAttribute("aria-disabled", "true");
      await expect(afterListHandle).toHaveAttribute("tabindex", "-1");
      // The handle before the collapsed run owns both interaction and the
      // visible divider, so nav keeps a stable right edge. The redundant
      // coincident line is removed instead of stacking into a brighter seam.
      expect(await beforeListHandle.locator(lineSelector).count()).toBe(1);
      expect(await afterListHandle.locator(lineSelector).count()).toBe(0);

      const before = await snapshot(s);
      await dragHandle(s, { panelId: NAV, delta: 40, quick: true });
      await waitForSettled(s);
      const after = await snapshot(s);
      expect(after.nav).toBeGreaterThan(before.nav + 30);
      expect(after.list).toBeLessThan(1);
      expect(near(after.inspector, before.inspector, 2)).toBe(true);
      await expectSumInvariant(s);
    });

    test("close + reopen nav round-trips", async ({ page }) => {
      const s = scope(page);
      const before = await snapshot(s);

      await clickToggle(s, NAV);
      await waitForSettled(s);
      expect(await readRenderedSize(s, NAV)).toBeLessThan(1);
      await expectSumInvariant(s);

      await clickToggle(s, NAV);
      await waitForSettled(s);
      const after = await snapshot(s);
      expect(near(after.nav, before.nav, 2)).toBe(true);
      expect(near(after.list, before.list, 2)).toBe(true);
      expect(near(after.inspector, before.inspector, 2)).toBe(true);
    });

    test("close + reopen each docked sequentially", async ({ page }) => {
      const s = scope(page);
      const initial = await snapshot(s);
      for (const id of [NAV, LIST, INSPECTOR]) {
        await clickToggle(s, id);
        await waitForSettled(s);
        expect(await readRenderedSize(s, id)).toBeLessThan(1);
        await expectSumInvariant(s);
        await clickToggle(s, id);
        await waitForSettled(s);
      }
      const final = await snapshot(s);
      expect(near(final.nav, initial.nav, 2)).toBe(true);
      expect(near(final.list, initial.list, 2)).toBe(true);
      expect(near(final.inspector, initial.inspector, 2)).toBe(true);
    });
  });

  // ─── drag interactions ─────────────────────────────────────────────────────

  test.describe("drag — normal regime", () => {
    test("drag list right: list grows, peer absorbs, others untouched", async ({
      page,
    }) => {
      const s = scope(page);
      const before = await snapshot(s);
      await dragHandle(s, { panelId: LIST, delta: 50 });
      await waitForSettled(s);
      const after = await snapshot(s);

      expect(near(after.list, before.list + 50, 2)).toBe(true);
      expect(near(after.nav, before.nav, 2)).toBe(true);
      expect(near(after.inspector, before.inspector, 2)).toBe(true);
      await expectSumInvariant(s);
    });

    test("drag list left: list shrinks, peer grows, others untouched", async ({
      page,
    }) => {
      const s = scope(page);
      const before = await snapshot(s);
      await dragHandle(s, { panelId: LIST, delta: -50 });
      await waitForSettled(s);
      const after = await snapshot(s);

      expect(near(after.list, before.list - 50, 2)).toBe(true);
      expect(near(after.nav, before.nav, 2)).toBe(true);
      expect(near(after.inspector, before.inspector, 2)).toBe(true);
      await expectSumInvariant(s);
    });

    test("drag inspector outward: inspector grows, others stable", async ({
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
      await expectSumInvariant(s);
    });

    test("release does not start a trailing docked-panel transition", async ({
      page,
    }) => {
      const s = scope(page);
      await dragHandle(s, { panelId: LIST, delta: 50, quick: true });

      const runningAnimations = await page.evaluate(() => {
        const panels = document.querySelectorAll(
          "[data-resizable-panels-panel][data-kind='docked'], [data-resizable-panels-panel-content]",
        );
        let running = 0;
        for (const el of panels) {
          for (const anim of el.getAnimations()) {
            if (anim.playState === "running") running++;
          }
        }
        return running;
      });

      expect(runningAnimations).toBe(0);
      await waitForSettled(s);
      await expectSumInvariant(s);
    });
  });

  // ─── cascade ───────────────────────────────────────────────────────────────

  test.describe("cascade", () => {
    test("drag list left past its min cascades into nav", async ({ page }) => {
      const s = scope(page);
      const before = await snapshot(s);
      await dragHandle(s, { panelId: LIST, delta: -400 });
      await waitForSettled(s);
      const after = await snapshot(s);

      expect(near(after.list, after.container * 0.15, 4)).toBe(true);
      expect(after.nav).toBeLessThan(before.nav - 5);
      expect(near(after.inspector, before.inspector, 2)).toBe(true);
      await expectSumInvariant(s);
    });

    test("over-constraint: max nav+list+inspector, drag list right shrinks inspector only", async ({
      page,
    }) => {
      const s = scope(page);
      for (const id of [NAV, LIST, INSPECTOR]) {
        // Setup drags use `quick` — fast and unstyled. We're just getting
        // the layout into the over-constrained state; the real drag we
        // care about (and watch) is the one below.
        await dragHandle(s, { panelId: id, delta: 600, quick: true });
        await waitForSettled(s);
      }
      const before = await snapshot(s);
      await dragHandle(s, { panelId: LIST, delta: 50 });
      await waitForSettled(s);
      const after = await snapshot(s);

      expect(after.list).toBeGreaterThan(before.list);
      expect(after.inspector).toBeLessThan(before.inspector);
      expect(near(after.nav, before.nav, 2)).toBe(true);
      await expectSumInvariant(s);
    });

    test("over-constraint inward: max nav+list, drag inspector outward shrinks list only", async ({
      page,
    }) => {
      const s = scope(page);
      await dragHandle(s, { panelId: NAV, delta: 600, quick: true });
      await waitForSettled(s);
      await dragHandle(s, { panelId: LIST, delta: 600, quick: true });
      await waitForSettled(s);

      const before = await snapshot(s);
      await dragHandle(s, { panelId: INSPECTOR, delta: 50 });
      await waitForSettled(s);
      const after = await snapshot(s);

      expect(after.inspector).toBeGreaterThan(before.inspector);
      expect(after.list).toBeLessThan(before.list);
      expect(near(after.nav, before.nav, 2)).toBe(true);
      await expectSumInvariant(s);
    });
  });

  // ─── viewport resize ───────────────────────────────────────────────────────

  test.describe("viewport resize", () => {
    test("untouched percentage dockeds track the viewport; a dragged docked keeps its px", async ({
      page,
    }) => {
      // String defaults are live until interaction (R-05): a percentage
      // `defaultSize` keeps resolving against the live container — viewport
      // resizes proportionally rescale untouched dockeds, like CSS. A
      // pointer drag commits a pixel preference; from then on THAT panel is
      // sticky in px across viewport changes (preserving "user dragged to
      // exact size" intent) while untouched siblings keep tracking.
      const s = scope(page);
      const initial = await snapshot(s);
      expect(near(initial.nav, initial.container * 0.18, 2)).toBe(true);

      await setViewport(page, 1600, 800, s);
      await page.waitForTimeout(50);
      const grown = await snapshot(s);
      expect(near(grown.container, 1600, 4)).toBe(true);
      // Untouched dockeds rescaled with the container.
      expect(near(grown.nav, grown.container * 0.18, 2)).toBe(true);
      expect(near(grown.list, grown.container * 0.22, 2)).toBe(true);
      expect(near(grown.inspector, grown.container * 0.22, 2)).toBe(true);
      await expectSumInvariant(s);

      // A deliberate drag commits pixel preferences for the panels it
      // resized: nav directly, and list through the cascade on the shared
      // boundary. The inspector was not part of the session and stays live.
      await dragHandle(s, { panelId: NAV, delta: 40, quick: true });
      await waitForSettled(s);
      const dragged = await snapshot(s);
      expect(near(dragged.nav, grown.nav + 40, 2)).toBe(true);
      expect(near(dragged.list, grown.list - 40, 2)).toBe(true);

      await setViewport(page, 1200, 800, s);
      await page.waitForTimeout(50);
      const shrunk = await snapshot(s);
      expect(near(shrunk.container, 1200, 4)).toBe(true);
      // The session-committed dockeds keep their px (their percentage maxes
      // at 1200 are still above them); the untouched inspector keeps
      // tracking its percentage.
      expect(near(shrunk.nav, dragged.nav, 2)).toBe(true);
      expect(near(shrunk.list, dragged.list, 2)).toBe(true);
      expect(near(shrunk.inspector, shrunk.container * 0.22, 2)).toBe(true);
      await expectSumInvariant(s);

      // Shrink far past the committed anchor — percentage bounds stay live,
      // so the committed docked clamps to its recomputed maxSize ceiling.
      await setViewport(page, 700, 800, s);
      await page.waitForTimeout(50);
      const tight = await snapshot(s);
      expect(near(tight.container, 700, 4)).toBe(true);
      expect(tight.nav).toBeLessThanOrEqual(tight.container * 0.3 + 2);
      expect(tight.list).toBeLessThanOrEqual(tight.container * 0.35 + 2);
      expect(tight.inspector).toBeLessThanOrEqual(tight.container * 0.35 + 2);
      await expectSumInvariant(s);
    });

    test("smooth sweep from wide to narrow keeps sum invariant at every step", async ({
      page,
    }) => {
      const s = scope(page);
      // Hold-out check: at every intermediate viewport, the sum of rendered
      // panels equals the container. This catches "panel clips off-screen"
      // bugs that would only show during a window-drag.
      const containers = await sweepViewport(page, s, {
        fromWidth: 1600,
        toWidth: 700,
        height: 800,
        steps: 10,
        delayMs: 50,
      });
      // Sanity: containers monotonically decrease.
      for (let i = 1; i < containers.length; i++) {
        expect(containers[i]).toBeLessThanOrEqual(containers[i - 1] + 1);
      }
      // Final state still invariant.
      await expectSumInvariant(s);
    });

    test("very narrow viewport: peer pins at min, dockeds shrink to fit", async ({
      page,
    }) => {
      const s = scope(page);
      // At 600 px wide: sum of preferred dockeds = 62% * 600 = 372. Peer min
      // 20% = 120. 372 + 120 = 492 < 600, so still NOT over-constrained.
      // At 400 px: preferred dockeds = 248. Peer min = 80. Sum = 328 < 400,
      // also not over-constrained. The min-axis CSS of the body might add
      // some chrome — pick a width that forces over-constraint via dockeds
      // alone.
      // We need preferred sum + peer.min > container. For preferred=62% +
      // peer.min=20% = 82%, that's never over-constrained at default sizes
      // — we need to first max the dockeds.
      for (const id of [NAV, LIST, INSPECTOR]) {
        await dragHandle(s, { panelId: id, delta: 600, quick: true });
        await waitForSettled(s);
      }
      // Now dockeds at max (30/35/35 = 100% sum). Plus peer min 20% = 120%.
      // Definitely over-constrained.
      await setViewport(page, 1000, 800, s);
      await page.waitForTimeout(50);
      const snap = await snapshot(s);
      // Peer should be at its min (or close).
      const peerMin = snap.container * 0.2;
      const peerActual = snap.container - snap.nav - snap.list - snap.inspector;
      expect(near(peerActual, peerMin, 4)).toBe(true);
      await expectSumInvariant(s);
    });

    test("viewport shrink while a panel is mid-close does not glitch", async ({
      page,
    }) => {
      const s = scope(page);
      // Kick off a close animation, then resize the viewport before it
      // completes. Sum invariant must hold throughout.
      await clickToggle(s, NAV);
      // Don't wait for settle — resize mid-animation.
      await page.waitForTimeout(100);
      await page.setViewportSize({ width: 900, height: 800 });
      await waitForSettled(s);
      await expectSumInvariant(s);
      // Nav stayed closed.
      expect(await readRenderedSize(s, NAV)).toBeLessThan(1);
    });
  });

  // ─── races ─────────────────────────────────────────────────────────────────

  test.describe("interaction races", () => {
    test("rapid close → reopen → drag", async ({ page }) => {
      const s = scope(page);
      await clickToggle(s, INSPECTOR);
      await waitForSettled(s);
      await clickToggle(s, INSPECTOR);
      await waitForSettled(s);

      const before = await snapshot(s);
      await dragHandle(s, { panelId: INSPECTOR, delta: 25 });
      await waitForSettled(s);
      const after = await snapshot(s);

      expect(near(after.inspector, before.inspector + 25, 3)).toBe(true);
      await expectSumInvariant(s);
    });

    test("drag two different handles in sequence without settling", async ({
      page,
    }) => {
      const s = scope(page);
      const before = await snapshot(s);
      // Two consecutive drags — settled between each.
      await dragHandle(s, { panelId: LIST, delta: 30 });
      await dragHandle(s, { panelId: INSPECTOR, delta: 30 });
      await waitForSettled(s);
      const after = await snapshot(s);

      expect(near(after.list, before.list + 30, 3)).toBe(true);
      expect(near(after.inspector, before.inspector + 30, 3)).toBe(true);
      await expectSumInvariant(s);
    });
  });
});
