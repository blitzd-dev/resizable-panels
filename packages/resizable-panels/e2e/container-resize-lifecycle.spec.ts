import { expect, test } from "@playwright/test";

test.describe("container resize lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test/container-resize-lifecycle");
    await expect(page.getByTestId("container-resize-state")).toHaveAttribute(
      "data-resizing",
      "false",
    );
  });

  test("one group's idle timer cannot finish another group's resize", async ({
    page,
  }) => {
    const state = page.getByTestId("container-resize-state");

    await page.getByTestId("resize-first").click();
    await expect(state).toHaveAttribute("data-resizing", "true");
    await page.waitForTimeout(80);

    await page.getByTestId("resize-second").click();
    await expect(page.getByTestId("container-second")).toHaveCSS(
      "width",
      "440px",
    );
    await page.waitForTimeout(85);

    await expect(state).toHaveAttribute("data-resizing", "true");
    await expect(state).toHaveAttribute("data-resizing", "false", {
      timeout: 500,
    });
  });

  test("unmount synchronously releases the group's active resize", async ({
    page,
  }) => {
    const state = page.getByTestId("container-resize-state");

    await page.getByTestId("resize-first").click();
    await expect(state).toHaveAttribute("data-resizing", "true");
    await page.getByTestId("unmount-first").click();

    await expect(page.getByTestId("container-first")).toHaveCount(0);
    await expect(state).toHaveAttribute("data-resizing", "false");
  });
});
