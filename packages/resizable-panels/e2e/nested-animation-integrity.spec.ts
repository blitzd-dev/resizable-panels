import { expect, type Page, test } from "@playwright/test";

/**
 * R-31: a dock's collapse animation must survive nested same-axis container
 * churn. The fixture is a three-level axis-realigning IDE shape (horizontal
 * outer [dock | center], vertical center [editor-area | bottom], horizontal
 * editor-area [split-a | split-b]). While the dock animates, the innermost
 * splits group's ResizeObserver sees main-axis changes every frame; pre-fix
 * that raised the provider-wide no-transitions flag and the dock snapped.
 *
 * Sampling runs inside ONE page.evaluate on requestAnimationFrame so the
 * trajectory is captured at frame granularity from the moment the collapse
 * is triggered — round-tripping through the driver would miss the 300ms
 * animation's midsection.
 */

type Sample = {
  t: number;
  dockWidth: number;
  transitionProperty: string;
  transitionDuration: string;
  splitA: number;
  splitB: number;
  splitsGroup: number;
};

const DOCK_START = 260;

/** Click a fixture button in-page and sample the dock + splits geometry on
 * every animation frame for `durationMs`. */
function sampleThroughToggle(page: Page, durationMs: number) {
  return page.evaluate(async (sampleMs) => {
    const query = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`missing ${selector}`);
      return element;
    };
    const dock = query('[data-resizable-panels-panel-id="dock"]');
    const splitA = query('[data-resizable-panels-panel-id="split-a"]');
    const splitB = query('[data-resizable-panels-panel-id="split-b"]');
    const splitsGroup = query(
      '[data-resizable-panels-panel-id="editor-area"] [data-resizable-panels-panel-group]',
    );
    query('[data-testid="toggle-dock"]').click();
    const samples: Sample[] = [];
    const start = performance.now();
    while (performance.now() - start < sampleMs) {
      await new Promise(requestAnimationFrame);
      const computed = getComputedStyle(dock);
      samples.push({
        t: performance.now() - start,
        dockWidth: dock.getBoundingClientRect().width,
        transitionProperty: computed.transitionProperty,
        transitionDuration: computed.transitionDuration,
        splitA: splitA.getBoundingClientRect().width,
        splitB: splitB.getBoundingClientRect().width,
        splitsGroup: splitsGroup.getBoundingClientRect().width,
      });
    }
    return samples;
  }, durationMs);
}

const distinctIntermediates = (samples: Sample[], from: number, to: number) => {
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  const widths = samples
    .filter((s) => s.dockWidth > low + 5 && s.dockWidth < high - 5)
    .map((s) => Math.round(s.dockWidth));
  return new Set(widths);
};

test.describe("nested animation integrity (R-31)", () => {
  test("API-collapsing the dock animates despite same-axis third-level splits", async ({
    page,
  }) => {
    await page.goto("/test/nested-animation-integrity");
    const dock = page.locator('[data-resizable-panels-panel-id="dock"]');
    await expect
      .poll(() => dock.evaluate((el) => el.getBoundingClientRect().width))
      .toBeCloseTo(DOCK_START, 0);
    // Let the mount-time container-resize windows lapse so transitions are
    // live before the collapse is triggered.
    await page.waitForTimeout(300);

    const samples = await sampleThroughToggle(page, 550);

    // The collapse completed.
    await expect
      .poll(() => dock.evaluate((el) => el.getBoundingClientRect().width))
      .toBeCloseTo(0, 0);

    // The dock actually ANIMATED: several distinct strictly-intermediate
    // widths were painted. Pre-fix the width snapped 260 → 0 as soon as the
    // splits group's observer fired (~1-3 frames in), leaving at most a
    // couple of near-start values.
    expect(
      distinctIntermediates(samples, DOCK_START, 0).size,
      [
        "expected >= 3 distinct intermediate dock widths",
        ...samples.map(
          (s) =>
            `t=${s.t.toFixed(0)}ms width=${s.dockWidth.toFixed(1)} ` +
            `transition=${s.transitionProperty} ${s.transitionDuration}`,
        ),
      ].join("\n"),
    ).toBeGreaterThanOrEqual(3);

    // No frame-to-frame snap: with the 300ms easing the real per-frame
    // delta tops out around 25px at 60fps; a suppression snap jumps the
    // remaining distance (>200px) in one frame. 120px allows dropped
    // frames without letting a snap through.
    for (let i = 1; i < samples.length; i += 1) {
      const drop = samples[i - 1].dockWidth - samples[i].dockWidth;
      expect(
        drop,
        `snap between t=${samples[i - 1].t.toFixed(0)}ms (${samples[
          i - 1
        ].dockWidth.toFixed(
          1,
        )}px) and t=${samples[i].t.toFixed(0)}ms (${samples[
          i
        ].dockWidth.toFixed(1)}px)`,
      ).toBeLessThan(120);
    }

    // Mid-flight the dock's computed transition is never "none"-suppressed:
    // the dock's own group's container is static, so group-local
    // suppression must not touch it.
    for (const sample of samples) {
      if (sample.dockWidth <= 5 || sample.dockWidth >= DOCK_START - 5) {
        continue;
      }
      expect(
        sample.transitionProperty,
        `dock transition suppressed mid-animation at t=${sample.t.toFixed(0)}ms`,
      ).not.toBe("none");
      expect(sample.transitionDuration).not.toBe("0s");
    }

    // The inner splits keep tracking: their widths sum to their own group's
    // container on every sampled frame (overlay handles occupy no space).
    for (const sample of samples) {
      expect(
        Math.abs(sample.splitA + sample.splitB - sample.splitsGroup),
        `splits desynced at t=${sample.t.toFixed(0)}ms: ` +
          `${sample.splitA.toFixed(1)} + ${sample.splitB.toFixed(1)} != ${sample.splitsGroup.toFixed(1)}`,
      ).toBeLessThan(2);
    }
  });

  test("re-expanding the dock animates the same trajectory in reverse", async ({
    page,
  }) => {
    await page.goto("/test/nested-animation-integrity");
    const dock = page.locator('[data-resizable-panels-panel-id="dock"]');
    await expect
      .poll(() => dock.evaluate((el) => el.getBoundingClientRect().width))
      .toBeCloseTo(DOCK_START, 0);
    await page.waitForTimeout(300);
    await page.getByTestId("toggle-dock").click();
    await expect
      .poll(() => dock.evaluate((el) => el.getBoundingClientRect().width))
      .toBeCloseTo(0, 0);
    // Let the collapse's trailing container-resize idle window lapse.
    await page.waitForTimeout(300);

    const samples = await sampleThroughToggle(page, 550);

    await expect
      .poll(() => dock.evaluate((el) => el.getBoundingClientRect().width))
      .toBeCloseTo(DOCK_START, 0);
    expect(
      distinctIntermediates(samples, 0, DOCK_START).size,
    ).toBeGreaterThanOrEqual(3);
    for (const sample of samples) {
      expect(
        Math.abs(sample.splitA + sample.splitB - sample.splitsGroup),
        `splits desynced at t=${sample.t.toFixed(0)}ms`,
      ).toBeLessThan(2);
    }
  });
});
