import { expect, type Locator, type Page, test } from "@playwright/test";

const panel = (page: Page, id: string) =>
  page.locator(`[data-resizable-panels-panel-id="${id}"]`);

async function transition(locator: Locator) {
  return locator.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      duration: computed.transitionDuration,
      property: computed.transitionProperty,
    };
  });
}

test.describe("collapsed accessibility and reduced motion", () => {
  test("server markup is inert before hydration and hydrates without warnings", async ({
    page,
  }) => {
    await page.goto("/test/accessibility-motion-ssr?hydrate=0");
    for (const id of ["ssr-docked", "ssr-peer"]) {
      const collapsed = panel(page, id);
      await expect(collapsed).toHaveAttribute("inert", /^(|true)$/);
      await expect(collapsed).toHaveAttribute("aria-hidden", "true");
    }
    for (const testId of ["ssr-docked-action", "ssr-peer-action"]) {
      const action = page.getByTestId(testId);
      await action.evaluate((button) => button.focus());
      await expect(action).not.toBeFocused();
    }

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

    await page.goto("/test/accessibility-motion-ssr?hydrate=0&collapsed=0");
    for (const id of ["ssr-docked", "ssr-peer"]) {
      const expanded = panel(page, id);
      await expect(expanded).not.toHaveAttribute("inert", /^(|true)$/);
      await expect(expanded).not.toHaveAttribute("aria-hidden", "true");
    }
    await page.getByTestId("ssr-docked-action").focus();
    await expect(page.getByTestId("ssr-docked-action")).toBeFocused();
  });

  test("zero-size collapsed content is inert and expanded content is focusable", async ({
    page,
  }) => {
    await page.goto("/test/accessibility-motion");

    await page
      .getByRole("button", { name: "collapse docked", exact: true })
      .click();
    const docked = panel(page, "motion-docked");
    await expect(docked).toHaveAttribute("inert", /^(|true)$/);
    await expect(docked).toHaveAttribute("aria-hidden", "true");
    await page
      .getByTestId("docked-action")
      .evaluate((button) => button.focus());
    await expect(page.getByTestId("docked-action")).not.toBeFocused();

    await page
      .getByRole("button", { name: "expand docked", exact: true })
      .click();
    await expect(docked).not.toHaveAttribute("inert", /^(|true)$/);
    await page.getByTestId("docked-action").focus();
    await expect(page.getByTestId("docked-action")).toBeFocused();

    await page
      .getByRole("button", { name: "collapse peer", exact: true })
      .click();
    const peer = panel(page, "motion-peer");
    await expect(peer).toHaveAttribute("inert", /^(|true)$/);
    await page.getByTestId("peer-action").evaluate((button) => button.focus());
    await expect(page.getByTestId("peer-action")).not.toBeFocused();
  });

  test("normal motion retains library transitions", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/test/accessibility-motion");

    await expect
      .poll(() => transition(panel(page, "motion-docked")))
      .toEqual({
        duration: "0.3s",
        property: "width",
      });
    await expect
      .poll(() => transition(panel(page, "motion-peer")))
      .toEqual({
        // The collapsible peer animates flex-basis AND its min floor on the
        // same curve (F1), so both appear in the transition shorthand.
        duration: "0.3s, 0.3s",
        property: "flex-basis, min-width",
      });
  });

  test("reduced motion disables docked and collapsible-peer transitions", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/test/accessibility-motion");

    for (const id of ["motion-docked", "motion-peer"]) {
      await expect
        .poll(() => transition(panel(page, id)))
        .toEqual({
          duration: "0s",
          property: "none",
        });
    }

    await page
      .getByRole("button", { name: "collapse docked", exact: true })
      .click();
    await expect(panel(page, "motion-docked")).toHaveAttribute(
      "data-state",
      "collapsed",
    );
    await expect
      .poll(() =>
        panel(page, "motion-docked").evaluate(
          (node) => node.getAnimations().length,
        ),
      )
      .toBe(0);

    await page
      .getByRole("button", { name: "collapse peer", exact: true })
      .click();
    await expect(panel(page, "motion-peer")).toHaveAttribute(
      "data-state",
      "collapsed",
    );
    await expect
      .poll(() =>
        panel(page, "motion-peer").evaluate(
          (node) => node.getAnimations().length,
        ),
      )
      .toBe(0);
  });

  test("reduced motion preserves live pointer resizing and snaps threshold collapse", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/test/accessibility-motion");

    const docked = panel(page, "motion-docked");
    const dockedHandle = page.getByTestId("motion-docked-handle");
    const dockedHandleBox = await dockedHandle.boundingBox();
    if (!dockedHandleBox) throw new Error("Expected docked resize handle");
    const dockedStart = await docked.evaluate(
      (node) => node.getBoundingClientRect().width,
    );
    const dockedX = dockedHandleBox.x + dockedHandleBox.width / 2;
    const dockedY = dockedHandleBox.y + dockedHandleBox.height / 2;
    await page.mouse.move(dockedX, dockedY);
    await page.mouse.down();
    await page.mouse.move(dockedX + 40, dockedY);
    await expect
      .poll(() => docked.evaluate((node) => node.getBoundingClientRect().width))
      .toBeCloseTo(dockedStart + 40, 0);
    await page.mouse.up();

    const peer = panel(page, "motion-peer");
    const peerHandle = page.getByTestId("motion-peer-handle");
    const peerHandleBox = await peerHandle.boundingBox();
    if (!peerHandleBox) throw new Error("Expected peer resize handle");
    const peerX = peerHandleBox.x + peerHandleBox.width / 2;
    const peerY = peerHandleBox.y + peerHandleBox.height / 2;
    await page.mouse.move(peerX, peerY);
    await page.mouse.down();
    await page.mouse.move(peerX - 260, peerY);
    await expect(peer).toHaveAttribute("data-state", "collapsed");
    await expect
      .poll(() => peer.evaluate((node) => node.getBoundingClientRect().width))
      .toBeCloseTo(0, 0);
    await page.mouse.up();
    await expect
      .poll(() => peer.evaluate((node) => node.getAnimations().length))
      .toBe(0);
  });

  test("responds to runtime preference changes and preserves instant actions", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/test/accessibility-motion");
    const docked = panel(page, "motion-docked");
    await expect
      .poll(() => transition(docked))
      .toEqual({
        duration: "0.3s",
        property: "width",
      });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect
      .poll(() => transition(docked))
      .toEqual({
        duration: "0s",
        property: "none",
      });

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect
      .poll(() => transition(docked))
      .toEqual({
        duration: "0.3s",
        property: "width",
      });
    await docked.evaluate((node) => {
      node.setAttribute("data-transition-ran", "false");
      node.addEventListener(
        "transitionrun",
        () => node.setAttribute("data-transition-ran", "true"),
        { once: true },
      );
    });
    await page
      .getByRole("button", { name: "collapse docked immediately", exact: true })
      .click();
    await expect(docked).toHaveAttribute("data-state", "collapsed");
    await page.waitForTimeout(350);
    await expect(docked).toHaveAttribute("data-transition-ran", "false");
  });
});
