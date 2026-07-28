import { expect, type Page, test } from "@playwright/test";

/**
 * R-37 auto-collapse (`collapsible="auto"`) — fail-first suite (Batch 4).
 *
 * Fixture: `/test/auto-collapse`. Two auto panels (nav primary min 200 cs 48;
 * inspector trailing min 240 cs 48) + proportional main (min 300). With
 * ~0-width handles the declared floors sum to B≈740; the trailing-first
 * thresholds are Tinspector≈740 and Tnav≈548 (inspector frees 192, nav 152).
 *
 * Every test below FAILS at baseline: `collapsible="auto"` is runtime-truthy
 * so the panels behave as `collapsible={true}` and NOTHING width-driven folds.
 */

const panel = (page: Page, id: string) =>
  page.locator(`[data-resizable-panels-panel-id="${id}"]`);
const readout = (page: Page, id: string) => page.getByTestId(`readout-${id}`);
const events = (page: Page) => page.getByTestId("auto-events");

test.describe("auto-collapse: trailing-first container sweep", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 800 });
    await page.goto("/test/auto-collapse");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("folds trailing-first at thresholds and releases in reverse", async ({
    page,
  }) => {
    // Wide: nothing folded.
    await expect(panel(page, "nav")).toHaveAttribute("data-state", "expanded");
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "expanded",
    );

    // Below Tinspector but above Tnav: trailing (inspector) folds first.
    await page.setViewportSize({ width: 680, height: 800 });
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "collapsed",
    );
    await expect(panel(page, "nav")).toHaveAttribute("data-state", "expanded");

    // Below Tnav: both folded (primary folds last).
    await page.setViewportSize({ width: 440, height: 800 });
    await expect(panel(page, "nav")).toHaveAttribute("data-state", "collapsed");
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "collapsed",
    );

    // Widen back: nav (primary) releases before inspector (reverse order).
    await page.setViewportSize({ width: 680, height: 800 });
    await expect(panel(page, "nav")).toHaveAttribute("data-state", "expanded");
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "collapsed",
    );

    await page.setViewportSize({ width: 960, height: 800 });
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "expanded",
    );
  });

  test("effective readouts (data-state, rendered size, controls.collapsed) flip together", async ({
    page,
  }) => {
    await expect(readout(page, "inspector")).toHaveAttribute(
      "data-collapsed",
      "false",
    );

    await page.setViewportSize({ width: 680, height: 800 });
    await expect(readout(page, "inspector")).toHaveAttribute(
      "data-collapsed",
      "true",
    );
    // Effective rendered size collapses to the declared rail (48), not min.
    await expect
      .poll(async () =>
        Number(await readout(page, "inspector").getAttribute("data-rendered")),
      )
      .toBeLessThan(100);
  });

  test("onCollapsedChange fires {system}, edge-triggered, <= 2 events per monotone sweep", async ({
    page,
  }) => {
    // One monotone shrink crossing both thresholds: inspector then nav fold —
    // exactly one collapse event each, tagged system.
    await page.setViewportSize({ width: 440, height: 800 });
    await expect(events(page)).toHaveAttribute("data-inspector-collapse", "1");
    await expect(events(page)).toHaveAttribute("data-nav-collapse", "1");
    await expect(events(page)).toHaveAttribute(
      "data-inspector-trigger",
      "system",
    );
    // No spurious expand during a purely monotone shrink.
    await expect(events(page)).toHaveAttribute("data-inspector-expand", "0");
  });

  test("auto folds NEVER dirty persistence", async ({ page }) => {
    const before = await page.evaluate(() =>
      JSON.stringify(localStorage.getItem("auto-collapse")),
    );
    await page.setViewportSize({ width: 440, height: 800 });
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "collapsed",
    );
    await page.setViewportSize({ width: 960, height: 800 });
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "expanded",
    );
    const after = await page.evaluate(() =>
      JSON.stringify(localStorage.getItem("auto-collapse")),
    );
    expect(after).toBe(before);
  });

  test("manual expand stays open at any narrower width; resets only when space returns (OQ1)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 680, height: 800 });
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "collapsed",
    );

    // User forces it open; the override sticks at this width.
    await page.getByTestId("expand-inspector").click();
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "expanded",
    );
    // Jitter around the threshold must not re-fold it.
    await page.setViewportSize({ width: 700, height: 800 });
    await page.setViewportSize({ width: 675, height: 800 });
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "expanded",
    );

    // Owner's stays-open rule: shrinking WELL past the old band keeps it open —
    // an explicit open holds at any narrower width.
    await page.setViewportSize({ width: 500, height: 800 });
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "expanded",
    );

    // Growing back above Tⱼ resets the latch (panel fits naturally). The panel
    // is already expanded, so let the wide width actually commit (the latch
    // clears only on a measured W ≥ Tⱼ; a coalesced transient would not fit).
    await page.setViewportSize({ width: 960, height: 800 });
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "expanded",
    );
    await page.waitForTimeout(150);
    // ...so a fresh shrink re-folds by width, {collapse, system}.
    await page.setViewportSize({ width: 440, height: 800 });
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "collapsed",
    );
    await expect(events(page)).toHaveAttribute(
      "data-inspector-trigger",
      "system",
    );
  });
});

test.describe("auto-collapse: guards", () => {
  test("controlled + auto is inert and dev-warns", async ({ page }) => {
    const warnings: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "warning" || m.type() === "error")
        warnings.push(m.text());
    });
    await page.setViewportSize({ width: 680, height: 800 });
    await page.goto("/test/auto-collapse?controlled");
    // Controlled `collapsed={false}` wins: auto never folds it.
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "expanded",
    );
    await page.setViewportSize({ width: 440, height: 800 });
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "expanded",
    );
    expect(warnings.some((w) => /auto/i.test(w) && /controll/i.test(w))).toBe(
      true,
    );
  });

  test("collapsedSize:0 refuses to arm, dev-warns, and manual collapse still works", async ({
    page,
  }) => {
    const warnings: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "warning" || m.type() === "error")
        warnings.push(m.text());
    });
    await page.setViewportSize({ width: 440, height: 800 });
    await page.goto("/test/auto-collapse?zero");
    // Auto refused (cs resolves to 0): width sweep does NOT fold it.
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "expanded",
    );
    expect(
      warnings.some((w) => /auto/i.test(w) && /collapsedSize|0|zero/i.test(w)),
    ).toBe(true);
    // Falls back to collapsible={true}: manual collapse still functions.
    await page.getByTestId("collapse-inspector").click();
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "collapsed",
    );
  });
});

// Review round (Batch 4 fix): jitter stability, gradual-shrink monotonicity,
// and event attribution — the three coordination bugs the single-jump suite
// missed (F1/F2/F3).
test.describe("auto-collapse: review round (X1–X3)", () => {
  const count = (page: Page, attr: string) =>
    events(page)
      .getAttribute(attr)
      .then((v) => Number(v ?? "NaN"));

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 800 });
    await page.goto("/test/auto-collapse");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("X1 — threshold-parked ±jitter fires zero events after the initial fold", async ({
    page,
  }) => {
    // Find inspector's fold edge (the largest width, scanning down, at which it
    // folds), so we can park within a couple px of Tⱼ and jitter across it.
    await page.setViewportSize({ width: 900, height: 800 });
    let edge = 0;
    for (let w = 820; w >= 620; w -= 2) {
      await page.setViewportSize({ width: w, height: 800 });
      if (
        (await panel(page, "inspector").getAttribute("data-state")) ===
        "collapsed"
      ) {
        edge = w;
        break;
      }
    }
    expect(edge).toBeGreaterThan(0);
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "collapsed",
    );
    const c0 = await count(page, "data-inspector-collapse");
    const e0 = await count(page, "data-inspector-expand");
    // Oscillate ±a few px straddling Tⱼ (edge+3 is above Tⱼ but within the
    // 12px release band; edge-1 is below). A stateless fold rule storms here.
    for (let i = 0; i < 12; i++) {
      await page.setViewportSize({ width: edge + 3, height: 800 });
      await page.setViewportSize({ width: edge - 1, height: 800 });
    }
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "collapsed",
    );
    expect(await count(page, "data-inspector-collapse")).toBe(c0);
    expect(await count(page, "data-inspector-expand")).toBe(e0);
  });

  test("X2 — gradual 20px monotone shrink folds each panel exactly once, never un-folds", async ({
    page,
  }) => {
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "expanded",
    );
    for (let w = 960; w >= 400; w -= 20) {
      await page.setViewportSize({ width: w, height: 800 });
    }
    await expect(panel(page, "nav")).toHaveAttribute("data-state", "collapsed");
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "collapsed",
    );
    // No transient un-fold: exactly one collapse, zero expand, per panel.
    expect(await count(page, "data-inspector-collapse")).toBe(1);
    expect(await count(page, "data-inspector-expand")).toBe(0);
    expect(await count(page, "data-nav-collapse")).toBe(1);
    expect(await count(page, "data-nav-expand")).toBe(0);
  });

  test("X3 — auto fold/release report {system}; override-expand reports the user's trigger", async ({
    page,
  }) => {
    // (a) auto fold → {collapse, system}
    await page.setViewportSize({ width: 440, height: 800 });
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "collapsed",
    );
    await expect(events(page)).toHaveAttribute(
      "data-inspector-reason",
      "collapse",
    );
    await expect(events(page)).toHaveAttribute(
      "data-inspector-trigger",
      "system",
    );

    // (b) auto release → {expand, system}
    await page.setViewportSize({ width: 960, height: 800 });
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "expanded",
    );
    await expect(events(page)).toHaveAttribute(
      "data-inspector-reason",
      "expand",
    );
    await expect(events(page)).toHaveAttribute(
      "data-inspector-trigger",
      "system",
    );

    // (c) override-expand via imperative button → {expand, api}
    await page.setViewportSize({ width: 680, height: 800 });
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "collapsed",
    );
    await page.getByTestId("expand-inspector").click();
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "expanded",
    );
    await expect(events(page)).toHaveAttribute(
      "data-inspector-reason",
      "expand",
    );
    await expect(events(page)).toHaveAttribute("data-inspector-trigger", "api");

    // (d) override-expand via Enter on the handle → {expand, keyboard}
    // Reset the (c) latch by growing above Tⱼ (let the wide width commit so the
    // latch clears on a measured W ≥ Tⱼ), then re-fold by width.
    await page.setViewportSize({ width: 960, height: 800 });
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "expanded",
    );
    await page.waitForTimeout(150);
    await page.setViewportSize({ width: 440, height: 800 });
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "collapsed",
    );
    await page.getByRole("separator").nth(1).press("Enter");
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "expanded",
    );
    await expect(events(page)).toHaveAttribute(
      "data-inspector-reason",
      "expand",
    );
    await expect(events(page)).toHaveAttribute(
      "data-inspector-trigger",
      "keyboard",
    );
  });
});

// X5 authority rule: while a pointer resize session is live the auto fold set
// is FROZEN; endResize recomputes at the committed width. Fails on the pre-fix
// tree exactly as the X5 probe showed (mid-drag fold + end un-fold).
test.describe("auto-collapse: live drag × fold recompute (X5)", () => {
  const count = (page: Page, attr: string) =>
    events(page)
      .getAttribute(attr)
      .then((v) => Number(v ?? "NaN"));

  test("X5.1 — fold set frozen during a drag; folds once at release {collapse, system}", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 960, height: 800 });
    await page.goto("/test/auto-collapse");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "expanded",
    );

    // Grab inspector's handle (H1) and start a drag session.
    const handle = page.getByRole("separator").nth(1);
    const box = await handle.boundingBox();
    if (!box) throw new Error("no handle box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 30, box.y + box.height / 2, {
      steps: 5,
    });

    // Mid-drag: shrink the container below both thresholds. The fold set is
    // frozen, so nothing folds and no auto event fires while the drag is held.
    await page.setViewportSize({ width: 440, height: 800 });
    await page.waitForTimeout(60);
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "expanded",
    );
    expect(await count(page, "data-inspector-collapse")).toBe(0);
    expect(await count(page, "data-nav-collapse")).toBe(0);

    // Release: recompute at the committed (narrow) width → folds, once, system.
    await page.mouse.up();
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "collapsed",
    );
    expect(await count(page, "data-inspector-collapse")).toBe(1);
    expect(await count(page, "data-inspector-expand")).toBe(0);
    await expect(events(page)).toHaveAttribute(
      "data-inspector-reason",
      "collapse",
    );
    await expect(events(page)).toHaveAttribute(
      "data-inspector-trigger",
      "system",
    );
  });

  test("X5.2 — drag-reopening an auto-folded panel arms the override {expand, pointer}", async ({
    page,
  }) => {
    // Below Tinspector but above Tnav, so the boundary still has slack to drag.
    await page.setViewportSize({ width: 680, height: 800 });
    await page.goto("/test/auto-collapse?resizable");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    // Inspector is width-folded to its rail.
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "collapsed",
    );

    // Drag its rail outward past minSize to reopen it. Widen the hit target so
    // the pointer stays on the moving seam under parallel CI workers (same
    // approach as collapse-below-rapid-reversal).
    const handle = page.getByRole("separator").nth(1);
    await handle.evaluate((node) => {
      const el = node as HTMLElement;
      el.style.left = "-120px";
      el.style.width = "240px";
    });
    const box = await handle.boundingBox();
    if (!box) throw new Error("no handle box");
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 260, startY, { steps: 12 });
    await page.mouse.up();

    // The user's drag wins: the override is armed, so the panel stays expanded
    // at this narrow width, and the event carries the pointer trigger.
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "expanded",
    );
    await expect(events(page)).toHaveAttribute(
      "data-inspector-reason",
      "expand",
    );
    await expect(events(page)).toHaveAttribute(
      "data-inspector-trigger",
      "pointer",
    );
    // A small container jitter does not re-fold it (override holds).
    await page.setViewportSize({ width: 700, height: 800 });
    await page.setViewportSize({ width: 675, height: 800 });
    await expect(panel(page, "inspector")).toHaveAttribute(
      "data-state",
      "expanded",
    );
  });
});
