import { expect, type Page, test } from "@playwright/test";

type StorageState = {
  active: number;
  calls: number;
  maxActive: number;
  stored: Record<string, number>;
  writes: Array<{
    id: number;
    key: string;
    primarySize: number;
    status: "pending" | "resolved" | "rejected";
  }>;
};

type WriteState = {
  a: StorageState;
  b: StorageState;
  errors: string[];
};

async function inspect(page: Page): Promise<WriteState> {
  const button = page.getByTestId("inspect-write-storage");
  await button.evaluate((element: HTMLButtonElement) => element.click());
  return JSON.parse((await button.getAttribute("data-state")) ?? "null");
}

async function click(page: Page, testId: string): Promise<void> {
  await page
    .getByTestId(testId)
    .evaluate((element: HTMLButtonElement) => element.click());
}

async function prepare(page: Page) {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto("/test/persistence-write-lifecycle");
  // Let the mount-time baseline write complete synchronously before deferring
  // the writes exercised by each test.
  await page.waitForTimeout(250);
  await click(page, "arm-writes");
}

test.describe("persistence write lifecycle", () => {
  test.beforeEach(async ({ page }) => prepare(page));

  test("serializes writes so an older adapter call must finish before the latest starts", async ({
    page,
  }) => {
    await click(page, "set-primary-200");
    await expect
      .poll(async () => (await inspect(page)).a.writes.length)
      .toBe(1);

    await click(page, "set-primary-300");
    await page.waitForTimeout(250);
    let state = await inspect(page);
    expect(state.a.writes.map((write) => write.primarySize)).toEqual([200]);
    expect(state.a.maxActive).toBe(1);
    await click(page, "resolve-oldest-write");
    await expect
      .poll(async () => (await inspect(page)).a.writes.length)
      .toBe(2);
    state = await inspect(page);
    expect(state.a.writes.map((write) => write.primarySize)).toEqual([
      200, 300,
    ]);
    expect(state.a.stored["layout-a"]).toBe(200);
    await click(page, "resolve-newest-write");
    await expect
      .poll(async () => (await inspect(page)).a.stored["layout-a"])
      .toBe(300);
    expect((await inspect(page)).a.maxActive).toBe(1);
  });

  test("coalesces a slow queue to one active and the latest pending layout", async ({
    page,
  }) => {
    await click(page, "set-primary-200");
    await expect
      .poll(async () => (await inspect(page)).a.writes.length)
      .toBe(1);
    await click(page, "set-primary-250");
    await page.waitForTimeout(250);
    await click(page, "set-primary-300");
    await page.waitForTimeout(250);

    expect(
      (await inspect(page)).a.writes.map((write) => write.primarySize),
    ).toEqual([200]);
    await click(page, "resolve-oldest-write");
    await expect
      .poll(async () => (await inspect(page)).a.writes.length)
      .toBe(2);
    const state = await inspect(page);
    expect(state.a.writes.map((write) => write.primarySize)).toEqual([
      200, 300,
    ]);
    expect(state.a.maxActive).toBe(1);
    await click(page, "resolve-newest-write");
    await expect
      .poll(async () => (await inspect(page)).a.stored["layout-a"])
      .toBe(300);
  });

  test("flushes the latest captured layout when the group unmounts", async ({
    page,
  }) => {
    await click(page, "set-primary-420");
    await click(page, "unmount-write-group");

    await expect
      .poll(async () => (await inspect(page)).a.writes.length)
      .toBe(1);
    expect((await inspect(page)).a.writes[0]).toMatchObject({
      key: "layout-a",
      primarySize: 420,
      status: "pending",
    });
    await click(page, "resolve-oldest-write");
    await expect
      .poll(async () => (await inspect(page)).a.stored["layout-a"])
      .toBe(420);
    expect((await inspect(page)).a.calls).toBe(1);
  });

  test("isolates queues when the persistence key changes", async ({ page }) => {
    await click(page, "set-primary-200");
    await expect
      .poll(async () => (await inspect(page)).a.writes.length)
      .toBe(1);

    await click(page, "change-write-key");
    await expect
      .poll(async () => (await inspect(page)).a.writes.length)
      .toBe(2);
    let state = await inspect(page);
    expect(state.a.writes).toMatchObject([
      { key: "layout-a", primarySize: 200, status: "pending" },
      { key: "layout-b", primarySize: 200, status: "pending" },
    ]);
    expect(state.a.active).toBe(2);

    await click(page, "set-primary-300");
    state = await inspect(page);
    expect(state.a.writes).toHaveLength(2);
    await click(page, "resolve-oldest-write");
    await click(page, "resolve-oldest-write");
    await expect
      .poll(async () => (await inspect(page)).a.writes.length)
      .toBe(3);
    await click(page, "resolve-newest-write");
    await expect
      .poll(async () => (await inspect(page)).a.stored["layout-b"])
      .toBe(300);
    expect((await inspect(page)).a.stored["layout-a"]).toBe(200);
  });

  test("isolates queues when the storage adapter changes", async ({ page }) => {
    await click(page, "set-primary-200");
    await expect
      .poll(async () => (await inspect(page)).a.writes.length)
      .toBe(1);

    await click(page, "change-write-storage");
    await expect
      .poll(async () => (await inspect(page)).b.writes.length)
      .toBe(1);
    expect((await inspect(page)).a.active).toBe(1);
    expect((await inspect(page)).b.active).toBe(1);

    await click(page, "set-primary-300");
    await click(page, "resolve-oldest-write");
    await expect
      .poll(async () => (await inspect(page)).b.writes.length)
      .toBe(2);
    await click(page, "resolve-newest-write");
    await expect
      .poll(async () => (await inspect(page)).b.stored["layout-a"])
      .toBe(300);
    expect((await inspect(page)).a.stored["layout-a"]).toBe(200);
  });

  test("reports one write failure and recovers with the latest pending layout", async ({
    page,
  }) => {
    await click(page, "set-primary-200");
    await expect
      .poll(async () => (await inspect(page)).a.writes.length)
      .toBe(1);
    await click(page, "set-primary-300");
    await click(page, "reject-oldest-write");

    await expect
      .poll(async () => (await inspect(page)).errors)
      .toEqual(["write:layout-a:a:layout-a:write failed"]);
    await expect
      .poll(async () => (await inspect(page)).a.writes.length)
      .toBe(2);
    await click(page, "resolve-newest-write");
    await expect
      .poll(async () => (await inspect(page)).a.stored["layout-a"])
      .toBe(300);
    expect((await inspect(page)).errors).toHaveLength(1);
  });
});
