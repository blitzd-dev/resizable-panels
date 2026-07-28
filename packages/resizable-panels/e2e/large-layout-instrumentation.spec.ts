import { expect, type Page, test } from "@playwright/test";

type BrowserMetrics = {
  boundaryTraversals: number;
  childScans: number;
  handleCommits: number;
  handleComputations: number;
  mutationObservers: number;
  publications: number;
  resizeObserveCalls: number;
  resizeObservers: number;
};

async function installObserverCounters(page: Page) {
  await page.addInitScript(() => {
    const NativeResizeObserver = window.ResizeObserver;
    const NativeMutationObserver = window.MutationObserver;
    const metrics = {
      handleCommits: 0,
      mutationObservers: 0,
      resizeObserveCalls: 0,
      resizeObservers: 0,
    };

    Object.defineProperty(window, "__largeLayoutMetrics", {
      configurable: true,
      value: metrics,
    });
    Object.defineProperty(window, "__resizablePanelsHandleStateMetrics", {
      configurable: true,
      value: {
        boundaryTraversals: 0,
        childScans: 0,
        handleComputations: 0,
        publications: 0,
      },
    });

    window.ResizeObserver = class extends NativeResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        super(callback);
        metrics.resizeObservers += 1;
      }

      override observe(target: Element, options?: ResizeObserverOptions) {
        metrics.resizeObserveCalls += 1;
        super.observe(target, options);
      }
    };

    window.MutationObserver = class extends NativeMutationObserver {
      constructor(callback: MutationCallback) {
        super(callback);
        metrics.mutationObservers += 1;
      }
    };
  });
}

async function metrics(page: Page): Promise<BrowserMetrics> {
  return page.evaluate(() => ({
    boundaryTraversals:
      window.__resizablePanelsHandleStateMetrics?.boundaryTraversals ?? 0,
    childScans: window.__resizablePanelsHandleStateMetrics?.childScans ?? 0,
    handleCommits: window.__largeLayoutMetrics?.handleCommits ?? 0,
    handleComputations:
      window.__resizablePanelsHandleStateMetrics?.handleComputations ?? 0,
    mutationObservers:
      (window.__largeLayoutMetrics as BrowserMetrics | undefined)
        ?.mutationObservers ?? 0,
    resizeObserveCalls:
      (window.__largeLayoutMetrics as BrowserMetrics | undefined)
        ?.resizeObserveCalls ?? 0,
    resizeObservers:
      (window.__largeLayoutMetrics as BrowserMetrics | undefined)
        ?.resizeObservers ?? 0,
    publications: window.__resizablePanelsHandleStateMetrics?.publications ?? 0,
  }));
}

async function load(page: Page, panelCount: 50 | 100) {
  await installObserverCounters(page);
  await page.goto(`/test/large-layout-instrumentation?panels=${panelCount}`);
  await expect(page.locator("[data-resizable-panels-panel]")).toHaveCount(
    panelCount,
  );
  await expect(
    page.locator("[data-resizable-panels-resize-handle]"),
  ).toHaveCount(panelCount - 1);
  await expect
    .poll(async () => (await metrics(page)).resizeObservers)
    .toBeGreaterThanOrEqual(1);
}

test.describe("large-layout work scaling", () => {
  for (const panelCount of [50, 100] as const) {
    test(`${panelCount} panels keep observer work linear and resize commits local`, async ({
      page,
    }) => {
      await load(page, panelCount);
      const mounted = await metrics(page);
      const handles = panelCount - 1;

      // The group owns one observer set. StrictMode mounts effects twice, and
      // the group-size observer is separate, but work remains O(panels).
      expect(mounted.resizeObservers).toBeLessThanOrEqual(6);
      expect(mounted.mutationObservers).toBeLessThanOrEqual(2);
      expect(mounted.resizeObserveCalls).toBeLessThanOrEqual(
        3 * (panelCount + 1),
      );

      const handle = page.getByTestId(
        `large-handle-${Math.floor(handles / 2)}`,
      );
      const box = await handle.boundingBox();
      if (!box) throw new Error("Expected an instrumented resize handle");
      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;
      await handle.dispatchEvent("pointerdown", {
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        clientX: startX,
        clientY: startY,
      });
      await expect(handle).toHaveAttribute("data-active", "");
      const beforeMove = await metrics(page);
      await handle.dispatchEvent("pointermove", {
        pointerId: 1,
        pointerType: "mouse",
        buttons: 1,
        clientX: startX + 10,
        clientY: startY,
      });
      await expect
        .poll(async () => (await metrics(page)).handleCommits)
        .toBeGreaterThan(beforeMove.handleCommits);
      const afterMove = await metrics(page);
      await handle.dispatchEvent("pointerup", {
        pointerId: 1,
        pointerType: "mouse",
        button: 0,
        clientX: startX + 10,
        clientY: startY,
      });

      // A change at one boundary updates only nearby handle snapshots. The
      // budget is constant rather than proportional to panel count.
      expect(
        afterMove.handleCommits - beforeMove.handleCommits,
      ).toBeLessThanOrEqual(12);
      const movePublications = afterMove.publications - beforeMove.publications;
      expect(movePublications).toBeLessThanOrEqual(3);
      expect(afterMove.childScans - beforeMove.childScans).toBeLessThanOrEqual(
        3 * panelCount,
      );
      expect(
        afterMove.handleComputations - beforeMove.handleComputations,
      ).toBeLessThanOrEqual(3 * handles);
      expect(
        afterMove.boundaryTraversals - beforeMove.boundaryTraversals,
      ).toBeLessThanOrEqual(12 * panelCount);

      const beforeTopology = await metrics(page);
      await page.getByTestId("large-toggle-topology").click();
      await expect(page.locator("[data-resizable-panels-panel]")).toHaveCount(
        panelCount + 1,
      );
      await expect
        .poll(async () => (await metrics(page)).resizeObserveCalls)
        .toBeGreaterThan(beforeTopology.resizeObserveCalls);
      const afterTopology = await metrics(page);

      // A topology update observes only the added target; existing targets
      // remain registered. This operation count is independent of wall time.
      expect(
        afterTopology.resizeObserveCalls - beforeTopology.resizeObserveCalls,
      ).toBeLessThanOrEqual(4);
    });
  }
});

// R-36 render locality: a `usePanelGroupState` consumer whose snapshot does
// not change (a seam drag redistributes sizes but leaves containerSize /
// overconstrainedBy / unallocatedPx fixed) must not re-render, and a
// dispatch-only `usePanelActions` consumer must stay at zero commits — same
// Profiler + window-counter convention as the counters above. Fail-first:
// the fixture imports `usePanelGroupState`, so this route fails to load at
// baseline. This block ADDS counters; it touches no existing budget.
type LocalityCommits = { groupStateCommits: number; actionsCommits: number };

async function localityCommits(page: Page): Promise<LocalityCommits> {
  return page.evaluate(
    () =>
      window.__groupStateLocality ?? {
        groupStateCommits: 0,
        actionsCommits: 0,
      },
  );
}

const panelWidth = (page: Page, id: string) =>
  page
    .locator(`[data-resizable-panels-panel-id="${id}"]`)
    .evaluate((el) => el.getBoundingClientRect().width);

test.describe("group-state consumer render locality", () => {
  test("an unchanged snapshot re-renders neither the state consumer nor the actions consumer", async ({
    page,
  }) => {
    await page.goto("/test/group-state-render-locality");
    // Wait past mount + the measured false→true flip so the baseline is the
    // steady state, then measure commit deltas around the interaction.
    await expect
      .poll(async () =>
        Number(
          await page
            .getByTestId("locality-group-state")
            .getAttribute("data-container-size"),
        ),
      )
      .toBeGreaterThan(0);

    const handle = page.getByTestId("locality-handle");
    const box = await handle.boundingBox();
    if (!box) throw new Error("Expected the locality resize handle");
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    const widthBeforeDrag = await panelWidth(page, "a");
    const before = await localityCommits(page);
    await handle.dispatchEvent("pointerdown", {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: startX,
      clientY: startY,
    });
    await handle.dispatchEvent("pointermove", {
      pointerId: 1,
      pointerType: "mouse",
      buttons: 1,
      clientX: startX + 40,
      clientY: startY,
    });
    // The drag is real: panel "a" actually resized. The snapshot still did
    // not change (container fixed, group fits, no maximum bound hit).
    await expect
      .poll(() => panelWidth(page, "a"))
      .not.toBeCloseTo(widthBeforeDrag, 0);
    const afterMove = await localityCommits(page);
    await handle.dispatchEvent("pointerup", {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: startX + 40,
      clientY: startY,
    });

    expect(afterMove.groupStateCommits - before.groupStateCommits).toBe(0);
    // usePanelActions never subscribes, so its 0 is near-vacuous here; the
    // live-subscription proof is the positive-locality test in group-state.spec.ts (P2).
    expect(afterMove.actionsCommits - before.actionsCommits).toBe(0);

    // An idle frame after release adds no commits either.
    const afterRelease = await localityCommits(page);
    await page.waitForTimeout(150);
    const idle = await localityCommits(page);
    expect(idle.groupStateCommits - afterRelease.groupStateCommits).toBe(0);
    expect(idle.actionsCommits - afterRelease.actionsCommits).toBe(0);
  });
});
