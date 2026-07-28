import { expect, type Page, test } from "@playwright/test";
import { clickToggle, dragHandle, waitForSettled } from "./helpers";

type MotionSample = {
  elapsed: number;
  groupRight: number;
  groupWidth: number;
  middleWidth: number;
  panelSum: number;
  rightRight: number;
  rightWidth: number;
};

declare global {
  interface Window {
    __percentageBoundsMotion?: {
      done: boolean;
      samples: MotionSample[];
    };
  }
}

const LEFT = "percentage-left";
const MIDDLE = "percentage-middle";
const RIGHT = "percentage-right";

async function armMotionSampling(page: Page) {
  await page.evaluate(
    ({ middleId, rightId }) => {
      const group = document.querySelector<HTMLElement>(
        '[data-testid="percentage-motion-group"]',
      );
      const middle = document.querySelector<HTMLElement>(
        `[data-resizable-panels-panel-id="${middleId}"]`,
      );
      const right = document.querySelector<HTMLElement>(
        `[data-resizable-panels-panel-id="${rightId}"]`,
      );
      if (!group || !middle || !right) {
        throw new Error("percentage motion fixture not found");
      }

      const timeline = { done: false, samples: [] as MotionSample[] };
      window.__percentageBoundsMotion = timeline;
      const startedAt = performance.now();
      let expanded = false;
      const sample = (time: number) => {
        const groupRect = group.getBoundingClientRect();
        const middleRect = middle.getBoundingClientRect();
        const rightRect = right.getBoundingClientRect();
        const panels = Array.from(
          group.querySelectorAll<HTMLElement>(
            ":scope > [data-resizable-panels-panel]",
          ),
        );
        timeline.samples.push({
          elapsed: time - startedAt,
          groupRight: groupRect.right,
          groupWidth: groupRect.width,
          middleWidth: middleRect.width,
          panelSum: panels.reduce(
            (sum, panel) => sum + panel.getBoundingClientRect().width,
            0,
          ),
          rightRight: rightRect.right,
          rightWidth: rightRect.width,
        });
        expanded ||= right.dataset.state === "expanded";
        const running = panels.some((panel) =>
          panel
            .getAnimations({ subtree: true })
            .some((animation) => animation.playState === "running"),
        );
        if ((expanded && !running) || time - startedAt > 1_000) {
          timeline.done = true;
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    },
    { middleId: MIDDLE, rightId: RIGHT },
  );
}

test("a zero-width automatic peer keeps an end panel docked while it reopens", async ({
  page,
}) => {
  await page.goto("/test/percentage-bounds-motion");
  const scope = page.locator("body");
  await waitForSettled(scope);

  await clickToggle(scope, LEFT);
  await waitForSettled(scope);
  await dragHandle(scope, { panelId: RIGHT, delta: 10_000, quick: true });
  await clickToggle(scope, RIGHT);
  await waitForSettled(scope);
  await clickToggle(scope, LEFT);
  await waitForSettled(scope);
  await dragHandle(scope, { panelId: LEFT, delta: 10_000, quick: true });

  await armMotionSampling(page);
  await clickToggle(scope, RIGHT);
  await page.waitForFunction(() => window.__percentageBoundsMotion?.done);

  const samples = await page.evaluate(
    () => window.__percentageBoundsMotion?.samples ?? [],
  );
  expect(samples.length).toBeGreaterThan(3);
  const final = samples.at(-1);
  if (!final) throw new Error("expected percentage motion samples");

  expect(
    samples.some(
      (sample) =>
        sample.rightWidth > 5 && sample.rightWidth < final.rightWidth - 5,
    ),
    `no intermediate opening frame: ${samples
      .map((sample) => sample.rightWidth.toFixed(1))
      .join(", ")}`,
  ).toBe(true);
  expect(
    samples.some((sample) => sample.middleWidth > 5),
    "the automatic peer never absorbed the transient opening gap",
  ).toBe(true);

  for (const sample of samples) {
    expect(
      Math.abs(sample.panelSum - sample.groupWidth),
      `panels stopped filling the group at ${sample.elapsed.toFixed(1)}ms`,
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(sample.rightRight - sample.groupRight),
      `right panel left the docked edge at ${sample.elapsed.toFixed(1)}ms`,
    ).toBeLessThanOrEqual(1);
  }

  expect(final.rightWidth / final.groupWidth).toBeCloseTo(0.5, 2);
  expect(final.middleWidth).toBeLessThanOrEqual(1);
});

test("a peer squeezed to zero by a boundary drag becomes automatic again", async ({
  page,
}) => {
  await page.goto("/test/percentage-bounds-motion");
  const scope = page.locator("body");
  await waitForSettled(scope);

  // With both dockeds open, maximizing each side squeezes the automatic peer
  // to zero as a consequence of the boundary drags. That zero must not become
  // a sticky application-authored size.
  await dragHandle(scope, { panelId: RIGHT, delta: 10_000, quick: true });
  await dragHandle(scope, { panelId: LEFT, delta: 10_000, quick: true });
  const middle = scope.locator(`[data-resizable-panels-panel-id="${MIDDLE}"]`);
  await expect
    .poll(() =>
      middle.evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBeLessThanOrEqual(1);

  await clickToggle(scope, RIGHT);
  await waitForSettled(scope);
  await expect
    .poll(() =>
      middle.evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBeGreaterThan(100);

  await armMotionSampling(page);
  await clickToggle(scope, RIGHT);
  await page.waitForFunction(() => window.__percentageBoundsMotion?.done);
  const samples = await page.evaluate(
    () => window.__percentageBoundsMotion?.samples ?? [],
  );
  expect(samples.length).toBeGreaterThan(3);

  for (const sample of samples) {
    expect(
      Math.abs(sample.panelSum - sample.groupWidth),
      `panels stopped filling the group at ${sample.elapsed.toFixed(1)}ms`,
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(sample.rightRight - sample.groupRight),
      `right panel left the docked edge at ${sample.elapsed.toFixed(1)}ms`,
    ).toBeLessThanOrEqual(1);
  }
});
