import { expect, type Page, test } from "@playwright/test";

const panel = (page: Page, id: string) =>
  page.locator(`[data-resizable-panels-panel-id="${id}"]`);

const width = (page: Page, id: string) =>
  panel(page, id).evaluate((element) => element.getBoundingClientRect().width);

async function dragSeamAfter(page: Page, id: string, delta: number) {
  const handle = page.locator(
    `[data-resizable-panels-panel-id="${id}"] + [data-resizable-panels-resize-handle-slot] [data-resizable-panels-resize-handle]`,
  );
  const box = await handle.boundingBox();
  if (!box) throw new Error(`Expected a peer seam after ${id}`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + delta, y, { steps: 8 });
  await page.mouse.up();
}

test.describe("Dynamic panel order", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto("/test/dynamic-order");
  });

  test("inserting a keyed peer wires separators to its visual neighbors", async ({
    page,
  }) => {
    await page.getByTestId("insert-b").click();
    await expect(panel(page, "b")).toBeVisible();
    const probe = page.getByTestId("order-probe");
    await probe.dispatchEvent("click");
    await expect(probe).toHaveAttribute("data-order", "a,b,c");

    const beforeA = await width(page, "a");
    const beforeB = await width(page, "b");
    const beforeC = await width(page, "c");
    await dragSeamAfter(page, "a", 60);

    await expect
      .poll(async () => (await width(page, "a")) - beforeA)
      .toBeGreaterThan(40);
    await expect
      .poll(async () => beforeB - (await width(page, "b")))
      .toBeGreaterThan(40);
    await expect.poll(() => width(page, "c")).toBeCloseTo(beforeC, 0);
  });

  test("reordering mounted peers updates separator adjacency", async ({
    page,
  }) => {
    await page.getByTestId("insert-b").click();
    await page.getByTestId("reorder").click();

    await expect
      .poll(() =>
        page
          .locator(
            "[data-resizable-panels-panel-group] > [data-resizable-panels-panel]",
          )
          .evaluateAll((elements) =>
            elements.map((element) =>
              element.getAttribute("data-resizable-panels-panel-id"),
            ),
          ),
      )
      .toEqual(["c", "a", "b"]);

    const beforeC = await width(page, "c");
    const beforeA = await width(page, "a");
    const beforeB = await width(page, "b");
    await dragSeamAfter(page, "c", 50);

    await expect.poll(() => width(page, "c")).toBeCloseTo(beforeC + 50, 0);
    await expect.poll(() => width(page, "a")).toBeCloseTo(beforeA - 50, 0);
    await expect.poll(() => width(page, "b")).toBeCloseTo(beforeB, 0);
  });

  test("removing a focused separator restores focus to a nearby separator", async ({
    page,
  }) => {
    await page.getByTestId("insert-b").click();
    const handleAfterB = page.locator(
      '[data-resizable-panels-panel-id="b"] + [data-resizable-panels-resize-handle-slot] [data-resizable-panels-resize-handle]',
    );
    await handleAfterB.focus();
    await expect(handleAfterB).toBeFocused();

    await page.evaluate(() => {
      document
        .querySelector<HTMLButtonElement>('[data-testid="remove-b"]')
        ?.click();
    });

    await expect
      .poll(() =>
        page.evaluate(() =>
          document.activeElement?.hasAttribute(
            "data-resizable-panels-resize-handle",
          ),
        ),
      )
      .toBe(true);
  });

  test("reordering preserved panel and handle tokens republishes separator metadata", async ({
    page,
  }) => {
    await page.goto("/test/same-token-reorder");
    const h1 = page.getByTestId("same-token-h1");
    const h2 = page.getByTestId("same-token-h2");
    const panelId = (id: string) =>
      page
        .locator(`[data-resizable-panels-panel-id="${id}"]`)
        .getAttribute("id");

    const [a, b, c] = await Promise.all([
      panelId("a"),
      panelId("b"),
      panelId("c"),
    ]);
    if (!a || !b || !c) throw new Error("Expected panel DOM ids");
    // data attributes carry semantic panelIds; aria-controls carries DOM ids.
    await expect(h1).toHaveAttribute("data-before-panel", "a");
    await expect(h1).toHaveAttribute("data-after-panel", "b");
    await expect(h1).toHaveAttribute("aria-controls", `${a} ${b}`);
    await expect(h2).toHaveAttribute("data-before-panel", "b");
    await expect(h2).toHaveAttribute("data-after-panel", "c");

    await page.getByTestId("same-token-reorder").click();

    // No resize or other store mutation occurs after the keyed reorder. The
    // topology change itself must publish the new snapshots.
    await expect(h1).toHaveAttribute("data-before-panel", "c");
    await expect(h1).toHaveAttribute("data-after-panel", "a");
    await expect(h1).toHaveAttribute("aria-controls", `${c} ${a}`);
    await expect(h2).toHaveAttribute("data-before-panel", "a");
    await expect(h2).toHaveAttribute("data-after-panel", "b");
    await expect(h2).toHaveAttribute("aria-controls", `${a} ${b}`);
  });
});
