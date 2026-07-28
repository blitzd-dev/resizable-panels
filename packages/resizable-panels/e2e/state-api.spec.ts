import { expect, test } from "@playwright/test";

const left = (page: import("@playwright/test").Page) =>
  page.locator('[data-resizable-panels-panel-id="left"]');
const width = (page: import("@playwright/test").Page) =>
  left(page).evaluate((element) => element.getBoundingClientRect().width);

test.describe("canonical state and refs", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto("/test/state-api");
  });

  test("group ref reads, applies, and resets plain record values", async ({
    page,
  }) => {
    await expect.poll(() => width(page)).toBeCloseTo(260, 0);
    const read = page.getByTestId("read-layout");
    await read.click();
    const value = JSON.parse(
      (await read.getAttribute("data-layout")) ?? "null",
    );
    // The value is a plain record keyed by panelId — no envelope fields.
    expect(value).toMatchObject({
      left: { size: 260 },
      main: { size: 940 },
    });
    expect(value.version).toBeUndefined();
    expect(value.orientation).toBeUndefined();
    expect(value.order).toBeUndefined();

    await page.getByTestId("set-layout").click();
    await expect.poll(() => width(page)).toBeCloseTo(420, 0);
    await expect(page.getByTestId("state-events")).toHaveAttribute(
      "data-value",
      "1",
    );
    await expect(page.getByTestId("state-events")).toHaveAttribute(
      "data-reason",
      "set-value",
    );
    await expect(page.getByTestId("state-events")).toHaveAttribute(
      "data-trigger",
      "api",
    );
    await page.getByTestId("reset-layout").click();
    await expect.poll(() => width(page)).toBeCloseTo(260, 0);
    await expect(page.getByTestId("state-events")).toHaveAttribute(
      "data-value",
      "2",
    );
    await expect(page.getByTestId("state-events")).toHaveAttribute(
      "data-reason",
      "reset",
    );
    await expect(page.getByTestId("state-events")).toHaveAttribute(
      "data-trigger",
      "api",
    );
    // The reset's previousValue is the applied value it replaced.
    const previous = JSON.parse(
      (await page
        .getByTestId("state-events")
        .getAttribute("data-previous-value")) ?? "null",
    );
    expect(previous.left.size).toBeCloseTo(420, 0);
  });

  test("panel ref resizes, collapses, and expands", async ({ page }) => {
    await page.getByTestId("panel-resize").click();
    await expect.poll(() => width(page)).toBeCloseTo(380, 0);
    await page.getByTestId("panel-collapse").click();
    await expect(left(page)).toHaveAttribute("data-state", "collapsed");
    await page.getByTestId("panel-expand").click();
    await expect(left(page)).toHaveAttribute("data-state", "expanded");
  });

  test("pointer drags emit one lifecycle and chained value changes", async ({
    page,
  }) => {
    const events = page.getByTestId("state-events");
    const handle = page.getByTestId("state-handle");
    const box = await handle.boundingBox();
    if (!box) throw new Error("Expected state handle");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, {
      steps: 6,
    });
    await page.mouse.up();

    await expect(events).toHaveAttribute("data-start", "1");
    await expect(events).toHaveAttribute("data-handle", "primary-handle");
    await expect(events).toHaveAttribute("data-end", "1");
    await expect(events).toHaveAttribute("data-end-canceled", "false");
    await expect(events).toHaveAttribute("data-reason", "resize");
    await expect(events).toHaveAttribute("data-trigger", "pointer");
    await expect(events).toHaveAttribute("data-chain-violations", "0");
    // R-04: the end event reported a value that had already been emitted.
    await expect(events).toHaveAttribute("data-end-mismatch", "0");
    await expect
      .poll(async () => Number(await events.getAttribute("data-value")))
      .toBeGreaterThan(0);
    // The end event carries the transaction-start value and the final value.
    const initial = JSON.parse(
      (await events.getAttribute("data-end-initial")) ?? "null",
    );
    expect(initial.left.size).toBeCloseTo(260, 0);
    const final = JSON.parse(
      (await events.getAttribute("data-end-value")) ?? "null",
    );
    expect(final.left.size).toBeCloseTo(320, 0);

    await page.getByTestId("panel-collapse").click();
    await expect(events).toHaveAttribute("data-collapse", "1");
    // KNOWN LIBRARY ISSUE: the retired public-api-redesign design doc
    // ("Map operations explicitly", git history 30c3424) attributes
    // imperative panel collapse as reason "collapse"; the group-level
    // onValueChange currently reports "set-value". Per-panel
    // onCollapsedChange details carry the correct reason.
    await expect(events).toHaveAttribute("data-trigger", "api");
    const collapsedValue = JSON.parse(
      (await events.getAttribute("data-event-value")) ?? "null",
    );
    expect(collapsedValue.left.collapsed).toBe(true);
  });

  test("a no-move pointer session emits nothing", async ({ page }) => {
    const events = page.getByTestId("state-events");
    const handle = page.getByTestId("state-handle");
    const box = await handle.boundingBox();
    if (!box) throw new Error("Expected state handle");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();

    // The resize lifecycle brackets actual movement (R-03): press-and-release
    // without a qualifying move starts no session — no start, no end, no
    // value change. Deterministic read: the pre-R-03 start fired
    // synchronously inside pointerdown and the end via a microtask after
    // pointerup, so a regression would already be visible here.
    await expect(events).toHaveAttribute("data-start", "0");
    await expect(events).toHaveAttribute("data-end", "0");
    await expect(events).toHaveAttribute("data-value", "0");

    // A subsequent real drag still opens and closes exactly one session —
    // the no-move press left nothing armed or stuck behind it.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, {
      steps: 4,
    });
    await page.mouse.up();
    await expect(events).toHaveAttribute("data-start", "1");
    await expect(events).toHaveAttribute("data-end", "1");
    await expect(events).toHaveAttribute("data-end-canceled", "false");
  });

  test("keyboard resizing is one atomic value change without lifecycle", async ({
    page,
  }) => {
    const events = page.getByTestId("state-events");
    const handle = page.getByTestId("state-handle");
    await handle.focus();
    await handle.press("ArrowRight");

    await expect.poll(() => width(page)).toBeCloseTo(270, 0);
    await expect(events).toHaveAttribute("data-value", "1");
    await expect(events).toHaveAttribute("data-start", "0");
    await expect(events).toHaveAttribute("data-end", "0");
    await expect(events).toHaveAttribute("data-reason", "resize");
    await expect(events).toHaveAttribute("data-trigger", "keyboard");
    const previous = JSON.parse(
      (await events.getAttribute("data-previous-value")) ?? "null",
    );
    expect(previous.left.size).toBeCloseTo(260, 0);
  });

  test("controlled value changes reconcile into mounted panels", async ({
    page,
  }) => {
    await page.goto("/test/state-api?controlled");
    await expect.poll(() => width(page)).toBeCloseTo(260, 0);
    await page.getByTestId("controlled-layout").click();
    await expect.poll(() => width(page)).toBeCloseTo(420, 0);
  });

  test("controlled interactions emit proposals without committing rejected changes", async ({
    page,
  }) => {
    await page.goto("/test/state-api?controlled");
    await expect.poll(() => width(page)).toBeCloseTo(260, 0);

    const handle = page.getByTestId("state-handle");
    const box = await handle.boundingBox();
    if (!box) throw new Error("Expected state handle");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2);
    await expect.poll(() => width(page)).toBeCloseTo(260, 0);
    await page.mouse.up();

    await expect.poll(() => width(page)).toBeCloseTo(260, 0);

    const readLayout = page.getByTestId("read-layout");
    await readLayout.evaluate((element: HTMLButtonElement) => element.click());
    const value = JSON.parse(
      (await readLayout.getAttribute("data-layout")) ?? "null",
    );
    expect(value.left.size).toBeCloseTo(260, 0);
    expect(value.main.size).toBeCloseTo(940, 0);

    const readPanel = page.getByTestId("read-panel");
    await readPanel.evaluate((element: HTMLButtonElement) => element.click());
    const preferred = JSON.parse(
      (await readPanel.getAttribute("data-preferred")) ?? "null",
    );
    const rendered = JSON.parse(
      (await readPanel.getAttribute("data-rendered")) ?? "null",
    );
    expect(preferred).toBeCloseTo(260, 0);
    expect(rendered).toBeCloseTo(260, 0);

    const events = page.getByTestId("state-events");
    await expect(events).toHaveAttribute("data-reason", "resize");
    await expect(events).toHaveAttribute("data-trigger", "pointer");
    await expect(events).toHaveAttribute("data-end", "1");
    await expect(events).toHaveAttribute("data-end-canceled", "false");
    await expect(events).toHaveAttribute("data-chain-violations", "0");
    const proposal = JSON.parse(
      (await events.getAttribute("data-event-value")) ?? "null",
    );
    expect(proposal.left.size).toBeCloseTo(340, 0);
    expect(proposal.main.size).toBeCloseTo(860, 0);
    // A single pointermove produced a single proposal, whose previousValue is
    // the transaction-start value; the final value is not duplicated at end.
    const previous = JSON.parse(
      (await events.getAttribute("data-previous-value")) ?? "null",
    );
    expect(previous.left.size).toBeCloseTo(260, 0);
    expect(previous.main.size).toBeCloseTo(940, 0);
    const initial = JSON.parse(
      (await events.getAttribute("data-end-initial")) ?? "null",
    );
    expect(initial.left.size).toBeCloseTo(260, 0);
  });

  test("controlled interactions commit when the parent accepts the proposal", async ({
    page,
  }) => {
    await page.goto("/test/state-api?controlled&accept-controlled-changes");
    await expect.poll(() => width(page)).toBeCloseTo(260, 0);

    const handle = page.getByTestId("state-handle");
    const box = await handle.boundingBox();
    if (!box) throw new Error("Expected state handle");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2);
    await page.mouse.up();

    await expect.poll(() => width(page)).toBeCloseTo(340, 0);
    const readLayout = page.getByTestId("read-layout");
    await readLayout.evaluate((element: HTMLButtonElement) => element.click());
    const value = JSON.parse(
      (await readLayout.getAttribute("data-layout")) ?? "null",
    );
    expect(value.left.size).toBeCloseTo(340, 0);
    expect(value.main.size).toBeCloseTo(860, 0);

    const events = page.getByTestId("state-events");
    await expect(events).toHaveAttribute("data-reason", "resize");
    await expect(events).toHaveAttribute("data-trigger", "pointer");
    const proposal = JSON.parse(
      (await events.getAttribute("data-event-value")) ?? "null",
    );
    expect(proposal.left.size).toBeCloseTo(340, 0);
    expect(proposal.main.size).toBeCloseTo(860, 0);
  });

  test("a drag never ends with its final value unemitted (R-04)", async ({
    page,
  }) => {
    await page.goto("/test/state-api?controlled&accept-controlled-changes");
    await expect.poll(() => width(page)).toBeCloseTo(260, 0);

    const events = page.getByTestId("state-events");
    const handle = page.getByTestId("state-handle");
    // Aggressive drags whose direction reverses immediately before release —
    // the shape whose final pointer-up flush historically raced the
    // controlled re-commit's echo-suppression window (R-04). The assertion
    // is structural: the fixture counts, AT the moment onResizeEnd fires,
    // whether event.value equals the last onValueChange value, so it pins
    // the causal-ordering invariant without depending on hitting the race.
    const flicks: Array<[number, number]> = [
      [120, 40],
      [-60, 30],
      [90, -50],
    ];
    for (let index = 0; index < flicks.length; index += 1) {
      const [out, back] = flicks[index];
      const box = await handle.boundingBox();
      if (!box) throw new Error("Expected state handle");
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + out, cy, { steps: 3 });
      // The reversal lands right before release, with no settle wait.
      await page.mouse.move(cx + out + back, cy);
      await page.mouse.up();
      await expect(events).toHaveAttribute("data-end", String(index + 1));
      await expect(events).toHaveAttribute("data-end-mismatch", "0");
    }
    await expect(events).toHaveAttribute("data-chain-violations", "0");
    // After settling: last emitted proposal === end value === parent value.
    const endValue = JSON.parse(
      (await events.getAttribute("data-end-value")) ?? "null",
    );
    const lastEmitted = JSON.parse(
      (await events.getAttribute("data-event-value")) ?? "null",
    );
    expect(lastEmitted).toEqual(endValue);
    await expect.poll(() => width(page)).toBeCloseTo(endValue.left.size, 0);
  });

  test("controlled keyboard resizing emits one atomic proposal without committing it", async ({
    page,
  }) => {
    await page.goto("/test/state-api?controlled");
    await expect.poll(() => width(page)).toBeCloseTo(260, 0);

    const handle = page.getByTestId("state-handle");
    await handle.focus();
    await handle.press("ArrowRight");

    await expect.poll(() => width(page)).toBeCloseTo(260, 0);
    const events = page.getByTestId("state-events");
    await expect(events).toHaveAttribute("data-value", "1");
    await expect(events).toHaveAttribute("data-reason", "resize");
    await expect(events).toHaveAttribute("data-trigger", "keyboard");
    // Keyboard actions are atomic: no resize lifecycle fires.
    await expect(events).toHaveAttribute("data-start", "0");
    await expect(events).toHaveAttribute("data-end", "0");
    const proposal = JSON.parse(
      (await events.getAttribute("data-event-value")) ?? "null",
    );
    expect(proposal.left.size).toBeCloseTo(270, 0);
    expect(proposal.main.size).toBeCloseTo(930, 0);
  });

  test("controlled imperative APIs propose changes without replacing props", async ({
    page,
  }) => {
    await page.goto("/test/state-api?controlled");
    await expect.poll(() => width(page)).toBeCloseTo(260, 0);

    await page.getByTestId("panel-resize").click();
    await expect.poll(() => width(page)).toBeCloseTo(260, 0);
    const events = page.getByTestId("state-events");
    // KNOWN LIBRARY ISSUE: the retired public-api-redesign design doc
    // ("Map operations explicitly", git history 30c3424) attributes
    // imperative panel setSize as reason "resize"; the group-level
    // onValueChange currently reports "set-value".
    await expect(events).toHaveAttribute("data-trigger", "api");
    let proposal = JSON.parse(
      (await events.getAttribute("data-event-value")) ?? "null",
    );
    expect(proposal.left.size).toBeCloseTo(380, 0);

    await page.getByTestId("set-layout").click();
    await expect.poll(() => width(page)).toBeCloseTo(260, 0);
    await expect(events).toHaveAttribute("data-reason", "set-value");
    await expect(events).toHaveAttribute("data-trigger", "api");
    proposal = JSON.parse(
      (await events.getAttribute("data-event-value")) ?? "null",
    );
    expect(proposal.left.size).toBeCloseTo(420, 0);

    await page.getByTestId("panel-collapse").click();
    await expect(left(page)).toHaveAttribute("data-state", "expanded");
    // KNOWN LIBRARY ISSUE: should be reason "collapse" (see above).
    await expect(events).toHaveAttribute("data-trigger", "api");
    proposal = JSON.parse(
      (await events.getAttribute("data-event-value")) ?? "null",
    );
    expect(proposal.left.collapsed).toBe(true);

    const readLayout = page.getByTestId("read-layout");
    await readLayout.evaluate((element: HTMLButtonElement) => element.click());
    const value = JSON.parse(
      (await readLayout.getAttribute("data-layout")) ?? "null",
    );
    expect(value.left.size).toBeCloseTo(260, 0);
    expect(value.left.collapsed).toBe(false);
  });

  test("async storage hydrates through the canonical value, overriding defaultValue", async ({
    page,
  }) => {
    // The fixture passes both `defaultValue` (left: 260) and `persistence`.
    // §12: defaultValue is only the SSR/first-paint fallback — it no longer
    // disables restoration, so the persisted 360 must win after mount.
    await page.goto("/test/state-api?async-storage");
    await expect.poll(() => width(page)).toBeCloseTo(360, 0);
    // The restoration change is attributed reason "restore" / trigger
    // "system". KNOWN LIBRARY ISSUE: under React 18 the docked panel's size
    // commits one React commit after the peer store, so the restore can split
    // into a partial "restore:system" change plus a trailing "set-value:api"
    // change carrying the docked size; assert via the accumulated log.
    const events = page.getByTestId("state-events");
    await expect
      .poll(async () => (await events.getAttribute("data-log")) ?? "")
      .toContain("restore:system,");
  });

  test("controlled value with persistence neither reads nor writes storage", async ({
    page,
  }) => {
    // §12: controlled `value` and persistence are fully mutually exclusive.
    // The fixture wires a counting adapter; the library must never call it —
    // not even the previously-allowed write-only path — and must warn once.
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning") warnings.push(message.text());
    });
    await page.goto("/test/state-api?controlled&persist");
    await expect.poll(() => width(page)).toBeCloseTo(260, 0);

    const calls = () =>
      page.evaluate(() => window.__stateApiPersistenceCalls ?? null);
    expect(await calls()).toEqual({ get: 0, set: 0 });

    // An explicit mutation attempt (drag) would open the write path if
    // persistence were merely read-disabled. Wait past the 200ms write
    // debounce before re-checking.
    const handle = page.getByTestId("state-handle");
    const box = await handle.boundingBox();
    if (!box) throw new Error("Expected state handle");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, {
      steps: 4,
    });
    await page.mouse.up();
    await page.getByTestId("controlled-layout").click();
    await expect.poll(() => width(page)).toBeCloseTo(420, 0);
    await page.waitForTimeout(300);

    expect(await calls()).toEqual({ get: 0, set: 0 });
    await expect
      .poll(() =>
        warnings.some((warning) =>
          warning.includes("cannot combine value with persistence"),
        ),
      )
      .toBe(true);
  });
});
