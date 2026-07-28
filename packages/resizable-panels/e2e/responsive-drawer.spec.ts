import { expect, type Page, test } from "@playwright/test";

const navPanel = (page: Page) =>
  page.locator(`[data-resizable-panels-panel-id="nav"]`);
const navWidth = (page: Page) =>
  navPanel(page).evaluate((el) => el.getBoundingClientRect().width);

test.describe("Application-owned responsive drawers", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 720 });
    await page.goto("/test/responsive-drawer");
  });

  test("side panels render as drawers below their breakpoints", async ({
    page,
  }) => {
    await expect(
      page.locator(`[data-resizable-panels-panel-id="nav"]`),
    ).toHaveCount(0);
    await expect(
      page.locator(`[data-resizable-panels-panel-id="inspector"]`),
    ).toHaveCount(0);

    await page.getByRole("main").getByRole("button", { name: /Nav/ }).click();
    const navDialog = page.getByRole("dialog", { name: "Nav drawer" });
    await expect(navDialog).toBeVisible();
    await expect(navDialog.getByText("LeftPanel")).toBeVisible();
    await navDialog
      .getByRole("button", { name: "Increment nav local state" })
      .click();
    await expect(navDialog.getByTestId("counter-nav")).toHaveText("1");
    await page.keyboard.press("Escape");
    await expect(navDialog).toBeHidden();

    await page
      .getByRole("main")
      .getByRole("button", { name: /Inspector/ })
      .click();
    const inspectorDialog = page.getByRole("dialog", {
      name: "Inspector drawer",
    });
    await expect(inspectorDialog).toBeVisible();
    await expect(inspectorDialog.getByText("RightPanel")).toBeVisible();
    await inspectorDialog
      .getByRole("button", { name: "Increment inspector local state" })
      .click();
    await inspectorDialog
      .getByRole("button", { name: "Increment inspector local state" })
      .click();
    await expect(inspectorDialog.getByTestId("counter-inspector")).toHaveText(
      "2",
    );
  });

  // Re-adjudicated (R-35, 2026-07-21): this test previously asserted that
  // "lifted application state survives responsive mode changes" against a
  // fixture that lifted the counter's value into the parent. The fixture now
  // demonstrates the persistent-host portal pattern instead — the counter
  // holds its OWN state and survives because its instance is reparented, never
  // remounted. The observable assertions are unchanged (the counter reads 1,
  // then 2, across the swap); only the mechanism the test exercises changed.
  test("content React state survives the panel ⇄ sheet swap", async ({
    page,
  }) => {
    await page.getByRole("main").getByRole("button", { name: /Nav/ }).click();
    const navDialog = page.getByRole("dialog", { name: "Nav drawer" });
    await navDialog
      .getByRole("button", { name: "Increment nav local state" })
      .click();
    await expect(navDialog.getByTestId("counter-nav")).toHaveText("1");
    await page.keyboard.press("Escape");
    await expect(navDialog).toBeHidden();

    await page.setViewportSize({ width: 1700, height: 720 });
    await expect(navDialog).toHaveCount(0);
    await expect(
      page.locator(`[data-resizable-panels-panel-id="nav"]`),
    ).toBeVisible();
    await expect(page.getByTestId("counter-nav")).toHaveText("1");

    await page
      .getByRole("button", { name: "Increment nav local state" })
      .click();
    await expect(page.getByTestId("counter-nav")).toHaveText("2");

    await page.setViewportSize({ width: 900, height: 720 });
    await expect(
      page.locator(`[data-resizable-panels-panel-id="nav"]`),
    ).toHaveCount(0);
    await page.getByRole("main").getByRole("button", { name: /Nav/ }).click();
    await expect(navDialog.getByTestId("counter-nav")).toHaveText("2");
  });

  // Criterion 3: the panel UNMOUNTS while presented as a sheet, so its size is
  // held by the parent (fed back as defaultSize) and must return on remount.
  test("panel layout state survives the unmount/remount round-trip", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1700, height: 720 });
    await expect(navPanel(page)).toBeVisible();

    const initialWidth = await navWidth(page);
    const handle = page
      .locator("[data-resizable-panels-resize-handle]")
      .first();
    const box = await handle.boundingBox();
    if (!box) throw new Error("Expected the nav resize handle inline");
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 90, startY, { steps: 10 });
    await page.mouse.up();

    // The nav is now materially wider than its default.
    await expect.poll(() => navWidth(page)).toBeGreaterThan(initialWidth + 40);
    const widened = await navWidth(page);

    // Shrink so nav demotes to a sheet: the panel unmounts entirely.
    await page.setViewportSize({ width: 900, height: 720 });
    await expect(navPanel(page)).toHaveCount(0);

    // Grow back: the panel remounts and must restore the widened size, not the
    // declarative default.
    await page.setViewportSize({ width: 1700, height: 720 });
    await expect(navPanel(page)).toBeVisible();
    await expect.poll(() => navWidth(page)).toBeCloseTo(widened, -1);
  });

  // Criterion 4: an uncontrolled input's typed value and a scroll position —
  // state that lives only in the DOM — survive panel → sheet → panel because
  // the persistent host is moved, never remounted.
  test("typed input value and scroll position survive panel → sheet → panel", async ({
    page,
  }) => {
    // Start inline (roomy), type and scroll inside the inline panel.
    await page.setViewportSize({ width: 1700, height: 720 });
    await expect(navPanel(page)).toBeVisible();
    await page.getByTestId("draft-nav").fill("unsaved draft");
    await page.getByTestId("scroll-nav").evaluate((el) => {
      el.scrollTop = 80;
    });
    await expect
      .poll(() => page.getByTestId("scroll-nav").evaluate((el) => el.scrollTop))
      .toBeGreaterThan(40);
    const scrollInline = await page
      .getByTestId("scroll-nav")
      .evaluate((el) => el.scrollTop);

    // Demote to a sheet and open it: the same DOM node reparents into the
    // dialog. The typed value and scroll position come with it.
    await page.setViewportSize({ width: 900, height: 720 });
    await expect(navPanel(page)).toHaveCount(0);
    await page.getByRole("main").getByRole("button", { name: /Nav/ }).click();
    const navDialog = page.getByRole("dialog", { name: "Nav drawer" });
    await expect(navDialog).toBeVisible();
    await expect(navDialog.getByTestId("draft-nav")).toHaveValue(
      "unsaved draft",
    );
    await expect
      .poll(() =>
        navDialog.getByTestId("scroll-nav").evaluate((el) => el.scrollTop),
      )
      .toBeCloseTo(scrollInline, -1);

    // Promote back inline: state still intact.
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1700, height: 720 });
    await expect(navPanel(page)).toBeVisible();
    await expect(page.getByTestId("draft-nav")).toHaveValue("unsaved draft");
    await expect
      .poll(() => page.getByTestId("scroll-nav").evaluate((el) => el.scrollTop))
      .toBeCloseTo(scrollInline, -1);
  });
});
