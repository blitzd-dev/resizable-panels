import { expect, test } from "@playwright/test";

test.describe("Private panel identity", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/test/identity");
  });

  test("an id-less docked panel participates fully in pointer resizing", async ({
    page,
  }) => {
    const panel = page.locator('[data-kind="docked"]');
    // Anonymous panels report no semantic identity on their handle.
    const handle = page.locator("[data-resizable-panels-resize-handle]");
    await expect(handle).not.toHaveAttribute("data-before-panel");
    const box = await handle.boundingBox();
    if (!box) throw new Error("Expected the id-less panel resize handle");

    await expect
      .poll(() => panel.evaluate((el) => el.getBoundingClientRect().width))
      .toBe(180);

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 80, y, { steps: 8 });
    await page.mouse.up();

    await expect
      .poll(() => panel.evaluate((el) => el.getBoundingClientRect().width))
      .toBe(260);
  });

  test("an automatic peer resolves without a public layout subscriber", async ({
    page,
  }) => {
    const group = page.locator("[data-resizable-panels-panel-group]");
    const docked = group.locator(':scope > [data-kind="docked"]');
    const peer = group.locator(':scope > [data-kind="peer"]');
    await expect
      .poll(async () => {
        const groupWidth = await group.evaluate(
          (node) => node.getBoundingClientRect().width,
        );
        const dockedWidth = await docked.evaluate(
          (node) => node.getBoundingClientRect().width,
        );
        const peerWidth = await peer.evaluate(
          (node) => node.getBoundingClientRect().width,
        );
        const peerBasis = await peer.evaluate((node) =>
          Number.parseFloat(getComputedStyle(node).flexBasis),
        );
        return {
          allocatedDrift: Math.abs(peerWidth - peerBasis),
          fillDrift: Math.abs(groupWidth - dockedWidth - peerWidth),
          peerWidth,
        };
      })
      .toMatchObject({
        allocatedDrift: 0,
        fillDrift: 0,
        peerWidth: 1100,
      });

    await page.setViewportSize({ width: 180, height: 800 });
    await expect
      .poll(() =>
        peer.evaluate((node) =>
          Number.parseFloat(getComputedStyle(node).flexBasis),
        ),
      )
      .toBeLessThan(0.01);
    await page.setViewportSize({ width: 676, height: 800 });
    await expect
      .poll(() =>
        peer.evaluate((node) =>
          Number.parseFloat(getComputedStyle(node).flexBasis),
        ),
      )
      .toBeCloseTo(496, 0);
  });

  test("a percentage docked default does not become its minimum during initialization", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 190, height: 800 });
    await page.goto("/test/identity?percentage");
    await page.waitForTimeout(30);
    await page.setViewportSize({ width: 676, height: 800 });
    const group = page.locator("[data-resizable-panels-panel-group]");
    const docked = group.locator(':scope > [data-kind="docked"]');
    await expect
      .poll(async () => {
        const groupWidth = await group.evaluate(
          (node) => node.getBoundingClientRect().width,
        );
        const dockedWidth = await docked.evaluate(
          (node) => node.getBoundingClientRect().width,
        );
        return dockedWidth / groupWidth;
      })
      .toBeCloseTo(0.18, 3);
  });

  test("an id-less docked panel supports keyboard resizing", async ({
    page,
  }) => {
    const panel = page.locator('[data-kind="docked"]');
    // Anonymous panels report no semantic identity on their handle.
    const handle = page.locator("[data-resizable-panels-resize-handle]");
    await expect(handle).not.toHaveAttribute("data-before-panel");

    await handle.focus();
    await page.keyboard.press("ArrowRight");

    await expect
      .poll(() => panel.evaluate((el) => el.getBoundingClientRect().width))
      .toBe(190);
  });
});
