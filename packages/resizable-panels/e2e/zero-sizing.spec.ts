import { expect, test } from "@playwright/test";

const panel = (page: import("@playwright/test").Page, id: string) =>
  page.locator(`[data-resizable-panels-panel-id="${id}"]`);
const width = (page: import("@playwright/test").Page, id: string) =>
  panel(page, id).evaluate((element) => element.getBoundingClientRect().width);

async function readLayout(page: import("@playwright/test").Page) {
  const read = page.getByTestId("read-zero-layout");
  await read.click();
  return JSON.parse((await read.getAttribute("data-layout")) ?? "null");
}

test.describe("automatic and explicit-zero sizing", () => {
  test("reset resolves automatic peers into authoritative state", async ({
    page,
  }) => {
    await page.goto("/test/zero-sizing");
    await expect.poll(() => width(page, "first")).toBeCloseTo(300, 0);
    await expect.poll(() => width(page, "second")).toBeCloseTo(300, 0);

    await page.getByTestId("resize-first").click();
    await expect.poll(() => width(page, "first")).toBeCloseTo(200, 0);
    await expect.poll(() => width(page, "second")).toBeCloseTo(400, 0);

    await page.getByTestId("zero-handle").dblclick();
    await expect.poll(() => width(page, "first")).toBeCloseTo(300, 0);
    await expect.poll(() => width(page, "second")).toBeCloseTo(300, 0);

    await page.getByTestId("resize-first").click();
    await expect.poll(() => width(page, "first")).toBeCloseTo(200, 0);
    await expect.poll(() => width(page, "second")).toBeCloseTo(400, 0);

    await page.getByTestId("reset-zero-layout").click();
    const layout = await readLayout(page);
    const state = page.getByTestId("zero-state");
    await expect
      .poll(async () => {
        const raw = await state.getAttribute("data-storage");
        return {
          callback: JSON.parse(
            (await state.getAttribute("data-callback")) ?? "null",
          ),
          dom: [await width(page, "first"), await width(page, "second")],
          layout,
          resize: await state.getAttribute("data-resize"),
          reason: await state.getAttribute("data-reason"),
          storage: raw ? JSON.parse(raw).panels : null,
        };
      })
      .toMatchObject({
        callback: { first: { size: 300 }, second: { size: 300 } },
        dom: [300, 300],
        layout: { first: { size: 300 }, second: { size: 300 } },
        resize: "300",
        reason: "reset",
        storage: { first: { size: 300 }, second: { size: 300 } },
      });
  });

  test("explicit zero remains expanded and persists distinctly from collapsed", async ({
    page,
  }) => {
    await page.goto("/test/zero-sizing?explicit-zero");
    await expect.poll(() => width(page, "first")).toBe(0);
    await expect.poll(() => width(page, "second")).toBe(100);
    await expect(panel(page, "first")).toHaveAttribute(
      "data-state",
      "expanded",
    );

    let layout = await readLayout(page);
    expect(layout).toMatchObject({
      first: { size: 0, collapsed: false },
      second: { size: 100 },
    });

    await page.getByTestId("collapse-zero").click();
    await expect(panel(page, "first")).toHaveAttribute(
      "data-state",
      "collapsed",
    );
    await expect(page.getByTestId("zero-state")).toHaveAttribute(
      "data-collapse",
      "true",
    );
    layout = await readLayout(page);
    expect(layout.first).toEqual({ size: 0, collapsed: true });

    await page.getByTestId("expand-zero").click();
    await expect(panel(page, "first")).toHaveAttribute(
      "data-state",
      "expanded",
    );
    await expect(page.getByTestId("zero-state")).toHaveAttribute(
      "data-expand",
      "true",
    );
    await expect.poll(() => width(page, "first")).toBe(0);
    layout = await readLayout(page);
    expect(layout.first).toEqual({ size: 0, collapsed: false });

    const state = page.getByTestId("zero-state");
    await expect
      .poll(async () => {
        const raw = await state.getAttribute("data-storage");
        return raw ? JSON.parse(raw).panels.first : null;
      })
      .toEqual({ size: 0, collapsed: false });
  });

  test("an imperative zero on an automatic peer does not absorb unallocated space", async ({
    page,
  }) => {
    await page.goto("/test/zero-sizing");
    await expect.poll(() => width(page, "first")).toBeCloseTo(300, 0);
    await expect.poll(() => width(page, "second")).toBeCloseTo(300, 0);

    await page.getByTestId("zero-first").click();
    await expect.poll(() => width(page, "first")).toBeLessThan(1);
    await expect.poll(() => width(page, "second")).toBeCloseTo(600, 0);

    await page.getByTestId("grow-zero-container").click();
    await expect.poll(() => width(page, "first")).toBeLessThan(1);
    await expect.poll(() => width(page, "second")).toBeCloseTo(600, 0);
  });
});
