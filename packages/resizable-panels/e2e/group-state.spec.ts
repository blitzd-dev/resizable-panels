import { expect, type Page, test } from "@playwright/test";
import { waitForSettled } from "./helpers";

/**
 * usePanelGroupState reactive contract (R-36). Same fixture shape as the
 * Batch 1 never-squish sweep — docked `minSize={280}` + peer `minSize={200}`,
 * overlay handle (gutter 0) — so Σfloors = 480 and, with no gutters,
 * overconstrainedBy = max(0, 480 − containerSize). The spec asserts the hook
 * tracks a live container resize, `measured` flips false→true, and at every
 * width the hook's `overconstrainedBy` agrees with both Σfloors − container
 * and the group's `data-overconstrained` attribute.
 *
 * Fail-first: the fixture imports `usePanelGroupState`, absent until Stage 2,
 * so this route fails to load at baseline.
 */

const DOCK_MIN = 280;
const PEER_MIN = 200;
const SUM_FLOORS = DOCK_MIN + PEER_MIN; // 480, no gutter
const SWEEP = [900, 660, 540, 480, 420, 360, 300, 240];

const readout = (page: Page) => page.getByTestId("group-state-readout");
const group = (page: Page) => page.getByTestId("group-state-group");

async function attr(page: Page, name: string): Promise<string> {
  return (await readout(page).getAttribute(name)) ?? "";
}

async function num(page: Page, name: string): Promise<number> {
  return Number(await attr(page, name));
}

async function setWidth(page: Page, width: number): Promise<void> {
  await page.getByTestId("width-input").fill(String(width));
  await expect
    .poll(() => group(page).evaluate((el) => el.getBoundingClientRect().width))
    .toBeCloseTo(width, 0);
  await waitForSettled(page.locator(".fixture-root"));
}

test("resolves a defined snapshot and flips measured false→true", async ({
  page,
}) => {
  await page.goto("/test/group-state");
  await expect(readout(page)).toHaveAttribute("data-defined", "true");
  await expect(readout(page)).toHaveAttribute("data-measured", "true");
  // The pre-measurement first paint was observed before the flip.
  await expect(readout(page)).toHaveAttribute("data-ever-unmeasured", "true");
});

test("containerSize tracks a live container resize", async ({ page }) => {
  await page.goto("/test/group-state");
  for (const width of SWEEP) {
    await setWidth(page, width);
    const box = await group(page).evaluate(
      (el) => el.getBoundingClientRect().width,
    );
    expect(
      await num(page, "data-container-size"),
      `hook containerSize vs measured group box at ${width}`,
    ).toBeCloseTo(box, 0);
  }
});

test("overconstrainedBy = Σfloors − container and agrees with data-overconstrained across a 0→N→0 sweep", async ({
  page,
}) => {
  await page.goto("/test/group-state");

  for (const width of [...SWEEP, 900]) {
    await setWidth(page, width);
    const containerSize = await num(page, "data-container-size");
    const overconstrainedBy = await num(page, "data-overconstrained-by");
    const expected = Math.max(0, SUM_FLOORS - containerSize);

    // Truthfulness: the reported shortfall equals Σfloors − container.
    expect(
      overconstrainedBy,
      `overconstrainedBy at container ${containerSize.toFixed(0)}`,
    ).toBeCloseTo(expected, 0);

    // The hook agrees with the group's painted attribute at every sample.
    const hasAttr =
      (await group(page).getAttribute("data-overconstrained")) !== null;
    expect(
      hasAttr,
      `data-overconstrained present iff overconstrainedBy>0 at ${width}`,
    ).toBe(overconstrainedBy > 0);
  }

  // Endpoints of the sweep: 0 at the roomy width, N>0 at the tightest.
  await setWidth(page, 900);
  expect(await num(page, "data-overconstrained-by")).toBe(0);
  await setWidth(page, 240);
  expect(await num(page, "data-overconstrained-by")).toBeGreaterThan(0);
});

// P1: every PUBLISHED snapshot must be internally consistent — its
// containerSize and unallocatedPx come from the same allocation pass, never a
// fresh size paired with a one-commit-stale shortfall. A Σmax-bound group is
// swept continuously by rAF; each recorded snapshot must satisfy
// unallocatedPx ≈ max(0, containerSize − Σmax) using its OWN containerSize.
test("every published snapshot is internally consistent across a continuous resize", async ({
  page,
}) => {
  const SUM_MAX = 480; // two peers capped at 240, no gutter
  await page.goto("/test/group-state-atomicity");
  await expect
    .poll(
      () => page.evaluate(() => window.__groupStateAtomicity?.done ?? false),
      {
        timeout: 10_000,
      },
    )
    .toBe(true);

  const { samples, consumerCommits } = await page.evaluate(() => ({
    samples: window.__groupStateAtomicity?.samples ?? [],
    consumerCommits: window.__groupStateAtomicity?.consumerCommits ?? 0,
  }));

  // Not vacuous: a continuous sweep must have produced many distinct snapshots.
  expect(samples.length).toBeGreaterThan(20);

  // P1 — every published snapshot is internally consistent.
  const inconsistent = samples.filter(
    (s) => Math.abs(s.un - Math.max(0, s.cs - SUM_MAX)) > 1,
  );
  expect(
    inconsistent,
    `snapshots pairing containerSize with stale unallocatedPx: ${JSON.stringify(
      inconsistent.slice(0, 5),
    )}`,
  ).toEqual([]);

  // P2 — positive locality: the consumer re-rendered ~once per distinct
  // snapshot. A LIVE subscription commits at least once per snapshot it
  // recorded (>= samples.length after allowing for StrictMode's dev
  // double-invoke), and is NOT amplifying (no runaway multiple). A DEAD
  // subscription would record ~1 snapshot and commit ~0 extra times.
  expect(consumerCommits).toBeGreaterThanOrEqual(samples.length * 0.9);
  expect(consumerCommits).toBeLessThanOrEqual(samples.length * 1.5);
});
