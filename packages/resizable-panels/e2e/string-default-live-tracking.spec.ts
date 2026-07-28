import { expect, type Page, test } from "@playwright/test";
import { dragHandle, readRenderedSize, waitForSettled } from "./helpers";

/**
 * R-05 regression: a string `defaultSize` ("50%") on a docked panel is LIVE
 * UNTIL INTERACTION — it keeps tracking its container like CSS, no matter
 * how long measurements stay quiet, until a pointer drag (or imperative
 * action/restore) commits a pixel preference. At baseline a 150ms
 * bootstrap idle-timer committed whatever pixels the container happened to
 * show, so a container that settled slowly (or resized later) froze the
 * wrong preference permanently — identical markup, timing-dependent
 * geometry.
 */

const scope = (page: Page) => page.getByTestId("live-tracking-container");

/** Longer than the deleted 150ms bootstrap idle window. Deliberate
 * mid-timeline pause, not synchronization — the layout is already settled
 * when it runs; its only purpose is to give a reintroduced commit-on-idle
 * timer time to fire so the next container change would catch a frozen
 * preference. */
const BEYOND_OLD_IDLE_MS = 250;

test("a '50%' docked panel tracks container resizes through long quiet pauses until a drag commits pixels", async ({
  page,
}) => {
  await page.goto("/test/string-default-live-tracking");
  const container = scope(page);

  // 50% of the 320px container.
  await expect
    .poll(() => readRenderedSize(container, "half"))
    .toBeCloseTo(160, 0);

  await page.waitForTimeout(BEYOND_OLD_IDLE_MS);
  await page.getByTestId("set-width-640").click();
  // Still 50%: the quiet pause did not freeze 160px as the preference. At
  // baseline this read ~160 — the timer had committed mid-settle pixels.
  await expect
    .poll(() => readRenderedSize(container, "half"))
    .toBeCloseTo(320, 0);

  // Repeated pauses never start a countdown either — tracking survives any
  // number of quiet windows.
  await page.waitForTimeout(BEYOND_OLD_IDLE_MS);
  await page.getByTestId("set-width-480").click();
  await expect
    .poll(() => readRenderedSize(container, "half"))
    .toBeCloseTo(240, 0);

  // A real drag commits the preference: 240 + 40 = 280px.
  await waitForSettled(container);
  await dragHandle(container, { panelId: "half", delta: 40, quick: true });
  await expect
    .poll(() => readRenderedSize(container, "half"))
    .toBeCloseTo(280, 0);

  // Fixed behavior resumes: container growth no longer changes the
  // committed preference — the freed space flows to the peer instead.
  await page.getByTestId("set-width-640").click();
  await waitForSettled(container);
  await expect
    .poll(() => readRenderedSize(container, "half"))
    .toBeCloseTo(280, 0);
  await expect
    .poll(() => readRenderedSize(container, "content"))
    .toBeCloseTo(360, 0);

  // Percentage bounds stay live after initialization: shrinking to 320
  // pulls maxSize "75%" down to 240px, clamping the committed 280.
  await page.getByTestId("set-width-320").click();
  await waitForSettled(container);
  await expect
    .poll(() => readRenderedSize(container, "half"))
    .toBeCloseTo(240, 0);
});
