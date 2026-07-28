import { expect, type Page, test } from "@playwright/test";

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

async function readLayout(page: Page) {
  const button = page.getByTestId("read-content-box-layout");
  await button.click();
  return JSON.parse((await button.getAttribute("data-layout")) ?? "null");
}

for (const orientation of ["horizontal", "vertical"] as const) {
  const expectedPanelSize = orientation === "horizontal" ? 260 : 150;
  const resizedFirst = expectedPanelSize + 10;
  const resizedSecond = expectedPanelSize - 10;

  test(`${orientation} sizing allocates the group content box`, async ({
    page,
  }) => {
    await page.goto(
      `/test/content-box-measurement${
        orientation === "vertical" ? "?vertical" : ""
      }`,
    );

    await expect
      .poll(() => panelSize(page, "first", orientation))
      .toBeCloseTo(expectedPanelSize, 0);
    await expect
      .poll(() => panelSize(page, "second", orientation))
      .toBeCloseTo(expectedPanelSize, 0);

    let layout = await readLayout(page);
    expect(layout.first.size).toBeCloseTo(expectedPanelSize, 0);
    expect(layout.second.size).toBeCloseTo(expectedPanelSize, 0);

    const handle = page.getByTestId("content-box-handle");
    await expect(handle).toHaveAttribute(
      "aria-valuenow",
      String(expectedPanelSize),
    );
    await expect(handle).toHaveAttribute(
      "aria-valuetext",
      `${expectedPanelSize} pixels before, ${expectedPanelSize} pixels after`,
    );

    await handle.focus();
    await handle.press(
      orientation === "horizontal" ? "ArrowRight" : "ArrowDown",
    );
    await expect
      .poll(() => panelSize(page, "first", orientation))
      .toBeCloseTo(resizedFirst, 0);
    await expect
      .poll(() => panelSize(page, "second", orientation))
      .toBeCloseTo(resizedSecond, 0);

    layout = await readLayout(page);
    expect(layout.first.size).toBeCloseTo(resizedFirst, 0);
    expect(layout.second.size).toBeCloseTo(resizedSecond, 0);

    await expect
      .poll(() =>
        page.evaluate((key) => {
          const raw = localStorage.getItem(key);
          return raw ? JSON.parse(raw) : null;
        }, `content-box-${orientation}`),
      )
      .toMatchObject({
        orientation,
        panels: {
          first: { size: resizedFirst },
          second: { size: resizedSecond },
        },
      });

    await page.getByTestId("reset-content-box-layout").click();
    await expect
      .poll(() => panelSize(page, "first", orientation))
      .toBeCloseTo(expectedPanelSize, 0);
    layout = await readLayout(page);
    expect(layout.first.size).toBeCloseTo(expectedPanelSize, 0);
    expect(layout.second.size).toBeCloseTo(expectedPanelSize, 0);
  });
}

test("computed-style fallback allocates both physical content-box axes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeResizeObserver = window.ResizeObserver;
    window.ResizeObserver = function ResizeObserverWithoutBoxSizes(
      callback: ResizeObserverCallback,
    ) {
      const observer = new NativeResizeObserver((entries) => {
        callback(
          entries.map(
            (entry) =>
              new Proxy(entry, {
                get(target, property) {
                  if (
                    property === "contentBoxSize" ||
                    property === "contentRect"
                  ) {
                    return undefined;
                  }
                  return Reflect.get(target, property, target);
                },
              }),
          ),
          replacement,
        );
      });
      const replacement = {
        observe: (target: Element, options?: ResizeObserverOptions) =>
          observer.observe(target, options),
        unobserve: (target: Element) => observer.unobserve(target),
        disconnect: () => observer.disconnect(),
      } as ResizeObserver;
      return replacement;
    } as unknown as typeof ResizeObserver;
  });

  await page.goto("/test/content-box-measurement");
  await expect
    .poll(() => panelSize(page, "first", "horizontal"))
    .toBeCloseTo(260, 0);
  const layout = await readLayout(page);
  expect(layout.first.size).toBeCloseTo(260, 0);
  expect(layout.second.size).toBeCloseTo(260, 0);

  await page.goto("/test/content-box-measurement?vertical");
  await expect
    .poll(() => panelSize(page, "first", "vertical"))
    .toBeCloseTo(150, 0);
  const verticalLayout = await readLayout(page);
  expect(verticalLayout.first.size).toBeCloseTo(150, 0);
  expect(verticalLayout.second.size).toBeCloseTo(150, 0);
});
