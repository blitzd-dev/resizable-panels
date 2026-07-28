import { expect, type Page, test } from "@playwright/test";

test.describe("cross-browser release boundaries", () => {
  test("hydrates server markup without warnings", async ({ page }) => {
    await page.goto("/test/accessibility-motion-ssr?hydrate=1");

    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.dataset.hydrated),
      )
      .toBe("true");
    expect(
      await page.evaluate(() =>
        (
          (window as unknown as { __hydrationErrors: string[] })
            .__hydrationErrors ?? []
        ).filter((message) =>
          /hydration|inert|non-boolean attribute/i.test(message),
        ),
      ),
    ).toEqual([]);
  });

  test("supports keyboard resize and exposes separator values", async ({
    page,
  }) => {
    await page.goto("/test/explicit-handle");
    const handle = page.getByTestId("explicit-handle");
    const separator = await firstSeparator(page);
    const before = Number(await separator.getAttribute("aria-valuenow"));

    await handle.focus();
    await page.keyboard.press("ArrowRight");

    await expect(separator).toHaveAttribute("role", "separator");
    await expect(separator).toHaveAttribute("aria-orientation", "vertical");
    await expect
      .poll(async () => Number(await separator.getAttribute("aria-valuenow")))
      .toBeGreaterThan(before);
  });

  test("captures a pointer drag and transfers space without changing the total", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto("/test/explicit-handle");
    const handle = page.getByTestId("explicit-handle");
    const before = await layoutWidths(page, ["left", "main"]);
    const groupBefore = await groupWidth(page);
    const box = await handle.boundingBox();
    if (!box) throw new Error("Expected explicit resize handle");

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await expect(handle).toHaveAttribute("data-active", "");
    await page.mouse.move(x + 80, y, { steps: 8 });
    await page.mouse.up();

    await expect
      .poll(async () => (await panelWidth(page, "left")) - before.left)
      .toBeCloseTo(80, 0);
    const after = await layoutWidths(page, ["left", "main"]);
    expect(after.main - before.main).toBeCloseTo(-80, 0);
    expect(after.left + after.main).toBeCloseTo(groupBefore, 0);
    expect(await groupWidth(page)).toBeCloseTo(groupBefore, 0);
  });

  test("applies ResizeObserver container changes through the flex layout", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1_200, height: 800 });
    await page.goto("/test/container-resize-policy");
    const before = await layoutWidths(page, ["nav", "editor", "preview"]);
    expect(before.nav).toBeCloseTo(240, 0);
    expect(before.nav + before.editor + before.preview).toBeCloseTo(
      await groupWidth(page),
      0,
    );

    await page.setViewportSize({ width: 900, height: 800 });

    await expect(page.getByTestId("policy-events")).toHaveAttribute(
      "data-reason",
      "container-resize",
    );
    await expect.poll(() => groupWidth(page)).toBeCloseTo(900, 0);
    await expect.poll(() => panelWidth(page, "nav")).toBeCloseTo(240, 0);
    const after = await layoutWidths(page, ["nav", "editor", "preview"]);
    expect(after.editor).toBeGreaterThan(0);
    expect(after.preview).toBeGreaterThan(0);
    expect(after.nav + after.editor + after.preview).toBeCloseTo(900, 0);
    expect(after.editor + after.preview).toBeCloseTo(
      before.editor + before.preview - 300,
      0,
    );
  });
});

async function firstSeparator(page: Page) {
  return page.getByRole("separator").first();
}

async function panelWidth(page: Page, id: string) {
  return page
    .locator(`[data-resizable-panels-panel-id="${id}"]`)
    .evaluate((element) => element.getBoundingClientRect().width);
}

async function groupWidth(page: Page) {
  return page
    .locator("[data-resizable-panels-panel-group]")
    .first()
    .evaluate((element) => element.getBoundingClientRect().width);
}

async function layoutWidths<const Id extends string>(page: Page, ids: Id[]) {
  return Object.fromEntries(
    await Promise.all(
      ids.map(async (id) => [id, await panelWidth(page, id)] as const),
    ),
  ) as Record<Id, number>;
}
