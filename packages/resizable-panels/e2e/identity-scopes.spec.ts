import { expect, test } from "@playwright/test";

test.describe("panel identity scopes", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto("/test/identity-scopes");
  });

  test("resolves repeated local panelIds through exact group locators", async ({
    page,
  }) => {
    const registry = page.getByTestId("identity-registry");

    // Both groups mount a panel with the same local panelId; each resolves
    // through its own groupId with no cross-group ambiguity.
    await expect(
      page.locator('[data-resizable-panels-panel-id="shared"]'),
    ).toHaveCount(2);
    await expect(registry).toHaveAttribute("data-left-size", "300");
    await expect(registry).toHaveAttribute("data-right-size", "280");

    await page.getByTestId("resize-scoped").click();
    await expect(registry).toHaveAttribute("data-left-size", "240");
    await expect(registry).toHaveAttribute("data-right-size", "340");
  });

  test("never retargets lookup after the addressed group unmounts", async ({
    page,
  }) => {
    const registry = page.getByTestId("identity-registry");
    await expect(registry).toHaveAttribute("data-right-size", "280");

    await page.getByTestId("unmount-right-group").click();
    await expect(page.getByTestId("right-group-placeholder")).toBeVisible();
    await expect(
      page.locator('[data-resizable-panels-panel-id="shared"]'),
    ).toHaveCount(1);

    // The locator for the unmounted group resolves to nothing — it must not
    // fall back to the other group's panel with the same local panelId.
    await expect(registry).toHaveAttribute("data-right-size", "missing");
    const probe = page.getByTestId("probe-right-actions");
    await probe.click();
    expect(JSON.parse((await probe.getAttribute("data-result"))!)).toEqual({
      applied: false,
      reason: "not-found",
    });

    // The surviving group is unaffected.
    await expect(registry).toHaveAttribute("data-left-size", "300");
  });

  test("a native DOM id alone does not opt a panel into lookup", async ({
    page,
  }) => {
    // The id renders on the DOM node…
    await expect(page.locator("#dom-only-panel")).toHaveCount(1);

    // …but the panel is absent from the group registry and unaddressable.
    const registry = page.getByTestId("identity-registry");
    await expect
      .poll(async () =>
        JSON.parse((await registry.getAttribute("data-left-keys"))!),
      )
      .toEqual(["shared"]);

    const probe = page.getByTestId("probe-dom-only-actions");
    await probe.click();
    expect(JSON.parse((await probe.getAttribute("data-result"))!)).toEqual({
      applied: false,
      reason: "not-found",
    });
  });

  test("changing a group's groupId re-resolves locator lookups", async ({
    page,
  }) => {
    const probe = page.getByTestId("dynamic-probe");
    await expect(probe).toHaveAttribute("data-alpha", "220");
    await expect(probe).toHaveAttribute("data-beta", "missing");

    await page.getByTestId("rename-dynamic-group").click();
    await expect(probe).toHaveAttribute("data-alpha", "missing");
    await expect(probe).toHaveAttribute("data-beta", "220");
  });
});
