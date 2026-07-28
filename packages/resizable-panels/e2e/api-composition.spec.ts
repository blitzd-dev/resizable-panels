import { expect, type Page, test } from "@playwright/test";

const panelWidth = (page: Page) =>
  page
    .locator('[data-resizable-panels-panel-id="left"]')
    .evaluate((element) => element.getBoundingClientRect().width);

const peerWidth = (page: Page) =>
  page
    .locator('[data-resizable-panels-panel-id="main"]')
    .evaluate((element) => element.getBoundingClientRect().width);

test.describe("public API composition", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1_200, height: 800 });
  });

  test("separates DOM refs from imperative refs and forwards native props", async ({
    page,
  }) => {
    await page.goto("/test/api-composition");
    const probe = page.getByTestId("probe-api");
    await probe.click();

    for (const attribute of [
      "data-group-dom",
      "data-group-api",
      "data-panel-dom",
      "data-panel-api",
      "data-handle-dom",
    ]) {
      await expect(probe).toHaveAttribute(attribute, "true");
    }
    await expect(page.locator("#composition-group")).toHaveAttribute(
      "data-consumer-group",
      "yes",
    );
    await expect(page.locator("#left")).toHaveAttribute(
      "data-consumer-panel",
      "yes",
    );
    await expect(page.locator("#left")).toHaveAttribute(
      "aria-label",
      "Consumer navigation",
    );
    await expect(page.locator("#left")).toHaveClass("consumer-panel-root");
    await expect(page.locator("#left")).toHaveCSS("color", "rgb(1, 2, 3)");
    for (const [id, kind] of [
      ["left", "docked"],
      ["main", "peer"],
    ] as const) {
      const root = page.locator(`#${id}`);
      const viewport = root.locator(
        `:scope > [data-resizable-panels-panel-viewport][title="${kind} viewport"]`,
      );
      const content = viewport.locator(
        `:scope > [data-resizable-panels-panel-content][title="${kind} content"]`,
      );
      await expect(viewport).toHaveCount(1);
      await expect(content).toHaveCount(1);
      await expect(content).toContainText(id === "left" ? "left" : "main");
    }
    await page.locator("#left").click();
    await expect(page.getByTestId("composition-events")).toHaveAttribute(
      "data-clicked",
      "true",
    );
  });

  test("returns explicit results consistently across handle, hook, and layout actions", async ({
    page,
  }) => {
    await page.goto("/test/api-composition");
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning") warnings.push(message.text());
    });
    const probe = page.getByTestId("probe-action-results");
    await probe.click();

    const result = async (name: string) =>
      JSON.parse((await probe.getAttribute(`data-${name}`)) ?? "null");
    // Results are authoritative: applied/unchanged branches always report
    // the actual accepted value, and size actions report `constrained`.
    expect(await result("handle-applied")).toEqual({
      applied: true,
      value: 260,
      constrained: false,
    });
    expect(await result("hook-applied")).toEqual({
      applied: true,
      value: 280,
      constrained: false,
    });
    expect(await result("unchanged")).toEqual({
      applied: false,
      reason: "unchanged",
      value: 280,
      constrained: false,
    });
    expect(await result("invalid")).toEqual({
      applied: false,
      reason: "invalid-size",
    });
    // Strict SizeSpec grammar (§13): nonzero string sizes require units, so
    // the previously-tolerated bare "240" is rejected without mutation, and
    // the dev warning must carry the fix (both accepted forms).
    expect(await result("invalid-unitless")).toEqual({
      applied: false,
      reason: "invalid-size",
    });
    await expect
      .poll(() =>
        warnings.some(
          (warning) =>
            warning.includes("has no unit") && warning.includes('"240px"'),
        ),
      )
      .toBe(true);
    expect(await result("not-collapsible")).toEqual({
      applied: false,
      reason: "not-collapsible",
    });
    expect(await result("disabled")).toEqual({
      applied: false,
      reason: "disabled",
    });
    expect(await result("not-found")).toEqual({
      applied: false,
      reason: "not-found",
    });
    // reset restores declarative defaults (defaultSize 240, expanded) and
    // reports the reconciled PanelValue; a follow-up reset is `unchanged`
    // but still carries the current value.
    expect(await result("reset")).toEqual({
      applied: true,
      value: { size: 240, collapsed: false },
    });
    expect(await result("reset-unchanged")).toEqual({
      applied: false,
      reason: "unchanged",
      value: { size: 240, collapsed: false },
    });
  });

  test("imperative APIs accept SizeSpec and report pixel sizes", async ({
    page,
  }) => {
    await page.goto("/test/api-composition");
    await page.getByTestId("panel-resize-percent").click();
    await expect.poll(() => panelWidth(page)).toBeCloseTo(300, 0);

    const events = page.getByTestId("composition-events");
    await expect
      .poll(async () => {
        const value = await events.getAttribute("data-resize");
        return value ? JSON.parse(value) : null;
      })
      .toMatchObject({
        size: 300,
        details: { reason: "resize", trigger: "api" },
      });

    const read = page.getByTestId("read-size-snapshot");
    await read.click();
    expect(
      JSON.parse((await read.getAttribute("data-preferred")) ?? "null"),
    ).toBeCloseTo(300, 0);
    expect(
      JSON.parse((await read.getAttribute("data-rendered")) ?? "null"),
    ).toBeCloseTo(300, 0);

    await page.getByTestId("layout-resize-calc").click();
    await expect.poll(() => panelWidth(page)).toBeCloseTo(250, 0);
  });

  test("resizes the only peer by transferring available space to its docked sibling", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto("/test/api-composition?single-peer-resize");

    await expect.poll(() => panelWidth(page)).toBeCloseTo(200, 0);
    await expect.poll(() => peerWidth(page)).toBeCloseTo(400, 0);

    const clickResult = async (testId: string) => {
      const button = page.getByTestId(testId);
      await button.click();
      return JSON.parse((await button.getAttribute("data-result")) ?? "null");
    };

    // Full application: the cascade absorbs the whole request, so the
    // result reports the request verbatim and no constraint.
    const applied = await clickResult("peer-resize-300");
    await expect.poll(() => panelWidth(page)).toBeCloseTo(300, 0);
    await expect.poll(() => peerWidth(page)).toBeCloseTo(300, 0);
    expect(applied).toMatchObject({ applied: true, constrained: false });
    expect(applied.value).toBeCloseTo(300, 0);

    // The docked sibling is already at maxSize, so the peer request clamps to
    // the remaining group space instead of creating an allocator/DOM gap. The
    // result must report the true outcome: nothing changed, constrained.
    const rejected = await clickResult("peer-resize-100");
    await expect.poll(() => panelWidth(page)).toBeCloseTo(300, 0);
    await expect.poll(() => peerWidth(page)).toBeCloseTo(300, 0);
    expect(rejected).toMatchObject({
      applied: false,
      reason: "unchanged",
      constrained: true,
    });
    expect(rejected.value).toBeCloseTo(300, 0);

    // §10 headline: the inverse request clamps when the docked sibling
    // reaches minSize, and the result value is the AUTHORITATIVE partial
    // size the cascade actually applied (500), not the local clamp (600).
    const partial = await clickResult("peer-resize-600");
    await expect.poll(() => panelWidth(page)).toBeCloseTo(100, 0);
    await expect.poll(() => peerWidth(page)).toBeCloseTo(500, 0);
    expect(partial).toMatchObject({ applied: true, constrained: true });
    expect(partial.value).toBeCloseTo(500, 0);
    expect((await panelWidth(page)) + (await peerWidth(page))).toBeCloseTo(
      600,
      0,
    );

    const read = page.getByTestId("read-peer-size-snapshot");
    await read.click();
    const preferred = JSON.parse(
      (await read.getAttribute("data-preferred")) ?? "null",
    );
    const rendered = JSON.parse(
      (await read.getAttribute("data-rendered")) ?? "null",
    );
    const value = JSON.parse((await read.getAttribute("data-value")) ?? "null");
    expect(preferred).toBeCloseTo(500, 0);
    expect(rendered).toEqual(preferred);
    expect(value).toMatchObject({
      left: { size: 100 },
      main: { size: 500 },
    });
  });

  test("group dispatcher commands read, apply, and reset group values", async ({
    page,
  }) => {
    await page.goto("/test/api-composition");
    await expect.poll(() => panelWidth(page)).toBeCloseTo(240, 0);

    const probe = page.getByTestId("probe-group-commands");
    await probe.click();
    const result = async (name: string) =>
      JSON.parse((await probe.getAttribute(`data-${name}`)) ?? "null");
    expect((await result("before")).left.size).toBeCloseTo(240, 0);
    // The synchronous result value can lag one React commit for docked-only
    // changes (documented in panel-group.tsx); assert the application via
    // `applied` plus the rendered width below.
    expect(await result("applied")).toMatchObject({ applied: true });
    expect(await result("missing-set")).toEqual({
      applied: false,
      reason: "not-found",
    });
    expect(await result("missing-get")).toBeNull();
    await expect.poll(() => panelWidth(page)).toBeCloseTo(320, 0);

    const again = page.getByTestId("probe-group-commands-again");
    await again.click();
    const resultAgain = async (name: string) =>
      JSON.parse((await again.getAttribute(`data-${name}`)) ?? "null");
    expect(await resultAgain("unchanged")).toMatchObject({
      applied: false,
      reason: "unchanged",
      value: { left: { size: 320 } },
    });
    expect(await resultAgain("reset")).toMatchObject({ applied: true });
    expect(await resultAgain("missing-reset")).toEqual({
      applied: false,
      reason: "not-found",
    });
    await expect.poll(() => panelWidth(page)).toBeCloseTo(240, 0);
  });

  test("imperative APIs maximize and reject invalid sizes without mutation", async ({
    page,
  }) => {
    await page.goto("/test/api-composition");

    await page.getByTestId("panel-maximize").click();
    await expect.poll(() => panelWidth(page)).toBeCloseTo(500, 0);

    await page.getByTestId("layout-resize-calc").click();
    await expect.poll(() => panelWidth(page)).toBeCloseTo(250, 0);
    await page.getByTestId("layout-maximize").click();
    await expect.poll(() => panelWidth(page)).toBeCloseTo(500, 0);

    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning") warnings.push(message.text());
    });
    await page.getByTestId("layout-invalid-number").click();
    await page.getByTestId("layout-invalid-string").click();
    await expect.poll(() => panelWidth(page)).toBeCloseTo(500, 0);
    await expect
      .poll(() =>
        warnings.some((warning) =>
          warning.includes("must resolve to a finite number"),
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        warnings.some((warning) => warning.includes('unexpected "not-a-size"')),
      )
      .toBe(true);
  });

  for (const cursorBehavior of ["global", "handle", "none"] as const) {
    test(`cursorBehavior=${cursorBehavior} scopes cursor side effects`, async ({
      page,
    }) => {
      await page.goto(`/test/api-composition?cursor=${cursorBehavior}`);
      const handle = page.getByTestId("composition-handle");
      const box = await handle.boundingBox();
      if (!box) throw new Error("Expected composition handle");
      await page.evaluate(() => {
        document.body.style.cursor = "wait";
      });

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();

      await expect
        .poll(() => page.evaluate(() => document.body.style.userSelect))
        .toBe("none");
      await expect
        .poll(() => page.evaluate(() => document.body.style.cursor))
        .toBe(cursorBehavior === "global" ? "col-resize" : "wait");
      await expect
        .poll(() => handle.evaluate((element) => element.style.cursor))
        .toBe(cursorBehavior === "none" ? "" : "col-resize");

      await page.mouse.up();
      await expect
        .poll(() => page.evaluate(() => document.body.style.cursor))
        .toBe("wait");
    });
  }
});
