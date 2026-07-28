import { expect, type Page, test } from "@playwright/test";
import { readRenderedSize, waitForSettled } from "./helpers";

/**
 * R-33 — per-panel controlled `collapsed`. The parent owns the prop;
 * `onCollapsedChange` carries proposals. The fixture's mode toggle decides
 * whether the parent accepts (re-renders with the proposed value) or
 * declines (ignores the proposal). Ground truth is the DOM: `data-state` is
 * the presented state, the `effective` readout is the authoritative
 * (prop-pinned) state, and `proposal-log` counts emissions —
 * `<count>:<value>/<reason>/<trigger>`.
 */

function locators(page: Page) {
  const scope = page.locator("body");
  return {
    scope,
    panel: scope.locator('[data-resizable-panels-panel-id="side"]'),
    handle: page.getByTestId("controlled-handle"),
    externalToggle: page.getByTestId("external-toggle"),
    modeToggle: page.getByTestId("mode-toggle"),
    proposalLog: page.getByTestId("proposal-log"),
    effective: page.getByTestId("effective"),
  };
}

async function dragPastCollapseBelow(page: Page) {
  const { handle } = locators(page);
  const box = await handle.boundingBox();
  if (!box) throw new Error("controlled handle not found");
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // The expanded panel hits its 140px minSize wall first; further travel
  // counts toward collapseBelow (60px) without rendering invalid sizes.
  await page.mouse.move(startX - 175, startY);
  return { startX, startY };
}

test.describe("controlled collapsed (R-33)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/test/controlled-collapsed");
  });

  test("external button accept flow animates and emits no proposals", async ({
    page,
  }) => {
    const { scope, panel, externalToggle, proposalLog } = locators(page);
    await expect
      .poll(() => readRenderedSize(scope, "side"))
      .toBeCloseTo(220, 0);

    await externalToggle.click();
    // The parent flipped its own state: the prop change applies with the
    // library animation and is NOT a change event — no proposal fires.
    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await expect(panel).toHaveCSS("transition-property", "width");
    await expect(panel).toHaveCSS("transition-duration", "0.3s");
    await waitForSettled(scope);
    await expect.poll(() => readRenderedSize(scope, "side")).toBeLessThan(1);
    await expect(proposalLog).toHaveText("0:none");

    await externalToggle.click();
    await expect(panel).toHaveAttribute("data-state", "expanded");
    await waitForSettled(scope);
    await expect
      .poll(() => readRenderedSize(scope, "side"))
      .toBeCloseTo(220, 0);
    await expect(proposalLog).toHaveText("0:none");
  });

  test("drag past collapseBelow proposes; a declined proposal snaps back at release", async ({
    page,
  }) => {
    const { scope, panel, proposalLog, effective } = locators(page);

    await dragPastCollapseBelow(page);
    // The gesture PRESENTS the collapse live while the crossing proposes.
    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await expect(proposalLog).toHaveText("1:collapse/collapse/pointer");
    // Readouts stay pinned to the authoritative prop mid-gesture.
    await expect(effective).toHaveText("expanded");

    await page.mouse.up();
    // Declined (the parent never re-rendered with collapsed): the panel
    // snaps back to the prop state, restoring its preserved preferred size.
    await expect(panel).toHaveAttribute("data-state", "expanded");
    await waitForSettled(scope);
    await expect
      .poll(() => readRenderedSize(scope, "side"))
      .toBeCloseTo(220, 0);
    await expect(effective).toHaveText("expanded");
    // No extra emission at release — the crossing was the one proposal.
    await expect(proposalLog).toHaveText("1:collapse/collapse/pointer");
  });

  test("drag past collapseBelow applies when the parent accepts", async ({
    page,
  }) => {
    const { scope, panel, modeToggle, proposalLog, effective } = locators(page);
    await modeToggle.click();
    await expect(modeToggle).toHaveText("mode: accept");

    await dragPastCollapseBelow(page);
    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await expect(proposalLog).toHaveText("1:collapse/collapse/pointer");
    // The parent accepted mid-gesture: the effective state follows the prop.
    await expect(effective).toHaveText("collapsed");

    await page.mouse.up();
    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await waitForSettled(scope);
    await expect.poll(() => readRenderedSize(scope, "side")).toBeLessThan(1);
    // Acceptance did not double-fire: still exactly one proposal.
    await expect(proposalLog).toHaveText("1:collapse/collapse/pointer");
  });

  test("Enter on the handle proposes; accepted toggles apply without double events", async ({
    page,
  }) => {
    const { scope, panel, handle, modeToggle, proposalLog } = locators(page);

    // Decline mode: Enter proposes a collapse and nothing changes.
    await handle.focus();
    await page.keyboard.press("Enter");
    await expect(proposalLog).toHaveText("1:collapse/collapse/keyboard");
    await expect(panel).toHaveAttribute("data-state", "expanded");

    // Accept mode: the same Enter now applies through the parent.
    await modeToggle.click();
    await handle.focus();
    await page.keyboard.press("Enter");
    await expect(proposalLog).toHaveText("2:collapse/collapse/keyboard");
    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await waitForSettled(scope);
    await expect.poll(() => readRenderedSize(scope, "side")).toBeLessThan(1);

    // The zero-collapsed handle stays reachable (R-18 toggle-only): Enter
    // proposes the expansion, and acceptance reopens the panel.
    await handle.focus();
    await page.keyboard.press("Enter");
    await expect(proposalLog).toHaveText("3:expand/expand/keyboard");
    await expect(panel).toHaveAttribute("data-state", "expanded");
    await waitForSettled(scope);
    await expect
      .poll(() => readRenderedSize(scope, "side"))
      .toBeCloseTo(220, 0);
  });
});
