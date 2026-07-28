import { expect, test } from "@playwright/test";

const specialIds = ["__proto__", "constructor", "prototype"];

test.describe("prototype-sensitive panel ids", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto("/test/special-ids");
  });

  test("registers special ids while anonymous panels stay absent from the registry", async ({
    page,
  }) => {
    const registry = page.getByTestId("registry");
    await expect(registry).toHaveAttribute("data-all-own", "true");
    await expect(registry).toHaveAttribute("data-empty-own", "false");
    await expect
      .poll(async () => JSON.parse((await registry.getAttribute("data-keys"))!))
      .toEqual(specialIds);

    for (const id of specialIds) {
      await expect(
        page.locator(`[data-resizable-panels-panel-id="${id}"]`).first(),
      ).toBeVisible();
    }
  });

  test("round-trips special ids through group refs and persistence", async ({
    page,
  }) => {
    await page.getByTestId("apply-layout").click();
    const read = page.getByTestId("read-layout");
    await read.click();

    const layout = JSON.parse((await read.getAttribute("data-layout"))!);
    expect(Object.keys(layout)).toEqual(specialIds);
    expect(Object.hasOwn(layout, "__proto__")).toBe(true);
    expect(layout.__proto__.size).toBeCloseTo(220, 0);
    expect(layout.constructor.size).toBeGreaterThan(0);
    expect(layout.prototype.size).toBeCloseTo(180, 0);

    await expect
      .poll(async () =>
        page.getByTestId("stored-layout").getAttribute("data-layout"),
      )
      .not.toBe("");
    const stored = JSON.parse(
      (await page.getByTestId("stored-layout").getAttribute("data-layout"))!,
    );
    expect(stored.version).toBe(1);
    expect(stored.orientation).toBe("horizontal");
    expect(stored.order).toBeUndefined();
    expect(Object.keys(stored.panels)).toEqual(specialIds);
    expect(Object.hasOwn(stored.panels, "__proto__")).toBe(true);
  });

  test("keeps repeated panelIds isolated per group across removal and re-registration", async ({
    page,
  }) => {
    // The registries expose per-group control facts: minSize resolves to 80
    // in the primary group and to the peer default 0 in the duplicate group,
    // so the shared local panelId "constructor" provably resolves per group.
    const registry = page.getByTestId("registry");
    await expect(registry).toHaveAttribute("data-constructor-min-size", "80");
    await expect(registry).toHaveAttribute(
      "data-duplicate-constructor-min-size",
      "0",
    );

    // Unmounting one group's `constructor` never retargets lookup to the
    // other group's panel with the same local panelId.
    await page.getByTestId("remove-primary-constructor").click();
    await expect(registry).toHaveAttribute(
      "data-constructor-min-size",
      "missing",
    );
    await expect(registry).toHaveAttribute(
      "data-duplicate-constructor-min-size",
      "0",
    );

    await page.getByTestId("restore-primary-constructor").click();
    await expect(registry).toHaveAttribute("data-constructor-min-size", "80");

    await page.getByTestId("remove-duplicate-constructor").click();
    await expect(registry).toHaveAttribute(
      "data-duplicate-constructor-min-size",
      "missing",
    );
    await expect(registry).toHaveAttribute("data-constructor-min-size", "80");
    await expect(registry).toHaveAttribute("data-all-own", "true");
  });
});
