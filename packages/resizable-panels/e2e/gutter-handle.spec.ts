import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * R-14 — `gutterSize` handles occupy real layout space. Contract under
 * test: (a) the handle slot consumes exactly gutterSize px and panels plus
 * gutter sum to the container, (b) pointer drags starting anywhere inside
 * the gutter — and inside the hit-area margins beyond it — resize the
 * boundary, (c) keyboard resize keeps working, and the consumer-styled
 * handle element spans exactly the gutter with the default line centered
 * in it.
 */

const GUTTER = 10;

const width = (target: Locator) =>
  target.evaluate((element) => element.getBoundingClientRect().width);

/** Σ direct children (panels AND handle slots) must equal the container —
 * the gutter-aware version of the helpers' `expectSumInvariant`. */
async function expectGutterSumInvariant(page: Page): Promise<void> {
  const group = page.locator("[data-resizable-panels-panel-group]");
  const groupBox = await group.boundingBox();
  if (!groupBox) throw new Error("Expected group");
  const children = await group.locator(":scope > *").all();
  let sum = 0;
  for (const child of children) {
    const box = await child.boundingBox();
    if (box) sum += box.width;
  }
  expect(
    sum,
    `Σ panels + gutters (${sum.toFixed(1)}) should equal container (${groupBox.width.toFixed(1)})`,
  ).toBeCloseTo(groupBox.width, 0);
}

async function dragFrom(
  page: Page,
  startX: number,
  startY: number,
  deltaX: number,
): Promise<void> {
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY, { steps: 8 });
  await page.mouse.up();
}

test.describe("gutter handles (R-14)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto("/test/gutter-handle");
  });

  test("the gutter occupies real layout space and panels + gutter sum to the container", async ({
    page,
  }) => {
    const left = page.locator('[data-resizable-panels-panel-id="left"]');
    const right = page.locator('[data-resizable-panels-panel-id="right"]');
    const slot = page.locator("[data-resizable-panels-resize-handle-slot]");

    await expect.poll(() => width(left)).toBeCloseTo(300, 0);
    await expect.poll(() => width(slot)).toBeCloseTo(GUTTER, 0);
    // The right peer receives container − left − gutter, not container − left.
    await expect.poll(() => width(right)).toBeCloseTo(1200 - 300 - GUTTER, 0);
    await expectGutterSumInvariant(page);

    // The consumer-styled handle element spans exactly the gutter box (its
    // background fills the gutter, not the pointer margins) …
    const handle = page.getByTestId("gutter-handle");
    const handleBox = await handle.boundingBox();
    const slotBox = await slot.boundingBox();
    expect(handleBox).not.toBeNull();
    expect(slotBox).not.toBeNull();
    expect(handleBox!.width).toBeCloseTo(GUTTER, 0);
    expect(handleBox!.x).toBeCloseTo(slotBox!.x, 0);
    // … and the default separator line centers in the gutter.
    const line = handle.locator("[data-resizable-panels-resize-handle-line]");
    const lineBox = await line.boundingBox();
    expect(lineBox).not.toBeNull();
    expect(lineBox!.x).toBeCloseTo(slotBox!.x + GUTTER / 2, 0);
  });

  test("dragging from anywhere inside the gutter — and its margins — resizes", async ({
    page,
  }) => {
    const left = page.locator('[data-resizable-panels-panel-id="left"]');
    const slot = page.locator("[data-resizable-panels-resize-handle-slot]");

    // Near the gutter's left edge, far from its center line.
    let box = await slot.boundingBox();
    if (!box) throw new Error("Expected handle slot");
    await dragFrom(page, box.x + 1, box.y + box.height / 2, 80);
    await expect.poll(() => width(left)).toBeCloseTo(380, 0);
    await expectGutterSumInvariant(page);

    // Inside the hit-area margin BEYOND the gutter (default fine margin is
    // 5px): the transparent hit extension, not the visible gutter box.
    box = await slot.boundingBox();
    if (!box) throw new Error("Expected handle slot");
    await dragFrom(page, box.x - 3, box.y + box.height / 2, -60);
    await expect.poll(() => width(left)).toBeCloseTo(320, 0);
    await expectGutterSumInvariant(page);
  });

  test("keyboard resize keeps working on a gutter handle", async ({ page }) => {
    const left = page.locator('[data-resizable-panels-panel-id="left"]');
    const handle = page.getByTestId("gutter-handle");

    await handle.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => width(left)).toBeCloseTo(310, 0);
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => width(left)).toBeCloseTo(290, 0);
    await expectGutterSumInvariant(page);
  });
});

// G2 (review round): when the gutters alone exceed the container the allocator
// only sees `available = max(0, container − Σgutters) = 0`, silently dropping
// `(Σgutter − container)` from the shortfall. The reported over-constraint must
// add it back: Σfloors(100+100) + Σgutter(200) − container(150) = 250, not the
// allocator's 200.
test("G2: the over-constraint shortfall includes the gutter overflow when gutters exceed the container", async ({
  page,
}) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "warning" &&
      /too small for its panels' minimum sizes/.test(message.text())
    ) {
      warnings.push(message.text());
    }
  });

  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto("/test/gutter-handle?overconstrained");

  const group = page.getByTestId("gutter-overconstrained-group");
  await expect(group).toHaveAttribute("data-overconstrained");
  await expect
    .poll(() => warnings.length, "the over-constraint warning must fire")
    .toBeGreaterThan(0);

  // Σfloors 200 + Σgutter 200 − container 150 = 250. The pre-fix arithmetic
  // reports only the allocator's 200 (it never sees the gutter overflow).
  expect(
    warnings.some((message) => /\b250px too small\b/.test(message)),
    `shortfall must be 250px (Σfloors + Σgutter − container); captured ${JSON.stringify(
      warnings,
    )}`,
  ).toBe(true);
});
