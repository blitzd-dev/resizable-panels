import { expect, type Page, test } from "@playwright/test";
import { expectSumInvariant, waitForSettled } from "./helpers";

/**
 * Never-squish contract (design-decisions §1.3/§2.1, PLAN Batch 1, R-34):
 * a panel is never painted below its resolved minSize; when the container
 * cannot hold every floor the group keeps the floors, overflows, and says so
 * (`data-overconstrained` + one dev warning).
 *
 * The fixture is the R-34 shape at every width: docked `defaultSize="30%"
 * minSize={280}` next to a peer `minSize={200}`, swept 900 → 240 for both
 * `containerResizeBehavior` values. The sweep deliberately includes
 * comfortable widths — R-34's primary defect is a paint/allocator divergence
 * at container 900 (raw 30% = 270px painted against an allocator floor of
 * 280), not just an over-constraint bug.
 */

const DOCK_MIN = 280;
const PEER_MIN = 200;
const SUM_FLOORS = DOCK_MIN + PEER_MIN; // 480
const SWEEP = [900, 780, 660, 540, 480, 420, 360, 300, 240];
const OVERCONSTRAINED = SWEEP.filter((width) => width < SUM_FLOORS);

const WARNING_PATTERN = /too small for its panels' minimum sizes/;

const boxWidth = (page: Page, id: string) =>
  page
    .locator(`[data-resizable-panels-panel-id="${id}"]`)
    .evaluate((element) => element.getBoundingClientRect().width);

async function setWidth(page: Page, width: number): Promise<void> {
  await page.getByTestId("width-input").fill(String(width));
  await expect
    .poll(() =>
      page
        .getByTestId("never-squish-group")
        .evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBeCloseTo(width, 0);
  await waitForSettled(page.locator(".fixture-root"));
}

async function readState(page: Page) {
  const button = page.getByTestId("read-never-squish-state");
  await button.click();
  return JSON.parse((await button.getAttribute("data-snapshot")) ?? "null");
}

for (const behavior of ["fixed", "proportional"] as const) {
  test(`minimums hold at every width in the sweep (${behavior})`, async ({
    page,
  }) => {
    await page.goto(`/test/never-squish?behavior=${behavior}`);
    const root = page.locator(".fixture-root");

    for (const width of SWEEP) {
      await setWidth(page, width);
      const dockBox = await boxWidth(page, "dock");
      const peerBox = await boxWidth(page, "peer");
      const state = await readState(page);

      // (ii) getRenderedSize() must equal the measured box — one sizing
      // authority, no allocator/paint divergence.
      expect(
        state.dock.rendered,
        `dock getRenderedSize() vs measured box at container ${width}`,
      ).toBeCloseTo(dockBox, 0);
      expect(
        state.peer.rendered,
        `peer getRenderedSize() vs measured box at container ${width}`,
      ).toBeCloseTo(peerBox, 0);

      // (i) the measured box never drops below the resolved minSize.
      expect(
        dockBox,
        `dock measured ${dockBox.toFixed(1)}px at container ${width} must be ≥ minSize ${DOCK_MIN}`,
      ).toBeGreaterThanOrEqual(DOCK_MIN - 0.5);
      expect(
        peerBox,
        `peer measured ${peerBox.toFixed(1)}px at container ${width} must be ≥ minSize ${PEER_MIN}`,
      ).toBeGreaterThanOrEqual(PEER_MIN - 0.5);

      // Σ panels + gutters === clamp(container, Σ floors, Σ ceilings).
      await expectSumInvariant(root, "width", 2, { sumFloors: SUM_FLOORS });
    }
  });

  test(`over-constraint below ${SUM_FLOORS}px is declared on the group (${behavior})`, async ({
    page,
  }) => {
    await page.goto(`/test/never-squish?behavior=${behavior}`);
    const group = page.getByTestId("never-squish-group");

    await expect(group).not.toHaveAttribute("data-overconstrained");

    for (const width of OVERCONSTRAINED) {
      await setWidth(page, width);
      await expect(
        group,
        `data-overconstrained must be set at container ${width}`,
      ).toHaveAttribute("data-overconstrained");
      const overflow = await group.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      );
      expect(
        overflow,
        `group scrollWidth must exceed clientWidth at container ${width}`,
      ).toBeGreaterThan(0);
    }

    // Fully reversible: space returns, the declaration clears.
    await setWidth(page, 900);
    await expect(group).not.toHaveAttribute("data-overconstrained");
  });

  test(`the too-small dev warning fires exactly once across the sweep (${behavior})`, async ({
    page,
  }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (
        message.type() === "warning" &&
        WARNING_PATTERN.test(message.text())
      ) {
        warnings.push(message.text());
      }
    });

    await page.goto(`/test/never-squish?behavior=${behavior}`);
    for (const width of SWEEP) {
      await setWidth(page, width);
    }

    expect(
      warnings,
      `the over-constraint dev warning must fire exactly once; captured: ${JSON.stringify(
        warnings,
      )}`,
    ).toHaveLength(1);
  });
}

// G1 (review round): a docked size action must report `constrained: true` when
// the group is over-constrained and the paint is floored below the request —
// even when the LOCAL min/max clamp alone would report false. At container 420
// the dock's resolved max (100% = 420) still exceeds the 350 request, so the
// local clamp is a no-op; only the group over-constraint (280 dock + 200 peer
// > 420) floors the paint at 280. At container 900 the group fits and the same
// request is genuinely unconstrained.
async function readConstrained(page: Page) {
  const button = page.getByTestId("probe-dock-constrained");
  await button.click();
  return JSON.parse((await button.getAttribute("data-constrained")) ?? "null");
}

test("G1: docked setSize/maximize report constrained when the group is over-constrained", async ({
  page,
}) => {
  await page.goto("/test/never-squish?width=420");
  await expect.poll(() => boxWidth(page, "dock")).toBeCloseTo(280, 0); // floored — over-constrained
  const overconstrained = await readConstrained(page);
  expect(
    overconstrained,
    "over-constrained: a request above the floored paint is constrained",
  ).toEqual({ setSize: true, maximize: true });

  await page.goto("/test/never-squish?width=900");
  await expect.poll(() => boxWidth(page, "dock")).toBeCloseTo(280, 0);
  const roomy = await readConstrained(page);
  expect(
    roomy,
    "comfortable width: the same request fits and is unconstrained",
  ).toEqual({ setSize: false, maximize: false });
});

// G3 (review round): a container-relative default (`"30%"`) legitimately
// resolves below a pixel `minSize` under never-squish — the semantic and
// painted sizes clamp. The out-of-range defaultSize warning must NOT scold this
// blessed pattern, and must not re-fire per resolved px across a sweep.
test("G3: the defaultSize range warning does not scold a percentage default below a pixel minSize", async ({
  page,
}) => {
  const defaultSizeWarnings: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "warning" &&
      /defaultSize \(\d+px\) must resolve within/.test(message.text())
    ) {
      defaultSizeWarnings.push(message.text());
    }
  });

  await page.goto("/test/never-squish");
  for (const width of SWEEP) {
    await setWidth(page, width);
  }

  expect(
    defaultSizeWarnings,
    `a "30%" default below a px minSize must not warn; captured ${JSON.stringify(
      defaultSizeWarnings,
    )}`,
  ).toHaveLength(0);
});
