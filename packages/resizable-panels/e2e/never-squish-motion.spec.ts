import { expect, type Page, test } from "@playwright/test";

/**
 * Mid-animation coverage for the never-squish batch (R-34 review round). The
 * steady-state sweeps in `never-squish.spec.ts` cannot see a violation that
 * lives inside an animation frame; these two probes sample the painted box
 * every frame across a transition.
 *
 * F1 — peer expand must not snap to `minSize`. The peer's `minWidth: minPx`
 * floor must animate up with `flex-basis` (same easing) rather than binding at
 * frame 0 while the basis is still climbing from the rail.
 *
 * F2 — a floored uninitialized docked panel must not ANIMATE raw%→allocated
 * over ~300ms below its floor on cold load. The first raw→allocated commit
 * must suppress the width transition so the box reaches its `minSize` at once.
 */

const PEER = '[data-resizable-panels-panel-id="peer-a"]';
const DOCK = '[data-resizable-panels-panel-id="dock"]';

/** Sample a panel's main-axis width every animation frame for `durationMs`,
 *  driving the trigger inside the same evaluate so frame 0 is captured right
 *  at the state flip. */
async function sampleWidthDuringExpand(
  page: Page,
  selector: string,
  triggerTestId: string,
  durationMs: number,
): Promise<number[]> {
  return page.evaluate(
    ({ selector, triggerTestId, durationMs }) => {
      const panel = document.querySelector(selector);
      const trigger = document.querySelector(
        `[data-testid="${triggerTestId}"]`,
      ) as HTMLElement | null;
      if (!panel || !trigger) throw new Error("fixture not found");
      const samples: number[] = [];
      return new Promise<number[]>((resolve) => {
        trigger.click();
        // Synchronous t≈0 read: the discrete click has already flushed the
        // state flip, so this captures the transition's starting value before
        // the first frame advances it (rAF can fire tens of ms in).
        samples.push(panel.getBoundingClientRect().width);
        const start = performance.now();
        const tick = () => {
          samples.push(panel.getBoundingClientRect().width);
          if (performance.now() - start < durationMs) {
            requestAnimationFrame(tick);
          } else {
            resolve(samples);
          }
        };
        requestAnimationFrame(tick);
      });
    },
    { selector, triggerTestId, durationMs },
  );
}

function maxConsecutiveJump(series: number[]): number {
  let max = 0;
  for (let i = 1; i < series.length; i++) {
    max = Math.max(max, Math.abs(series[i] - series[i - 1]));
  }
  return max;
}

test("F1: expanding a collapsible peer animates smoothly up from the rail without snapping to minSize", async ({
  page,
}) => {
  // peer-a: minSize 150, collapsedSize 40. Collapse first, then frame-sample
  // the expand back to 300.
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto("/test/collapsible-peer");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByTestId("collapse-peer").click();
  await expect
    .poll(() =>
      page.locator(PEER).evaluate((el) => el.getBoundingClientRect().width),
    )
    .toBeCloseTo(40, 0);

  const series = await sampleWidthDuringExpand(page, PEER, "expand-peer", 450);

  // series[0] is the synchronous t≈0 read; series[1..] are the animation
  // frames. The transition must START at the rail: on the broken tree the
  // min-width floor binds instantly, so even the t≈0 sample reads ~150.
  expect(
    series[0],
    `expand must start at the collapsed rail (40), not the minSize floor (150); t≈0 sample ${series[0].toFixed(
      1,
    )}`,
  ).toBeLessThan(100);

  // The animation frames themselves must be smooth — no consecutive frame jumps
  // more than 40px (the 40→150 snap is ~110px). The t≈0 seed is excluded: the
  // gap to the first rAF (~40ms) is a sampling artifact, not a paint jump.
  expect(
    maxConsecutiveJump(series.slice(1)),
    `animation frames must be smooth; series ${JSON.stringify(
      series.map((n) => Math.round(n)),
    )}`,
  ).toBeLessThanOrEqual(40);

  // No plateau at exactly minSize (150): the broken tree pins there for ~85ms
  // while the basis climbs past it; the fix passes through 150 once.
  const atFloor = series.filter((w) => w >= 148 && w <= 152).length;
  expect(
    atFloor,
    `must not plateau at the minSize floor (150); ${atFloor} samples within 2px of it`,
  ).toBeLessThanOrEqual(2);

  // Settles at the expanded preference.
  await expect
    .poll(() =>
      page.locator(PEER).evaluate((el) => el.getBoundingClientRect().width),
    )
    .toBeCloseTo(300, 0);
});

test("F1 mirror: collapsing a peer stays smooth (no floor-driven glitch)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto("/test/collapsible-peer");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const series = await sampleWidthDuringExpand(
    page,
    PEER,
    "collapse-peer",
    450,
  );
  expect(
    maxConsecutiveJump(series),
    `collapse must stay smooth; series ${JSON.stringify(
      series.map((n) => Math.round(n)),
    )}`,
  ).toBeLessThanOrEqual(40);
  await expect
    .poll(() =>
      page.locator(PEER).evaluate((el) => el.getBoundingClientRect().width),
    )
    .toBeCloseTo(40, 0);
});

test("F2: a floored uninitialized docked panel does not animate below its minSize on cold load", async ({
  page,
}) => {
  // Record the dock's width every frame from the very first paint. Cold-load an
  // over-constrained group (container 240, dock 30%/min 280) so the raw default
  // (72px) is far below the floor. Broken tree: the raw→allocated switch is
  // transitioned, so the box climbs through ~33 frames below 280.
  await page.addInitScript(() => {
    const samples: Array<{ t: number; w: number }> = [];
    (window as unknown as { __dockSeries: typeof samples }).__dockSeries =
      samples;
    const start = performance.now();
    const tick = () => {
      const el = document.querySelector(
        '[data-resizable-panels-panel-id="dock"]',
      );
      if (el)
        samples.push({
          t: performance.now() - start,
          w: el.getBoundingClientRect().width,
        });
      if (performance.now() - start < 600) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await page.goto("/test/never-squish?width=240");
  await page.waitForTimeout(650);

  const series = await page.evaluate(
    () =>
      (window as unknown as { __dockSeries: Array<{ t: number; w: number }> })
        .__dockSeries,
  );
  const widths = series.map((s) => s.w).filter((w) => w > 1);
  expect(widths.length, "expected frame samples").toBeGreaterThan(4);

  // Frames strictly below the floor (excluding a tolerance band around it). A
  // one-shot skip-anim collapses this to ≤2 (the pre-allocation raw frame plus
  // the snap); the transitioned climb produces ~30.
  const belowFloor = widths.filter((w) => w < 280 - 2).length;
  expect(
    belowFloor,
    `the dock must snap to its floor, not animate through it; ${belowFloor} frames below 280, series ${JSON.stringify(
      widths.map((n) => Math.round(n)),
    )}`,
  ).toBeLessThanOrEqual(2);

  // Settles at the floor.
  await expect
    .poll(() =>
      page.locator(DOCK).evaluate((el) => el.getBoundingClientRect().width),
    )
    .toBeCloseTo(280, 0);
});
