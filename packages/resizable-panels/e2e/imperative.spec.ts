import { expect, test } from "@playwright/test";
import { clickToggle, readRenderedSize, waitForSettled } from "./helpers";

test.describe("Imperative control", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("collapsed docked panel adopts imperative size before expanding", async ({
    page,
  }) => {
    await page.goto("/test/imperative");

    const scope = page.locator("body");
    const content = scope.locator(
      `[data-resizable-panels-panel-id="left"] [data-resizable-panels-panel-content]`,
    );

    await clickToggle(scope, "left");
    await waitForSettled(scope);

    await scope.getByRole("button", { name: "setSize 280" }).click();

    await expect
      .poll(() =>
        content.evaluate((el) => parseFloat(getComputedStyle(el).width)),
      )
      .toBe(280);

    await clickToggle(scope, "left");

    await expect
      .poll(() =>
        content.evaluate(
          (el) =>
            el
              .getAnimations()
              .filter((animation) => animation.playState === "running").length,
        ),
      )
      .toBe(0);
  });

  test('expand with transition "none" expands without a slide animation', async ({
    page,
  }) => {
    await page.goto("/test/imperative");

    const scope = page.locator("body");
    const outer = scope.locator(`[data-resizable-panels-panel-id="left"]`);

    await clickToggle(scope, "left");
    await waitForSettled(scope);
    expect(await readRenderedSize(scope, "left")).toBe(0);

    // Arm a transitionrun listener before acting: unlike polling
    // getAnimations(), this catches a transition even if it starts and
    // finishes between samples.
    await outer.evaluate((el) => {
      el.setAttribute("data-transition-ran", "false");
      el.addEventListener("transitionrun", () => {
        el.setAttribute("data-transition-ran", "true");
      });
    });

    await scope.getByTestId("expand-immediately-left").click();

    await expect.poll(() => readRenderedSize(scope, "left")).toBe(160);
    await waitForSettled(scope);
    await expect(outer).toHaveAttribute("data-transition-ran", "false");
  });
});
