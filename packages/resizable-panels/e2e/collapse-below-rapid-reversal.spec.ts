import { expect, type Locator, type Page, test } from "@playwright/test";
import { readRenderedSize } from "./helpers";

type CollapsedRail = {
  panel: Locator;
  scope: Locator;
  x: number;
  y: number;
};

async function startWithCollapsedRail(page: Page): Promise<CollapsedRail> {
  await page.goto("/test/collapse-below?rail");

  const scope = page.locator("body");
  const panel = scope.locator('[data-resizable-panels-panel-id="nav"]');
  const handle = page.getByTestId("collapse-below-handle");
  const expandedBox = await handle.boundingBox();
  if (!expandedBox) throw new Error("collapseBelow handle not found");
  const expandedX = expandedBox.x + expandedBox.width / 2;
  const expandedY = expandedBox.y + expandedBox.height / 2;

  await page.mouse.move(expandedX, expandedY);
  await page.mouse.down();
  await page.mouse.move(expandedX - 175, expandedY);
  await expect(panel).toHaveAttribute("data-state", "collapsed");
  await page.mouse.up();
  await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(48, 0);

  const collapsedBox = await handle.boundingBox();
  if (!collapsedBox) throw new Error("collapsed rail handle not found");
  return {
    panel,
    scope,
    x: collapsedBox.x + collapsedBox.width / 2,
    y: collapsedBox.y + collapsedBox.height / 2,
  };
}

test.describe("collapseBelow rapid reversals", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("an inward reversal interrupts an in-flight drag-open animation", async ({
    page,
  }) => {
    const { panel, scope, x, y } = await startWithCollapsedRail(page);

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 120, y);
    await expect(panel).toHaveAttribute("data-state", "expanded");

    // Reverse immediately, before the 300ms opening tween can finish. The
    // inward move is the complete input: no timeout or follow-up pointermove
    // should be required for the panel state to catch up with the cursor.
    await page.mouse.move(x, y);
    await expect(panel).toHaveAttribute("data-state", "collapsed", {
      timeout: 1_000,
    });
    await page.mouse.up();

    await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(48, 0);
    await expect(scope.getByText(/48px · collapsed$/)).toBeVisible();
  });

  test("a rapid close-reopen consumes the latest target and lands at the cursor", async ({
    page,
  }) => {
    const { panel, scope, x, y } = await startWithCollapsedRail(page);

    await page.mouse.move(x, y);
    await page.mouse.down();

    await page.mouse.move(x + 120, y);
    await expect(panel).toHaveAttribute("data-state", "expanded");

    // Interrupt the first open and immediately reverse again. This exercises
    // two opening commands in one pointer-capture session; a stale animation
    // must not win after the cursor has moved to its newer destination.
    await page.mouse.move(x, y);
    await expect(panel).toHaveAttribute("data-state", "collapsed", {
      timeout: 1_000,
    });
    await page.mouse.move(x + 140, y);
    await expect(panel).toHaveAttribute("data-state", "expanded", {
      timeout: 1_000,
    });
    await page.mouse.up();

    // The collapsed rail starts at 48px, so a +140px final pointer delta
    // should settle at exactly 188px without another pointer event.
    await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(188, 0);
    await expect(scope.getByText(/188px · expanded$/)).toBeVisible();
  });

  test("pointer travel stays direct while the opening motion is in flight", async ({
    page,
  }) => {
    const { panel, scope, x, y } = await startWithCollapsedRail(page);

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 120, y);
    await expect(panel).toHaveAttribute("data-state", "expanded");

    // Sample early enough that the rail is still visually travelling from
    // 48px toward its first 168px destination.
    await page.waitForTimeout(40);
    const openingWidth = await readRenderedSize(scope, "nav");
    expect(openingWidth).toBeGreaterThan(48);
    expect(openingWidth).toBeLessThan(160);

    // Capture geometry at the exact React commit which consumes the next
    // pointer target. Waiting for the eventual 208px destination would let a
    // spring-lagged implementation pass even though the seam initially falls
    // farther behind the cursor.
    const measurementKey = "__collapseBelowDirectPointerMeasurement";
    await page.evaluate(
      ({ key }) => {
        const panelNode = document.querySelector(
          '[data-resizable-panels-panel-id="nav"]',
        );
        const readout = document.querySelector(".readout");
        if (!(panelNode instanceof HTMLElement) || !readout) {
          throw new Error("collapseBelow measurement nodes not found");
        }
        const target = window as typeof window & {
          [measurementKey: string]: {
            after: number | null;
            before: number | null;
          };
        };
        const measurement = {
          after: null as number | null,
          before: null as number | null,
        };
        target[key] = measurement;
        const capturePointerGeometry = () => {
          measurement.before = panelNode.getBoundingClientRect().width;
          document.removeEventListener(
            "pointermove",
            capturePointerGeometry,
            true,
          );
        };
        document.addEventListener("pointermove", capturePointerGeometry, true);
        const observer = new MutationObserver(() => {
          if (!readout.textContent?.includes("208px")) return;
          measurement.after = panelNode.getBoundingClientRect().width;
          observer.disconnect();
        });
        observer.observe(readout, {
          characterData: true,
          childList: true,
          subtree: true,
        });
      },
      { key: measurementKey },
    );

    const pointerStep = 40;
    await page.mouse.move(x + 120 + pointerStep, y);
    await expect
      .poll(() =>
        page.evaluate(
          ({ key }) =>
            (
              window as typeof window & {
                [measurementKey: string]: {
                  after: number | null;
                  before: number | null;
                };
              }
            )[key].after,
          { key: measurementKey },
        ),
      )
      .not.toBeNull();
    const measurement = await page.evaluate(
      ({ key }) =>
        (
          window as typeof window & {
            [measurementKey: string]: {
              after: number | null;
              before: number | null;
            };
          }
        )[key],
      { key: measurementKey },
    );

    // The opening motion may advance between the two samples, but another
    // 40px of cursor travel must never add visual lag. Its seam therefore
    // moves by at least the same 40px immediately.
    expect(measurement.after).not.toBeNull();
    expect(measurement.before).not.toBeNull();
    expect(
      (measurement.after ?? 0) - (measurement.before ?? 0),
    ).toBeGreaterThanOrEqual(pointerStep - 2);

    await page.mouse.up();
    await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(208, 0);
    await expect(scope.getByText(/208px · expanded$/)).toBeVisible();
  });

  test("re-grabbing a closing rail reopens from its current rendered width", async ({
    page,
  }) => {
    await page.goto("/test/collapse-below?rail");

    const scope = page.locator("body");
    const panel = scope.locator('[data-resizable-panels-panel-id="nav"]');
    const handle = page.getByTestId("collapse-below-handle");
    // Keep the automated pointer over the moving seam even when this test is
    // sharing a busy CI worker. This changes only the absolute hit target, not
    // the handle slot or any panel geometry used by the resize session.
    await handle.evaluate((node) => {
      node.style.left = "-120px";
      node.style.width = "240px";
    });
    const expandedBox = await handle.boundingBox();
    if (!expandedBox) throw new Error("collapseBelow handle not found");
    const expandedX = expandedBox.x + expandedBox.width / 2;
    const expandedY = expandedBox.y + expandedBox.height / 2;

    await page.mouse.move(expandedX, expandedY);
    await page.mouse.down();
    await page.mouse.move(expandedX - 100, expandedY);
    await expect(panel).toHaveAttribute("data-state", "expanded");
    await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(140, 0);
    await page.mouse.move(expandedX - 175, expandedY);
    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await page.mouse.up();

    // Re-grab immediately while the 140px -> 48px closing transition is
    // visibly in flight. Pointer-down snapshots this presentation width as
    // the new drag's physical starting point.
    const closingBox = await handle.boundingBox();
    if (!closingBox) throw new Error("closing rail handle not found");
    const closingX = closingBox.x + closingBox.width / 2;
    const closingY = closingBox.y + closingBox.height / 2;
    await page.mouse.move(closingX, closingY);
    await page.mouse.down();
    const widthAtRegrab = await readRenderedSize(scope, "nav");
    expect(widthAtRegrab).toBeGreaterThan(72);

    const samplesKey = "__collapseBelowRegrabSamples";
    await page.evaluate(
      ({ key }) => {
        const node = document.querySelector(
          '[data-resizable-panels-panel-id="nav"]',
        );
        if (!(node instanceof HTMLElement)) {
          throw new Error("nav panel not found");
        }
        const target = window as typeof window & {
          [samplesKey: string]: Array<{
            state: string | undefined;
            width: number;
          }>;
        };
        const samples: Array<{
          state: string | undefined;
          width: number;
        }> = [];
        target[key] = samples;
        let remaining = 12;
        const sample = () => {
          samples.push({
            state: node.dataset.state,
            width: node.getBoundingClientRect().width,
          });
          remaining -= 1;
          if (remaining > 0) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      },
      { key: samplesKey },
    );

    // Cross minSize from the presentation width captured by the new session.
    const outwardDelta = Math.max(24, 140 - widthAtRegrab + 24);
    const widthBeforeReopen = await readRenderedSize(scope, "nav");
    await page.mouse.move(closingX + outwardDelta, closingY);
    await expect(panel).toHaveAttribute("data-state", "expanded");
    await page.waitForTimeout(50);
    const samples = await page.evaluate(
      ({ key }) =>
        (
          window as typeof window & {
            [samplesKey: string]: Array<{
              state: string | undefined;
              width: number;
            }>;
          }
        )[key],
      { key: samplesKey },
    );
    await page.mouse.up();

    const firstExpanded = samples.find((sample) => sample.state === "expanded");
    expect(
      firstExpanded,
      "no expanded animation frame was sampled",
    ).toBeDefined();
    // The second opening must reverse from the in-flight presentation. A
    // collapsedSize-based restart would produce a first frame near 48px.
    expect(firstExpanded?.width ?? 0).toBeGreaterThanOrEqual(
      widthBeforeReopen - 12,
    );
  });

  test("an inward retarget never renders below the collapsed rail", async ({
    page,
  }) => {
    const { panel, scope, x, y } = await startWithCollapsedRail(page);
    const samplesKey = "__collapseBelowInwardRetargetSamples";
    await page.evaluate(
      ({ key }) => {
        const node = document.querySelector(
          '[data-resizable-panels-panel-id="nav"]',
        );
        if (!(node instanceof HTMLElement))
          throw new Error("nav panel not found");
        const target = window as typeof window & {
          [samplesKey: string]: Array<{
            state: string | undefined;
            width: number;
          }>;
        };
        const samples: Array<{ state: string | undefined; width: number }> = [];
        target[key] = samples;
        let remaining = 36;
        const sample = () => {
          samples.push({
            state: node.dataset.state,
            width: node.getBoundingClientRect().width,
          });
          remaining -= 1;
          if (remaining > 0) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      },
      { key: samplesKey },
    );

    await page.mouse.move(x, y);
    await page.mouse.down();
    // Start toward maxSize, then retarget to minSize while the opening spring
    // still carries substantial outward velocity. The old base+offset math
    // produced positive widths below the 48px rail during this reversal.
    await page.mouse.move(x + 300, y);
    await expect(panel).toHaveAttribute("data-state", "expanded");
    await page.waitForTimeout(40);
    await page.mouse.move(x + 92, y);
    await page.mouse.up();

    await expect
      .poll(() =>
        page.evaluate(
          ({ key }) =>
            (
              window as typeof window & {
                [samplesKey: string]: Array<{
                  state: string | undefined;
                  width: number;
                }>;
              }
            )[key].length,
          { key: samplesKey },
        ),
      )
      .toBe(36);
    const samples = await page.evaluate(
      ({ key }) =>
        (
          window as typeof window & {
            [samplesKey: string]: Array<{
              state: string | undefined;
              width: number;
            }>;
          }
        )[key],
      { key: samplesKey },
    );
    const expandedWidths = samples
      .filter((sample) => sample.state === "expanded")
      .map((sample) => sample.width);
    expect(expandedWidths.length).toBeGreaterThan(5);
    expect(Math.min(...expandedWidths)).toBeGreaterThanOrEqual(47.5);
    await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(140, 0);
  });

  test("pointer-up preserves the live hysteresis decision", async ({
    page,
  }) => {
    const { panel, scope, x, y } = await startWithCollapsedRail(page);

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 92, y);
    await expect(panel).toHaveAttribute("data-state", "expanded");

    // Raw size is now 56px: below collapseBelow=60, but still above this
    // collapsed-start session's 48px reverse boundary. Releasing must not
    // apply a second, non-hysteretic collapse decision.
    await page.mouse.move(x + 8, y);
    await expect(panel).toHaveAttribute("data-state", "expanded");
    await page.mouse.up();

    await expect(panel).toHaveAttribute("data-state", "expanded");
    await expect.poll(() => readRenderedSize(scope, "nav")).toBeCloseTo(140, 0);
  });
});
