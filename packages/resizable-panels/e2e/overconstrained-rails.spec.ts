import { expect, type Page, test } from "@playwright/test";

/**
 * No-compression contract for collapsed rails (design-decisions §2.2, PLAN
 * Batch 1): a declared size is a declared size. When even the collapsed
 * rails do not fit, they keep their declared `collapsedSize`, the expanded
 * peer keeps its `minSize`, the overflow is clipped past the group's end
 * edge, and the group declares the over-constraint via
 * `data-overconstrained`. This holds at ANY container size — including 0
 * (no container-0 special case; the floors hold and the shortfall is
 * reported).
 *
 * Fixture: rails collapsedSize 80 / 40 with an expanded content peer
 * minSize 30 in a 90px group → rails render 80 / 40 (not compressed),
 * content renders 30, Σ = 150 against a 90px box.
 */

type Orientation = "horizontal" | "vertical";

const panelSize = (page: Page, id: string, orientation: Orientation) =>
  page
    .locator(`[data-resizable-panels-panel-id="${id}"]`)
    .evaluate(
      (element, axis) =>
        element.getBoundingClientRect()[
          axis === "horizontal" ? "width" : "height"
        ],
      orientation,
    );

async function readState(page: Page) {
  const button = page.getByTestId("read-overconstrained-state");
  await button.click();
  return JSON.parse((await button.getAttribute("data-snapshot")) ?? "null");
}

async function expectSizes(
  page: Page,
  orientation: Orientation,
  expected: [number, number, number],
) {
  for (const [index, id] of ["start", "content", "end"].entries()) {
    await expect
      .poll(() => panelSize(page, id, orientation))
      .toBeCloseTo(expected[index], 0);
  }
}

for (const orientation of ["horizontal", "vertical"] as const) {
  test(`${orientation} collapsed rails keep their declared sizes and the group declares the over-constraint`, async ({
    page,
  }) => {
    await page.goto(
      `/test/overconstrained-rails${
        orientation === "vertical" ? "?vertical" : ""
      }`,
    );

    // Rails hold collapsedSize 80/40; the expanded content peer holds its
    // minSize 30. Nothing is compressed.
    await expectSizes(page, orientation, [80, 30, 40]);
    const group = page.getByTestId("overconstrained-group");
    const total = async () =>
      (await panelSize(page, "start", orientation)) +
      (await panelSize(page, "content", orientation)) +
      (await panelSize(page, "end", orientation));
    await expect.poll(total).toBeCloseTo(150, 0);
    // The group's own box stays at its styled 90px — the layout overflows
    // past the end edge and is clipped.
    await expect
      .poll(() =>
        group.evaluate(
          (element, axis) =>
            element.getBoundingClientRect()[
              axis === "horizontal" ? "width" : "height"
            ],
          orientation,
        ),
      )
      .toBeCloseTo(90, 0);
    const overflow = await group.evaluate(
      (element, axis) =>
        axis === "horizontal"
          ? element.scrollWidth - element.clientWidth
          : element.scrollHeight - element.clientHeight,
      orientation,
    );
    expect(overflow, "Σ 150 in a 90px box must overflow by 60").toBeCloseTo(
      60,
      0,
    );
    await expect(group).toHaveAttribute("data-overconstrained");
    const panelStarts = await Promise.all(
      ["start", "content", "end"].map((id) =>
        page
          .locator(`[data-resizable-panels-panel-id="${id}"]`)
          .evaluate((element, axis) => {
            const rect = element.getBoundingClientRect();
            return axis === "horizontal" ? rect.left : rect.top;
          }, orientation),
      ),
    );
    // The start edge stays visible; panels keep DOM order.
    expect(panelStarts[0]).toBeLessThanOrEqual(panelStarts[1]);
    expect(panelStarts[1]).toBeLessThanOrEqual(panelStarts[2]);

    let state = await readState(page);
    // Preferred (semantic) sizes keep the stored preferences; rendered sizes
    // are truthful — the declared rail sizes, not compressed values.
    expect(state.start).toEqual({ preferred: 160, rendered: 80 });
    expect(state.content).toEqual({ preferred: 30, rendered: 30 });
    expect(state.end).toEqual({ preferred: 120, rendered: 40 });
    expect(state.layout).toMatchObject({
      start: { collapsed: true, size: 160 },
      content: { size: 30 },
      end: { collapsed: true, size: 120 },
    });
    // The handle is immovable (no space to trade) and reports the truthful
    // rendered sizes on both sides.
    await expect(page.getByTestId("start-handle")).toHaveAttribute(
      "aria-valuetext",
      "80 pixels before, 30 pixels after",
    );
    await expect(page.getByTestId("start-handle")).toHaveAttribute(
      "aria-valuemin",
      "80",
    );
    await expect(page.getByTestId("start-handle")).toHaveAttribute(
      "aria-valuenow",
      "80",
    );
    await expect(page.getByTestId("start-handle")).toHaveAttribute(
      "aria-valuemax",
      "80",
    );

    await page.getByTestId("set-roomy").click();
    await expectSizes(page, orientation, [80, 120, 40]);
    await expect.poll(total).toBeCloseTo(240, 0);
    await expect(group).not.toHaveAttribute("data-overconstrained");

    state = await readState(page);
    expect(state.start).toEqual({ preferred: 160, rendered: 80 });
    expect(state.content).toEqual({ preferred: 120, rendered: 120 });
    expect(state.end).toEqual({ preferred: 120, rendered: 40 });

    await page.getByTestId("set-tiny").click();
    await expectSizes(page, orientation, [80, 30, 40]);
    await expect.poll(total).toBeCloseTo(150, 0);
    await expect(group).toHaveAttribute("data-overconstrained");

    await expect
      .poll(() =>
        page.evaluate((key) => {
          const raw = localStorage.getItem(key);
          return raw ? JSON.parse(raw) : null;
        }, `overconstrained-rails-${orientation}`),
      )
      .toMatchObject({
        orientation,
        panels: {
          start: { collapsed: true, size: 160 },
          content: { size: 30 },
          end: { collapsed: true, size: 120 },
        },
      });

    await page.reload();
    await expectSizes(page, orientation, [80, 30, 40]);
    state = await readState(page);
    expect(state.start.rendered).toBe(80);
    expect(state.end.rendered).toBe(40);

    // No container-0 special case: floors hold at any container size and the
    // shortfall is simply larger. Rails keep 80/40, content keeps 30.
    await page.getByTestId("set-zero").click();
    await expectSizes(page, orientation, [80, 30, 40]);
    await expect.poll(total).toBeCloseTo(150, 0);
    await expect(group).toHaveAttribute("data-overconstrained");

    // Fully reversible — declared sizes and the clean state return with the
    // space.
    await page.getByTestId("set-roomy").click();
    await expectSizes(page, orientation, [80, 120, 40]);
    await expect.poll(total).toBeCloseTo(240, 0);
    await expect(group).not.toHaveAttribute("data-overconstrained");
  });
}

test("collapsed peer rails hold their declared sizes under the same contract", async ({
  page,
}) => {
  await page.goto("/test/overconstrained-rails?peer");

  await expectSizes(page, "horizontal", [80, 30, 40]);
  await expect(
    page.locator('[data-resizable-panels-panel-id="start"]'),
  ).toHaveAttribute("data-kind", "peer");
  await expect(page.getByTestId("overconstrained-group")).toHaveAttribute(
    "data-overconstrained",
  );
  const state = await readState(page);
  expect(state.start).toEqual({ preferred: 160, rendered: 80 });
  expect(state.content).toEqual({ preferred: 30, rendered: 30 });
  expect(state.end).toEqual({ preferred: 120, rendered: 40 });
});
