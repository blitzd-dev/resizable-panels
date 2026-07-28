import { expect, type Page, test } from "@playwright/test";
import { waitForSettled } from "./helpers";

/**
 * R-32 (R-05 regression): collapsing a docked panel whose string
 * `defaultSize` ("30%") is still uninitialized (live-tracking, never
 * dragged) must freeze its content at the pre-collapse expanded width in
 * PIXELS. The content element is absolutely positioned inside the panel, so
 * its containing block is the PANEL box — re-emitting the raw "30%" there
 * resolves against the shrinking collapsed panel and the content snaps to a
 * sliver (30% of ~nothing) for the whole close/reopen cycle.
 *
 * Sampling runs inside ONE page.evaluate on requestAnimationFrame so the
 * 300ms animation's midsection is captured at frame granularity — driver
 * round-trips would miss it (same technique as
 * nested-animation-integrity.spec.ts).
 *
 * The last test guards the other half of the R-05 contract: a collapse /
 * expand toggle is NOT an "interaction" — only drags, imperative size
 * actions, and restore commit pixels — so after a full toggle cycle the
 * panel must still track container resizes live.
 */

type Sample = {
  t: number;
  outerWidth: number;
  contentWidth: number;
  contentStyleWidth: string;
};

/** 30% of the 800px fixture container. */
const DOCK_EXPANDED = 240;

/** Click a fixture button in-page and sample the panel's outer + content
 * geometry on every animation frame for `durationMs`. */
function sampleThroughClick(
  page: Page,
  options: { buttonTestId: string; panelId: string; durationMs: number },
) {
  return page.evaluate(async ({ buttonTestId, panelId, durationMs }) => {
    const query = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`missing ${selector}`);
      return element;
    };
    const outer = query(`[data-resizable-panels-panel-id="${panelId}"]`);
    const content = outer.querySelector<HTMLElement>(
      "[data-resizable-panels-panel-content]",
    );
    if (!content) throw new Error(`missing content for ${panelId}`);
    query(`[data-testid="${buttonTestId}"]`).click();
    const samples: Sample[] = [];
    const start = performance.now();
    while (performance.now() - start < durationMs) {
      await new Promise(requestAnimationFrame);
      samples.push({
        t: performance.now() - start,
        outerWidth: outer.getBoundingClientRect().width,
        contentWidth: content.getBoundingClientRect().width,
        contentStyleWidth: content.style.width,
      });
    }
    return samples;
  }, options);
}

const readWidth = (page: Page, panelId: string) =>
  page
    .locator(`[data-resizable-panels-panel-id="${panelId}"]`)
    .evaluate((el) => el.getBoundingClientRect().width);

const readContentWidth = (page: Page, panelId: string) =>
  page
    .locator(
      `[data-resizable-panels-panel-id="${panelId}"] [data-resizable-panels-panel-content]`,
    )
    .evaluate((el) => el.getBoundingClientRect().width);

const describeSamples = (samples: Sample[]) =>
  samples.map(
    (s) =>
      `t=${s.t.toFixed(0)}ms outer=${s.outerWidth.toFixed(1)} ` +
      `content=${s.contentWidth.toFixed(1)} style=${s.contentStyleWidth}`,
  );

/** Distinct rounded outer widths strictly between the endpoints — proof the
 * outer actually animated instead of snapping. */
const distinctIntermediates = (samples: Sample[], from: number, to: number) => {
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  return new Set(
    samples
      .filter((s) => s.outerWidth > low + 5 && s.outerWidth < high - 5)
      .map((s) => Math.round(s.outerWidth)),
  );
};

test.describe("uninitialized string-default collapse (R-32)", () => {
  test("collapsing freezes content at the pre-collapse expanded width, mid-animation and settled", async ({
    page,
  }) => {
    await page.goto("/test/string-default-collapse");
    await expect
      .poll(() => readWidth(page, "dock"))
      .toBeCloseTo(DOCK_EXPANDED, 0);
    // Let the mount container-resize idle window lapse so the collapse
    // transition is live before sampling.
    await page.waitForTimeout(300);

    const samples = await sampleThroughClick(page, {
      buttonTestId: "collapse-dock",
      panelId: "dock",
      durationMs: 550,
    });

    // The collapse completed and actually animated.
    await expect.poll(() => readWidth(page, "dock")).toBeCloseTo(0, 0);
    expect(
      distinctIntermediates(samples, DOCK_EXPANDED, 0).size,
      [
        "expected >= 3 distinct intermediate outer widths",
        ...describeSamples(samples),
      ].join("\n"),
    ).toBeGreaterThanOrEqual(3);

    // The content never left the frozen expanded reference: on EVERY frame
    // of the close its width equals the pre-collapse 240px. Pre-fix the
    // content carried the raw "30%", which resolves against the shrinking
    // PANEL box — mid-animation it read ~30% of the animating outer.
    for (const sample of samples) {
      expect(
        sample.contentWidth,
        `content left the frozen expanded width at t=${sample.t.toFixed(0)}ms\n${describeSamples(samples).join("\n")}`,
      ).toBeCloseTo(DOCK_EXPANDED, 0);
    }

    // Settled-collapsed: still the frozen pixel reference, never 30%-of-0.
    await waitForSettled(page.getByTestId("collapse-container"));
    expect(await readContentWidth(page, "dock")).toBeCloseTo(DOCK_EXPANDED, 0);
  });

  test("reopening keeps content at the expanded width throughout and restores pre-collapse geometry", async ({
    page,
  }) => {
    await page.goto("/test/string-default-collapse");
    await expect
      .poll(() => readWidth(page, "dock"))
      .toBeCloseTo(DOCK_EXPANDED, 0);
    await page.waitForTimeout(300);
    await page.getByTestId("collapse-dock").click();
    await expect.poll(() => readWidth(page, "dock")).toBeCloseTo(0, 0);
    // Let the collapse's trailing animation and idle window lapse.
    await waitForSettled(page.getByTestId("collapse-container"));
    await page.waitForTimeout(300);

    const samples = await sampleThroughClick(page, {
      buttonTestId: "expand-dock",
      panelId: "dock",
      durationMs: 550,
    });

    // Final geometry equals pre-collapse: the live "30%" of 800px.
    await expect
      .poll(() => readWidth(page, "dock"))
      .toBeCloseTo(DOCK_EXPANDED, 0);
    expect(
      distinctIntermediates(samples, 0, DOCK_EXPANDED).size,
    ).toBeGreaterThanOrEqual(3);

    // Content is at the full expanded width from the first frame of the
    // expansion — the outer clip reveals it, it never squishes with the
    // animating panel box.
    for (const sample of samples) {
      expect(
        sample.contentWidth,
        `content mis-sized during expansion at t=${sample.t.toFixed(0)}ms\n${describeSamples(samples).join("\n")}`,
      ).toBeCloseTo(DOCK_EXPANDED, 0);
    }
    await waitForSettled(page.getByTestId("collapse-container"));
    expect(await readContentWidth(page, "dock")).toBeCloseTo(DOCK_EXPANDED, 0);
  });

  test("defaultCollapsed at mount: content is sized from the live default on the first frame of expansion", async ({
    page,
  }) => {
    await page.goto("/test/string-default-collapse");
    // "boot" mounted collapsed and has never been expanded — no frozen
    // pre-collapse width exists; the reference is the live-resolved "30%".
    await expect.poll(() => readWidth(page, "boot")).toBeCloseTo(0, 0);
    await page.waitForTimeout(300);

    const samples = await sampleThroughClick(page, {
      buttonTestId: "expand-boot",
      panelId: "boot",
      durationMs: 550,
    });

    await expect
      .poll(() => readWidth(page, "boot"))
      .toBeCloseTo(DOCK_EXPANDED, 0);
    expect(
      distinctIntermediates(samples, 0, DOCK_EXPANDED).size,
    ).toBeGreaterThanOrEqual(3);
    for (const sample of samples) {
      expect(
        sample.contentWidth,
        `boot content mis-sized during first expansion at t=${sample.t.toFixed(0)}ms\n${describeSamples(samples).join("\n")}`,
      ).toBeCloseTo(DOCK_EXPANDED, 0);
    }
  });

  test("a collapse/expand toggle is not an interaction: live tracking survives the cycle (R-05)", async ({
    page,
  }) => {
    await page.goto("/test/string-default-collapse");
    await expect
      .poll(() => readWidth(page, "dock"))
      .toBeCloseTo(DOCK_EXPANDED, 0);

    // Full toggle cycle, no drags and no imperative size actions.
    await page.getByTestId("collapse-dock").click();
    await expect.poll(() => readWidth(page, "dock")).toBeCloseTo(0, 0);
    await waitForSettled(page.getByTestId("collapse-container"));
    await page.getByTestId("expand-dock").click();
    await expect
      .poll(() => readWidth(page, "dock"))
      .toBeCloseTo(DOCK_EXPANDED, 0);
    await waitForSettled(page.getByTestId("collapse-container"));

    // The string default is still live: it keeps tracking the container
    // (30% of 1000 → 300, 30% of 600 → 180). If the toggle had committed a
    // pixel preference these reads would stay at 240.
    await page.getByTestId("set-width-1000").click();
    await expect.poll(() => readWidth(page, "dock")).toBeCloseTo(300, 0);
    await waitForSettled(page.getByTestId("collapse-container"));
    expect(await readContentWidth(page, "dock")).toBeCloseTo(300, 0);

    await page.getByTestId("set-width-600").click();
    await expect.poll(() => readWidth(page, "dock")).toBeCloseTo(180, 0);
    await waitForSettled(page.getByTestId("collapse-container"));
    expect(await readContentWidth(page, "dock")).toBeCloseTo(180, 0);
  });
});
