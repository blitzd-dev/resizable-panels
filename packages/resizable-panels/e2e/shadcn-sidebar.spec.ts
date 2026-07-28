import { expect, type Locator, test } from "@playwright/test";

const SIDEBAR_ID = "shadcn-sidebar";
const COLLAPSED_SIZE = 48;

async function renderedWidth(panel: Locator): Promise<number> {
  return panel.evaluate((node) => node.getBoundingClientRect().width);
}

test.describe("Shadcn sidebar rapid sliding", () => {
  test("rapid reversals keep live pointer travel direct", async ({ page }) => {
    await page.goto("/demos/shadcn-sidebar");

    const panel = page.locator(
      `[data-resizable-panels-panel-id="${SIDEBAR_ID}"]`,
    );
    const sidebar = panel.locator('[data-slot="sidebar"]');
    const handle = page.locator(
      `[data-resizable-panels-resize-handle][data-before-panel="${SIDEBAR_ID}"]`,
    );

    await expect(panel).toHaveAttribute("data-state", "expanded");
    await expect(sidebar).toHaveAttribute("data-state", "expanded");
    await expect.poll(() => renderedWidth(panel)).toBeGreaterThanOrEqual(180);

    const expandedHandleBox = await handle.boundingBox();
    if (!expandedHandleBox) throw new Error("Shadcn resize handle not found");
    const expandedX = expandedHandleBox.x + expandedHandleBox.width / 2;
    const expandedY = expandedHandleBox.y + expandedHandleBox.height / 2;

    // Establish the real 48px icon rail through the same threshold drag a
    // user performs. This deliberately does not use the Shadcn toggle.
    await page.mouse.move(expandedX, expandedY);
    await page.mouse.down();
    await page.mouse.move(expandedX - 175, expandedY);
    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");
    await expect(sidebar).toHaveAttribute("data-collapsible", "icon");
    await page.mouse.up();
    await expect
      .poll(() => renderedWidth(panel))
      .toBeCloseTo(COLLAPSED_SIZE, 0);

    const railHandleBox = await handle.boundingBox();
    if (!railHandleBox) throw new Error("Collapsed Shadcn handle not found");
    const railX = railHandleBox.x + railHandleBox.width / 2;
    const railY = railHandleBox.y + railHandleBox.height / 2;

    await page.mouse.move(railX, railY);
    await page.mouse.down();

    // Rapidly cross the open/closed boundary several times in one pointer
    // capture. None of these state assertions waits for presentation motion
    // to settle, so every move interrupts the previous one.
    await page.mouse.move(railX + 160, railY);
    await expect(panel).toHaveAttribute("data-state", "expanded");
    await expect(sidebar).toHaveAttribute("data-state", "expanded");
    await page.mouse.move(railX, railY);
    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");
    await page.mouse.move(railX + 180, railY);
    await expect(panel).toHaveAttribute("data-state", "expanded");
    await expect(sidebar).toHaveAttribute("data-state", "expanded");
    await page.mouse.move(railX, railY);
    await expect(panel).toHaveAttribute("data-state", "collapsed");
    await expect(sidebar).toHaveAttribute("data-state", "collapsed");
    await page.mouse.move(railX + 180, railY);
    await expect(panel).toHaveAttribute("data-state", "expanded");
    await expect(sidebar).toHaveAttribute("data-state", "expanded");

    // The final open has only just begun; the rail must still be travelling
    // toward its 228px cursor target when responsiveness is sampled.
    await page.waitForTimeout(40);
    const inFlightWidth = await renderedWidth(panel);
    expect(inFlightWidth).toBeGreaterThan(COLLAPSED_SIZE);
    expect(inFlightWidth).toBeLessThan(220);

    await page.evaluate(
      ({ expectedTarget, panelId }) => {
        const panelNode = document.querySelector(
          `[data-resizable-panels-panel-id="${panelId}"]`,
        );
        const handleNode = document.querySelector(
          `[data-resizable-panels-resize-handle][data-before-panel="${panelId}"]`,
        );
        if (!(panelNode instanceof HTMLElement) || !handleNode) {
          throw new Error("Shadcn responsiveness nodes not found");
        }

        const testWindow = window as typeof window & {
          __shadcnRapidSlideMeasurement?: {
            after: number | null;
            before: number | null;
          };
        };
        const measurement = {
          after: null as number | null,
          before: null as number | null,
        };
        testWindow.__shadcnRapidSlideMeasurement = measurement;

        document.addEventListener(
          "pointermove",
          () => {
            measurement.before = panelNode.getBoundingClientRect().width;
          },
          { capture: true, once: true },
        );

        // aria-valuenow changes with the canonical cursor-derived size. Read
        // presentation geometry in that exact commit rather than waiting for
        // the animation to catch up and hiding input lag.
        const observer = new MutationObserver(() => {
          if (handleNode.getAttribute("aria-valuenow") !== expectedTarget) {
            return;
          }
          measurement.after = panelNode.getBoundingClientRect().width;
          observer.disconnect();
        });
        observer.observe(handleNode, {
          attributeFilter: ["aria-valuenow"],
          attributes: true,
        });
      },
      { expectedTarget: "268", panelId: SIDEBAR_ID },
    );

    const pointerStep = 40;
    await page.mouse.move(railX + 180 + pointerStep, railY);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window as typeof window & {
                __shadcnRapidSlideMeasurement?: {
                  after: number | null;
                  before: number | null;
                };
              }
            ).__shadcnRapidSlideMeasurement?.after ?? null,
        ),
      )
      .not.toBeNull();

    const measurement = await page.evaluate(
      () =>
        (
          window as typeof window & {
            __shadcnRapidSlideMeasurement?: {
              after: number | null;
              before: number | null;
            };
          }
        ).__shadcnRapidSlideMeasurement,
    );
    expect(measurement?.before).not.toBeNull();
    expect(measurement?.after).not.toBeNull();
    expect(
      (measurement?.after ?? 0) - (measurement?.before ?? 0),
    ).toBeGreaterThanOrEqual(pointerStep - 2);

    await page.mouse.up();
    await expect.poll(() => renderedWidth(panel)).toBeCloseTo(268, 0);
    await expect(handle).toHaveAttribute("aria-valuenow", "268");
    await expect(panel).toHaveAttribute("data-state", "expanded");
    await expect(sidebar).toHaveAttribute("data-state", "expanded");
  });
});
