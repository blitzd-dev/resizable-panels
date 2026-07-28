import { expect, type Page, test } from "@playwright/test";

const primary = (page: Page) =>
  page.locator('[data-resizable-panels-panel-id="primary"]');

const primarySize = (page: Page, axis: "width" | "height" = "width") =>
  primary(page).evaluate(
    (element, dimension) => element.getBoundingClientRect()[dimension],
    axis,
  );

async function readLayout(page: Page) {
  const button = page.getByTestId("read-hydration-layout");
  await button.evaluate((element: HTMLButtonElement) => element.click());
  return JSON.parse((await button.getAttribute("data-layout")) ?? "null");
}

async function inspectStorage(page: Page) {
  const button = page.getByTestId("inspect-hydration-storage");
  await button.evaluate((element: HTMLButtonElement) => element.click());
  return {
    reads: JSON.parse((await button.getAttribute("data-reads")) ?? "[]"),
    writes: JSON.parse((await button.getAttribute("data-writes")) ?? "[]"),
    pending: JSON.parse((await button.getAttribute("data-pending")) ?? "null"),
    status: JSON.parse((await button.getAttribute("data-status")) ?? "[]"),
  } as {
    reads: string[];
    writes: string[];
    pending: { a: string[]; b: string[] };
    status: string[];
  };
}

test.describe("persistence hydration lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto("/test/hydration-lifecycle");
    await expect.poll(() => primarySize(page)).toBeCloseTo(240, 0);
  });

  test("a user resize wins over a delayed hydration completion", async ({
    page,
  }) => {
    const handle = page.getByTestId("hydration-handle");
    const box = await handle.boundingBox();
    if (!box) throw new Error("Expected hydration handle");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2);
    await page.mouse.up();
    await expect.poll(() => primarySize(page)).toBeCloseTo(360, 0);
    expect((await inspectStorage(page)).writes).toEqual([]);

    await page.getByTestId("resolve-a-layout-a").click();
    await page.waitForTimeout(50);

    await expect.poll(() => primarySize(page)).toBeCloseTo(360, 0);
    const layout = await readLayout(page);
    expect(layout.primary.size).toBeCloseTo(360, 0);
    const events = page.getByTestId("hydration-events");
    await expect(events).toHaveAttribute("data-reason", "resize");
    await expect(events).toHaveAttribute("data-trigger", "pointer");
    const callbackValue = JSON.parse(
      (await events.getAttribute("data-value")) ?? "null",
    );
    expect(callbackValue.primary.size).toBeCloseTo(360, 0);
    await expect
      .poll(async () => {
        const entry = (await inspectStorage(page)).writes.find((write) =>
          write.startsWith("a:layout-a:"),
        );
        return entry?.slice("a:layout-a:".length) ?? null;
      })
      .not.toBeNull();
    const write = (await inspectStorage(page)).writes.find((entry) =>
      entry.startsWith("a:layout-a:"),
    );
    const persisted = JSON.parse(write?.slice("a:layout-a:".length) ?? "null");
    expect(persisted.panels.primary.size).toBeCloseTo(360, 0);
  });

  test("async restore reports restoring immediately and ready exactly once, per identity", async ({
    page,
  }) => {
    // Mount: the deferred read is pending, so the group is `restoring` and
    // not yet `ready` — even under StrictMode's double-invoked effects the
    // report happens exactly once.
    expect((await inspectStorage(page)).status).toEqual(["restoring:layout-a"]);

    await page.getByTestId("resolve-a-layout-a").click();
    await expect.poll(() => primarySize(page)).toBeCloseTo(320, 0);
    expect((await inspectStorage(page)).status).toEqual([
      "restoring:layout-a",
      "ready:layout-a",
    ]);

    // A key change is a new persistence identity: the restore cycle re-runs
    // for the new key, again exactly once.
    await page.getByTestId("change-hydration-key").click();
    await expect
      .poll(async () => (await inspectStorage(page)).status)
      .toEqual(["restoring:layout-a", "ready:layout-a", "restoring:layout-b"]);

    await page.getByTestId("resolve-a-layout-b").click();
    await expect.poll(() => primarySize(page)).toBeCloseTo(420, 0);
    expect((await inspectStorage(page)).status).toEqual([
      "restoring:layout-a",
      "ready:layout-a",
      "restoring:layout-b",
      "ready:layout-b",
    ]);
  });

  test("a completion from an obsolete key generation cannot apply", async ({
    page,
  }) => {
    await page.getByTestId("change-hydration-key").click();
    await expect
      .poll(async () => (await inspectStorage(page)).reads)
      .toEqual(["a:layout-a", "a:layout-b"]);

    await page.getByTestId("resolve-a-layout-a").click();
    await page.waitForTimeout(50);
    await expect.poll(() => primarySize(page)).toBeCloseTo(240, 0);
    expect((await readLayout(page)).primary.size).toBeCloseTo(240, 0);

    await page.getByTestId("resolve-a-layout-b").click();
    await expect.poll(() => primarySize(page)).toBeCloseTo(420, 0);
    expect((await readLayout(page)).primary.size).toBeCloseTo(420, 0);
    await expect(page.getByTestId("hydration-events")).toHaveAttribute(
      "data-reason",
      "restore",
    );
    await expect(page.getByTestId("hydration-events")).toHaveAttribute(
      "data-trigger",
      "system",
    );
  });

  test("key, storage, and orientation changes each hydrate their current identity", async ({
    page,
  }) => {
    await page.getByTestId("resolve-a-layout-a").click();
    await expect.poll(() => primarySize(page)).toBeCloseTo(320, 0);

    await page.getByTestId("change-hydration-key").click();
    await expect
      .poll(async () => (await inspectStorage(page)).reads)
      .toContain("a:layout-b");
    await page.getByTestId("resolve-a-layout-b").click();
    await expect.poll(() => primarySize(page)).toBeCloseTo(420, 0);
    expect((await readLayout(page)).primary.size).toBeCloseTo(420, 0);

    await page.getByTestId("change-hydration-storage").click();
    await expect
      .poll(async () => (await inspectStorage(page)).reads)
      .toContain("b:layout-b");
    await page.getByTestId("resolve-b-layout-b").click();
    await expect.poll(() => primarySize(page)).toBeCloseTo(480, 0);
    expect((await readLayout(page)).primary.size).toBeCloseTo(480, 0);

    await page.getByTestId("change-hydration-orientation").click();
    await expect
      .poll(async () => (await inspectStorage(page)).reads)
      .toEqual(["a:layout-a", "a:layout-b", "b:layout-b", "b:layout-b"]);
    await page.getByTestId("resolve-b-layout-b-vertical").click();
    await expect.poll(() => primarySize(page, "height")).toBeCloseTo(500, 0);
    await expect(
      page.locator("[data-resizable-panels-panel-group]"),
    ).toHaveAttribute("data-orientation", "vertical");
    const vertical = await readLayout(page);
    expect(vertical.primary.size).toBeCloseTo(500, 0);
    await expect(page.getByTestId("hydration-events")).toHaveAttribute(
      "data-reason",
      "restore",
    );
    await expect(page.getByTestId("hydration-events")).toHaveAttribute(
      "data-trigger",
      "system",
    );
  });
});
