import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  clickToggle,
  dragHandle,
  dragSeam,
  expectSumInvariant,
  readContainerSize,
  readRenderedSize,
  waitForSettled,
} from "./helpers";

/**
 * Persistence tests. The route at /test/persistence wires
 * `persistence={{ key: "resizable-panels-persist-test", ... }}` on a group
 * containing two dockeds (nav, inspector) and two peers (main, aux), so a
 * single fixture covers both snapshot shapes — collapsible dockeds persist
 * `{collapsed, size}`, while non-collapsible peers persist `{size}` only.
 * The fixture records every `persistence.onStatusChange` /
 * `persistence.onError` callback on `window.__resizablePanelsPersistence`.
 *
 * Write-back is debounced 200ms inside PanelGroup (see panel-group.tsx).
 * Every mutate-then-reload sequence waits 300ms to be safe.
 */

declare global {
  interface Window {
    /** Set by the throwing-adapter variant of /test/persistence; lets us
     *  prove the lib actually invoked the adapter (i.e. we're exercising
     *  real code paths, not silently passing because nothing ran). */
    __resizablePanelsThrowCount?: { get: number; set: number };
    /** Ordered persistence lifecycle log recorded by the fixture. */
    __resizablePanelsPersistence?: {
      status: string[];
      errors: Array<{ operation: string; key: string; message: string }>;
    };
  }
}

const STORAGE_KEY = "resizable-panels-persist-test";
const WRITE_DEBOUNCE_MS = 300;

const NAV = "nav";
const MAIN = "main";
const AUX = "aux";
const INSPECTOR = "inspector";

function scope(page: Page): Locator {
  return page.locator("body");
}

function near(a: number, b: number, tolerance = 2): boolean {
  return Math.abs(a - b) <= tolerance;
}

/** Read the snapshot the group has written to localStorage. */
async function readPersisted(
  page: Page,
): Promise<Record<string, { collapsed?: boolean; size: number }> | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.panels ?? parsed;
  }, STORAGE_KEY);
}

/** Plant a raw (already-serialized or arbitrary-shape) value under a key
 *  before page scripts run. `addInitScript` survives the upcoming
 *  `page.goto`, so the group's mount-time read sees the seeded value. */
async function seedRawAt(
  page: Page,
  key: string,
  raw: string,
  where: "local" | "session" = "local",
): Promise<void> {
  await page.addInitScript(
    ({ k, v, w }) => {
      const store =
        w === "session" ? window.sessionStorage : window.localStorage;
      store.setItem(k, v);
    },
    { k: key, v: raw, w: where },
  );
}

/** Seed a snapshot of panel values under an arbitrary key, wrapped in the
 *  library's versioned storage document (`{version: 1, orientation,
 *  panels}`). Anything else is rejected by the reader. */
async function seedSnapshotAt(
  page: Page,
  key: string,
  panels: Record<string, { collapsed?: boolean; size: number }>,
  where: "local" | "session" = "local",
  orientation: "horizontal" | "vertical" = "horizontal",
): Promise<void> {
  await seedRawAt(
    page,
    key,
    JSON.stringify({ version: 1, orientation, panels }),
    where,
  );
}

/** Convenience: seed under the default route's STORAGE_KEY. */
async function seedSnapshot(
  page: Page,
  panels: Record<string, { collapsed?: boolean; size: number }>,
  where: "local" | "session" = "local",
): Promise<void> {
  await seedSnapshotAt(page, STORAGE_KEY, panels, where);
}

/** Read the fixture's ordered onStatusChange/onError log. */
async function readPersistenceLog(page: Page) {
  return page.evaluate(
    () =>
      window.__resizablePanelsPersistence ?? {
        status: [] as string[],
        errors: [] as Array<{
          operation: string;
          key: string;
          message: string;
        }>,
      },
  );
}

test.describe("Persistence — persistence.key", () => {
  test.beforeEach(async ({ page }) => {
    // Each test gets a fresh BrowserContext, so storage starts empty —
    // no init-script clear needed. (A clear would re-run on every reload
    // and wipe out the very state these tests rely on.)
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // ─── default adapter (localStorage) — live round-trip ──────────────────────

  test.describe("default adapter — live round-trip", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/test/persistence");
      await waitForSettled(scope(page));
      await page.waitForTimeout(50);
    });

    test("docked drag round-trips across reload", async ({ page }) => {
      const s = scope(page);
      await dragHandle(s, { panelId: NAV, delta: 60 });
      await waitForSettled(s);
      const before = await readRenderedSize(s, NAV);
      await page.waitForTimeout(WRITE_DEBOUNCE_MS);

      await page.reload();
      await waitForSettled(scope(page));
      const after = await readRenderedSize(scope(page), NAV);
      expect(
        near(after, before),
        `expected nav to restore to ${before}, got ${after}`,
      ).toBe(true);
      await expectSumInvariant(scope(page));
    });

    test("closed docked round-trips closed", async ({ page }) => {
      const s = scope(page);
      await clickToggle(s, INSPECTOR);
      await waitForSettled(s);
      expect(await readRenderedSize(s, INSPECTOR)).toBeLessThan(1);
      await page.waitForTimeout(WRITE_DEBOUNCE_MS);

      await page.reload();
      await waitForSettled(scope(page));
      // Still collapsed after reload.
      expect(await readRenderedSize(scope(page), INSPECTOR)).toBeLessThan(1);
      await expectSumInvariant(scope(page));
    });

    test("peer seam round-trips across reload", async ({ page }) => {
      const s = scope(page);
      await dragSeam(s, { leftPeerId: MAIN, delta: 80 });
      await waitForSettled(s);
      const mainBefore = await readRenderedSize(s, MAIN);
      const auxBefore = await readRenderedSize(s, AUX);
      await page.waitForTimeout(WRITE_DEBOUNCE_MS);

      await page.reload();
      await waitForSettled(scope(page));
      const mainAfter = await readRenderedSize(scope(page), MAIN);
      const auxAfter = await readRenderedSize(scope(page), AUX);
      // Peers absorb the container's free space, so allow a bit more slack
      // than the docked round-trip.
      expect(
        near(mainAfter, mainBefore, 4),
        `main: expected ~${mainBefore}, got ${mainAfter}`,
      ).toBe(true);
      expect(
        near(auxAfter, auxBefore, 4),
        `aux: expected ~${auxBefore}, got ${auxAfter}`,
      ).toBe(true);
      await expectSumInvariant(scope(page));
    });

    test("versioned snapshot carries collapse state and peer sizes", async ({
      page,
    }) => {
      const s = scope(page);
      await clickToggle(s, NAV);
      await waitForSettled(s);
      await dragSeam(s, { leftPeerId: MAIN, delta: 30 });
      await waitForSettled(s);
      await page.waitForTimeout(WRITE_DEBOUNCE_MS);

      const snap = await readPersisted(page);
      expect(
        snap,
        "expected a persisted snapshot in localStorage",
      ).toBeTruthy();
      if (!snap) return;

      const envelope = await page.evaluate((key) => {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      }, STORAGE_KEY);
      expect(envelope).toMatchObject({
        version: 1,
        orientation: "horizontal",
      });
      // Child order is React's; it is never persisted.
      expect(envelope).not.toHaveProperty("order");

      // Dockeds: both fields.
      expect(snap[NAV]).toMatchObject({ collapsed: true });
      expect(typeof snap[NAV].size).toBe("number");
      expect(snap[INSPECTOR]).toMatchObject({ collapsed: false });
      expect(typeof snap[INSPECTOR].size).toBe("number");

      // Non-collapsible peers: size only, no collapsed state.
      expect(typeof snap[MAIN].size).toBe("number");
      expect(typeof snap[AUX].size).toBe("number");
      expect(snap[MAIN]).not.toHaveProperty("collapsed");
      expect(snap[AUX]).not.toHaveProperty("collapsed");
    });

    test("repeated drags coalesce — only the last value persists", async ({
      page,
    }) => {
      // Three quick drags within the debounce window. The persisted value
      // should reflect the *final* rendered size, not any intermediate one.
      const s = scope(page);
      await dragHandle(s, { panelId: NAV, delta: 30, quick: true });
      await dragHandle(s, { panelId: NAV, delta: 20, quick: true });
      await dragHandle(s, { panelId: NAV, delta: -10, quick: true });
      await waitForSettled(s);
      const finalSize = await readRenderedSize(s, NAV);
      await page.waitForTimeout(WRITE_DEBOUNCE_MS);

      const snap = await readPersisted(page);
      expect(snap?.[NAV].size).toBeCloseTo(finalSize, 0);
    });
  });

  // ─── default adapter — seeded snapshots ────────────────────────────────────

  test.describe("default adapter — hydrate from seeded snapshot", () => {
    test("persisted layout is reconciled before paint without a transition", async ({
      page,
    }) => {
      await seedSnapshot(page, { [NAV]: { collapsed: false, size: 320 } });
      await page.goto("/test/persistence");
      const panel = scope(page).locator(
        `[data-resizable-panels-panel-id="${NAV}"]`,
      );

      await expect
        .poll(() => readRenderedSize(scope(page), NAV))
        .toBeCloseTo(320, 0);
      expect(
        await panel.evaluate(
          (element) =>
            element
              .getAnimations()
              .filter((animation) => animation.playState === "running").length,
        ),
      ).toBe(0);
    });

    test("docked restores to persisted size on mount", async ({ page }) => {
      await seedSnapshot(page, { [NAV]: { collapsed: false, size: 240 } });
      await page.goto("/test/persistence");
      await waitForSettled(scope(page));

      expect(near(await readRenderedSize(scope(page), NAV), 240, 2)).toBe(true);
      await expectSumInvariant(scope(page));
    });

    test("docked restores closed on mount", async ({ page }) => {
      await seedSnapshot(page, { [NAV]: { collapsed: true, size: 240 } });
      await page.goto("/test/persistence");
      await waitForSettled(scope(page));

      expect(await readRenderedSize(scope(page), NAV)).toBeLessThan(1);
      await expectSumInvariant(scope(page));
    });

    test("unknown id in snapshot is ignored, layout still resolves", async ({
      page,
    }) => {
      await seedSnapshot(page, {
        ghost: { size: 200 },
        [NAV]: { collapsed: false, size: 220 },
      });
      await page.goto("/test/persistence");
      await waitForSettled(scope(page));

      expect(near(await readRenderedSize(scope(page), NAV), 220, 2)).toBe(true);
      await expectSumInvariant(scope(page));
    });

    test("persisted size below current min is clamped", async ({ page }) => {
      // nav.minSize is 12% of 1280 ≈ 154px. Seed at 50 (way below min) and
      // expect the runtime to reconcile up to >= minPx, not honor the bad
      // value verbatim.
      await seedSnapshot(page, { [NAV]: { collapsed: false, size: 50 } });
      await page.goto("/test/persistence");
      await waitForSettled(scope(page));

      const container = await readContainerSize(scope(page));
      const minPx = container * 0.12;
      const navSize = await readRenderedSize(scope(page), NAV);
      expect(
        navSize,
        `nav should clamp to >= min (${minPx.toFixed(0)}), got ${navSize.toFixed(0)}`,
      ).toBeGreaterThanOrEqual(minPx - 2);
      await expectSumInvariant(scope(page));
    });

    test("malformed snapshot JSON is ignored (no crash)", async ({ page }) => {
      // Plant raw garbage — readSnapshot's try/catch should swallow and fall
      // back to defaults, not throw at mount.
      await page.addInitScript((k) => {
        window.localStorage.setItem(k, "{not json");
      }, STORAGE_KEY);
      await page.goto("/test/persistence");
      await waitForSettled(scope(page));

      // Layout resolves to defaults (nav at 18%, inspector at 22%).
      await expectSumInvariant(scope(page));
      const container = await readContainerSize(scope(page));
      expect(
        near(await readRenderedSize(scope(page), NAV), container * 0.18, 6),
      ).toBe(true);
    });
  });

  // ─── custom storage adapter (sessionStorage) ──────────────────────────────

  test.describe("custom storage adapter", () => {
    test("user-supplied adapter handles writes and reads", async ({ page }) => {
      await page.goto("/test/persistence?storage=session");
      await waitForSettled(scope(page));
      await page.waitForTimeout(50);

      await dragHandle(scope(page), { panelId: NAV, delta: 40 });
      await waitForSettled(scope(page));
      const before = await readRenderedSize(scope(page), NAV);
      await page.waitForTimeout(WRITE_DEBOUNCE_MS);

      // Snapshot lives in sessionStorage; localStorage stays empty. That
      // proves the user-supplied adapter — not the default — handled the
      // write.
      const persisted = await page.evaluate(
        (k) => ({
          session: window.sessionStorage.getItem(k),
          local: window.localStorage.getItem(k),
        }),
        STORAGE_KEY,
      );
      expect(persisted.session, "session snapshot missing").toBeTruthy();
      expect(
        persisted.local,
        "default adapter leaked into localStorage",
      ).toBeNull();

      // Reload still inside the same tab — sessionStorage survives — so the
      // read path on the custom adapter should restore the size.
      await page.reload();
      await waitForSettled(scope(page));
      const after = await readRenderedSize(scope(page), NAV);
      expect(near(after, before)).toBe(true);
    });
  });

  // ─── pinned panels ─────────────────────────────────────────────────────────
  //
  // `pinned` is a spec-time prop (declarative panel configuration, not part
  // of the value snapshot), so the *prop* doesn't round-trip — it's reapplied
  // by the route on mount. What we're really verifying is that a pinned panel's
  // own `{collapsed, size}` still persists like any other docked, and that its
  // pin behavior is intact after rehydration.

  test.describe("pinned dockeds", () => {
    test("pinned docked's size and collapse state round-trip", async ({
      page,
    }) => {
      await page.goto("/test/persistence?pinned=nav");
      await waitForSettled(scope(page));
      await page.waitForTimeout(50);

      await dragHandle(scope(page), { panelId: NAV, delta: 40 });
      await waitForSettled(scope(page));
      const sizeBefore = await readRenderedSize(scope(page), NAV);
      await page.waitForTimeout(WRITE_DEBOUNCE_MS);

      await page.reload();
      await waitForSettled(scope(page));
      expect(
        near(await readRenderedSize(scope(page), NAV), sizeBefore, 2),
      ).toBe(true);

      // Toggle round-trip on a pinned panel.
      await clickToggle(scope(page), NAV);
      await waitForSettled(scope(page));
      expect(await readRenderedSize(scope(page), NAV)).toBeLessThan(1);
      await page.waitForTimeout(WRITE_DEBOUNCE_MS);

      await page.reload();
      await waitForSettled(scope(page));
      expect(await readRenderedSize(scope(page), NAV)).toBeLessThan(1);
    });

    test("pinned panel resists sibling cascade after rehydration", async ({
      page,
    }) => {
      // Pin inspector at a known size, then reload and try to cascade into
      // it from list-side. A pinned panel must not shrink under another
      // handle's drag — confirmed both before and after persistence.
      await seedSnapshot(page, {
        [INSPECTOR]: { collapsed: false, size: 220 },
      });
      await page.goto("/test/persistence?pinned=inspector");
      await waitForSettled(scope(page));
      await page.waitForTimeout(50);

      const insBefore = await readRenderedSize(scope(page), INSPECTOR);
      expect(near(insBefore, 220, 2)).toBe(true);

      // Drag nav far enough to reach inspector if pinning were ignored.
      await dragHandle(scope(page), { panelId: NAV, delta: 600 });
      await waitForSettled(scope(page));

      const insAfter = await readRenderedSize(scope(page), INSPECTOR);
      expect(
        near(insAfter, insBefore, 2),
        `pinned inspector shrank: ${insBefore} → ${insAfter}`,
      ).toBe(true);
    });

    test("hydrating a pinned docked from snapshot honors persisted size", async ({
      page,
    }) => {
      await seedSnapshot(page, { [NAV]: { collapsed: false, size: 260 } });
      await page.goto("/test/persistence?pinned=nav");
      await waitForSettled(scope(page));

      expect(near(await readRenderedSize(scope(page), NAV), 260, 2)).toBe(true);
      await expectSumInvariant(scope(page));
    });
  });

  // ─── rejected pre-release formats (no migration) ───────────────────────────
  //
  // The first released storage format is version 1. Every pre-release shape
  // (v2 envelope with order, version-1-with-open-flags, bare unversioned
  // maps) is rejected as a deserialization failure: defaults render, and —
  // critically — the unreadable record is NOT overwritten until the user
  // makes an explicit mutation.

  test.describe("rejected pre-release formats", () => {
    const readRaw = (page: Page) =>
      page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);

    test("old v2 envelope is rejected, preserved, then replaced after an explicit drag", async ({
      page,
    }) => {
      const legacy = JSON.stringify({
        version: 2,
        orientation: "horizontal",
        order: [NAV, MAIN, AUX, INSPECTOR],
        panels: { [NAV]: { collapsed: false, size: 320 } },
      });
      await seedRawAt(page, STORAGE_KEY, legacy);
      await page.goto("/test/persistence");
      await waitForSettled(scope(page));

      // Defaults render — the seeded 320 is never applied.
      const container = await readContainerSize(scope(page));
      expect(
        near(await readRenderedSize(scope(page), NAV), container * 0.18, 6),
      ).toBe(true);
      await expectSumInvariant(scope(page));

      // The unreadable record is not overwritten before an explicit
      // mutation (write gate).
      await page.waitForTimeout(WRITE_DEBOUNCE_MS);
      expect(await readRaw(page)).toBe(legacy);

      // An explicit drag reopens the gate and persists the new v1 format.
      await dragHandle(scope(page), { panelId: NAV, delta: 30 });
      await waitForSettled(scope(page));
      await page.waitForTimeout(WRITE_DEBOUNCE_MS);
      const rewritten = JSON.parse((await readRaw(page)) ?? "null");
      expect(rewritten).toMatchObject({
        version: 1,
        orientation: "horizontal",
      });
      expect(rewritten).not.toHaveProperty("order");
      expect(typeof rewritten.panels[NAV].size).toBe("number");
    });

    test("unversioned bare panel map is rejected in favor of defaults", async ({
      page,
    }) => {
      const legacy = JSON.stringify({ [NAV]: { collapsed: false, size: 320 } });
      await seedRawAt(page, STORAGE_KEY, legacy);
      await page.goto("/test/persistence");
      await waitForSettled(scope(page));

      const container = await readContainerSize(scope(page));
      expect(
        near(await readRenderedSize(scope(page), NAV), container * 0.18, 6),
      ).toBe(true);
      await expectSumInvariant(scope(page));
      await page.waitForTimeout(WRITE_DEBOUNCE_MS);
      expect(await readRaw(page)).toBe(legacy);
    });

    test("a v1 document with a mismatched orientation is rejected", async ({
      page,
    }) => {
      await seedSnapshotAt(
        page,
        STORAGE_KEY,
        { [NAV]: { collapsed: false, size: 320 } },
        "local",
        "vertical",
      );
      await page.goto("/test/persistence");
      await waitForSettled(scope(page));

      const container = await readContainerSize(scope(page));
      expect(
        near(await readRenderedSize(scope(page), NAV), container * 0.18, 6),
      ).toBe(true);
      await expectSumInvariant(scope(page));
    });
  });

  // ─── seeded value reconciliation (size constraints changed between sessions) ─

  test.describe("seeded value reconciliation", () => {
    test("persisted size above current max clamps down", async ({ page }) => {
      // nav.maxSize = 30% of 1280 ≈ 384. Seed at 600, well above max.
      await seedSnapshot(page, { [NAV]: { collapsed: false, size: 600 } });
      await page.goto("/test/persistence");
      await waitForSettled(scope(page));

      const container = await readContainerSize(scope(page));
      const maxPx = container * 0.3;
      const navSize = await readRenderedSize(scope(page), NAV);
      expect(
        navSize,
        `nav should clamp to <= max (${maxPx.toFixed(0)}), got ${navSize.toFixed(0)}`,
      ).toBeLessThanOrEqual(maxPx + 2);
      await expectSumInvariant(scope(page));
    });

    test("mixed valid + out-of-range entries: valid ones honored, bad ones clamped", async ({
      page,
    }) => {
      await seedSnapshot(page, {
        [NAV]: { collapsed: false, size: 200 }, // valid (within 12–30% at 1280)
        [INSPECTOR]: { collapsed: false, size: 10 }, // below min — clamps up
      });
      await page.goto("/test/persistence");
      await waitForSettled(scope(page));

      const container = await readContainerSize(scope(page));
      expect(near(await readRenderedSize(scope(page), NAV), 200, 2)).toBe(true);
      expect(
        await readRenderedSize(scope(page), INSPECTOR),
      ).toBeGreaterThanOrEqual(container * 0.15 - 2);
      await expectSumInvariant(scope(page));
    });

    test("re-saving after reconciliation overwrites with reconciled values", async ({
      page,
    }) => {
      // Seed below-min, let the runtime clamp + write back, then verify the
      // stored snapshot now reflects the reconciled size (not the bad seed).
      await seedSnapshot(page, { [NAV]: { collapsed: false, size: 50 } });
      await page.goto("/test/persistence");
      await waitForSettled(scope(page));

      // Nudge the layout so a write-back is triggered (the group only writes
      // when size/collapse state changes — a pure hydrate doesn't dirty it).
      await dragHandle(scope(page), { panelId: NAV, delta: 10 });
      await waitForSettled(scope(page));
      await page.waitForTimeout(WRITE_DEBOUNCE_MS);

      const snap = await readPersisted(page);
      expect(snap?.[NAV].size).toBeGreaterThan(50);
    });
  });

  // ─── adapter resilience: setItem / getItem throw ──────────────────────────

  test.describe("throwing storage adapter", () => {
    test("getItem throw on mount falls back to defaults, no crash", async ({
      page,
    }) => {
      await page.goto("/test/persistence?storage=throwing");
      await waitForSettled(scope(page));
      await expectSumInvariant(scope(page));

      const container = await readContainerSize(scope(page));
      // nav at default 18%.
      expect(
        near(await readRenderedSize(scope(page), NAV), container * 0.18, 6),
      ).toBe(true);

      // Verify the lib actually attempted the read (we're not testing dead
      // code) — the route's adapter increments the counter on every call.
      const count = await page.evaluate(
        () => window.__resizablePanelsThrowCount,
      );
      expect(count?.get ?? 0).toBeGreaterThan(0);
    });

    test("setItem throw is swallowed; layout keeps working after a drag", async ({
      page,
    }) => {
      await page.goto("/test/persistence?storage=throwing");
      await waitForSettled(scope(page));
      await page.waitForTimeout(50);

      // Drag, then sit past the debounce — write-back fires and throws.
      // The page should keep functioning; subsequent drags also work.
      await dragHandle(scope(page), { panelId: NAV, delta: 40 });
      await waitForSettled(scope(page));
      await page.waitForTimeout(WRITE_DEBOUNCE_MS);

      // Adapter saw a setItem call.
      const count = await page.evaluate(
        () => window.__resizablePanelsThrowCount,
      );
      expect(count?.set ?? 0).toBeGreaterThan(0);

      // Layout is still alive: another drag has the expected effect.
      const before = await readRenderedSize(scope(page), NAV);
      await dragHandle(scope(page), { panelId: NAV, delta: -20 });
      await waitForSettled(scope(page));
      const after = await readRenderedSize(scope(page), NAV);
      expect(near(after, before - 20, 3)).toBe(true);
      await expectSumInvariant(scope(page));
    });
  });

  // ─── restore status and error reporting (§12) ──────────────────────────────
  //
  // `onStatusChange` must report `{state:"restoring"}` when the mount read
  // starts and `{state:"ready"}` exactly once — after success, empty, or
  // failure. `onError` fires once per restore attempt with the failing
  // operation. The harness renders under StrictMode, so "exactly once" here
  // also proves the callbacks survive double-invoked effects.

  test.describe("restore status and error reporting", () => {
    const STATUS_CYCLE = [`restoring:${STORAGE_KEY}`, `ready:${STORAGE_KEY}`];

    test("sync restore reports restoring then ready exactly once, no error", async ({
      page,
    }) => {
      await seedSnapshot(page, { [NAV]: { collapsed: false, size: 240 } });
      await page.goto("/test/persistence");
      await waitForSettled(scope(page));

      // The snapshot actually applied (we're observing a real restore).
      expect(near(await readRenderedSize(scope(page), NAV), 240, 2)).toBe(true);
      const log = await readPersistenceLog(page);
      expect(log.status).toEqual(STATUS_CYCLE);
      expect(log.errors).toEqual([]);
    });

    test("empty entry still reports restoring then ready exactly once, no error", async ({
      page,
    }) => {
      // Fresh context — nothing under the key. The fallback renders and the
      // lifecycle completes without an error.
      await page.goto("/test/persistence");
      await waitForSettled(scope(page));

      const log = await readPersistenceLog(page);
      expect(log.status).toEqual(STATUS_CYCLE);
      expect(log.errors).toEqual([]);
    });

    test("throwing getItem reports one read error and still becomes ready", async ({
      page,
    }) => {
      await page.goto("/test/persistence?storage=throwing");
      await waitForSettled(scope(page));

      // The adapter was really consulted.
      const count = await page.evaluate(
        () => window.__resizablePanelsThrowCount,
      );
      expect(count?.get ?? 0).toBeGreaterThan(0);

      const log = await readPersistenceLog(page);
      expect(log.status).toEqual(STATUS_CYCLE);
      expect(log.errors).toEqual([
        {
          operation: "read",
          key: STORAGE_KEY,
          message: "simulated storage read failure",
        },
      ]);
    });

    test("rejecting getItem reports one read error and still becomes ready", async ({
      page,
    }) => {
      await page.goto("/test/persistence?storage=rejecting");
      await waitForSettled(scope(page));

      await expect
        .poll(async () => (await readPersistenceLog(page)).status)
        .toEqual(STATUS_CYCLE);
      const log = await readPersistenceLog(page);
      expect(log.errors).toEqual([
        {
          operation: "read",
          key: STORAGE_KEY,
          message: "simulated async storage read failure",
        },
      ]);
    });

    test("corrupt JSON reports one deserialize error and still becomes ready", async ({
      page,
    }) => {
      await page.addInitScript((k) => {
        window.localStorage.setItem(k, "{not json");
      }, STORAGE_KEY);
      await page.goto("/test/persistence");
      await waitForSettled(scope(page));

      const log = await readPersistenceLog(page);
      expect(log.status).toEqual(STATUS_CYCLE);
      expect(log.errors).toHaveLength(1);
      expect(log.errors[0]).toMatchObject({
        operation: "deserialize",
        key: STORAGE_KEY,
      });
    });

    test("rejected pre-release document reports one deserialize error", async ({
      page,
    }) => {
      // Valid JSON, invalid schema (version 2) — the other deserialize path.
      await seedRawAt(
        page,
        STORAGE_KEY,
        JSON.stringify({ version: 2, orientation: "horizontal", panels: {} }),
      );
      await page.goto("/test/persistence");
      await waitForSettled(scope(page));

      const log = await readPersistenceLog(page);
      expect(log.status).toEqual(STATUS_CYCLE);
      expect(log.errors).toHaveLength(1);
      expect(log.errors[0]).toMatchObject({
        operation: "deserialize",
        key: STORAGE_KEY,
      });
    });
  });

  // ─── nested groups: two persistence keys under one PanelProvider ────────────

  test.describe("nested groups", () => {
    const OUTER_KEY = "resizable-panels-persist-outer";
    const INNER_KEY = "resizable-panels-persist-inner";
    const SIDEBAR = "sidebar";
    const TERMINAL = "terminal";
    const NESTED_INSPECTOR = "inspector";

    async function readOuter(page: Page) {
      return page.evaluate((k) => {
        const raw = window.localStorage.getItem(k);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed.panels ?? parsed;
      }, OUTER_KEY);
    }

    async function readInner(page: Page) {
      return page.evaluate((k) => {
        const raw = window.localStorage.getItem(k);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed.panels ?? parsed;
      }, INNER_KEY);
    }

    test("each group writes only its own key", async ({ page }) => {
      await page.goto("/test/persistence-nested");
      await waitForSettled(scope(page));
      await page.waitForTimeout(50);

      // Drag a panel in the outer group only.
      await dragHandle(scope(page), { panelId: SIDEBAR, delta: 40 });
      await waitForSettled(scope(page));
      await page.waitForTimeout(WRITE_DEBOUNCE_MS);

      const outer = await readOuter(page);
      const inner = await readInner(page);

      // Outer must contain sidebar; inner must NOT (sidebar belongs to outer).
      expect(outer?.[SIDEBAR]).toBeTruthy();
      expect(inner?.[SIDEBAR]).toBeUndefined();
      // Inner-only ids never appear in outer.
      expect(outer?.[TERMINAL]).toBeUndefined();
    });

    test("dragging in inner group does not touch outer key", async ({
      page,
    }) => {
      await page.goto("/test/persistence-nested");
      await waitForSettled(scope(page));
      await page.waitForTimeout(50);

      const outerBefore = await readOuter(page);

      // Drag the inner-axis terminal handle (vertical group).
      await dragHandle(scope(page), { panelId: TERMINAL, delta: -40 });
      await waitForSettled(scope(page));
      await page.waitForTimeout(WRITE_DEBOUNCE_MS);

      const inner = await readInner(page);
      const outerAfter = await readOuter(page);

      expect(inner?.[TERMINAL]).toBeTruthy();
      // Outer key may exist (peer 'main' could have written) but TERMINAL
      // must not have leaked there.
      expect(outerAfter?.[TERMINAL]).toBeUndefined();
      // If outer existed before, its sidebar/inspector entries didn't shift.
      if (outerBefore?.[SIDEBAR] && outerAfter?.[SIDEBAR]) {
        expect(outerAfter[SIDEBAR].size).toBeCloseTo(
          outerBefore[SIDEBAR].size,
          0,
        );
      }
    });

    test("both groups round-trip independently across reload", async ({
      page,
    }) => {
      await page.goto("/test/persistence-nested");
      await waitForSettled(scope(page));
      await page.waitForTimeout(50);

      await dragHandle(scope(page), { panelId: SIDEBAR, delta: 40 });
      await waitForSettled(scope(page));
      await dragHandle(scope(page), { panelId: TERMINAL, delta: -40 });
      await waitForSettled(scope(page));

      const sidebarBefore = await readRenderedSize(scope(page), SIDEBAR);
      const terminalBefore = await readRenderedSize(
        scope(page),
        TERMINAL,
        "height",
      );
      await page.waitForTimeout(WRITE_DEBOUNCE_MS);

      await page.reload();
      await waitForSettled(scope(page));

      expect(
        near(await readRenderedSize(scope(page), SIDEBAR), sidebarBefore, 3),
      ).toBe(true);
      expect(
        near(
          await readRenderedSize(scope(page), TERMINAL, "height"),
          terminalBefore,
          3,
        ),
      ).toBe(true);
    });

    test("seeding one key doesn't drive the other group", async ({ page }) => {
      // Seed only the outer snapshot; inner must come up at defaults.
      await seedSnapshotAt(page, OUTER_KEY, {
        [SIDEBAR]: { collapsed: false, size: 300 },
      });
      await page.goto("/test/persistence-nested");
      await waitForSettled(scope(page));

      expect(near(await readRenderedSize(scope(page), SIDEBAR), 300, 3)).toBe(
        true,
      );

      // Terminal's default is 35% of inner-group height. We don't have a
      // direct way to read the inner group's container height without
      // axis-aware helper, but we can at least assert terminal is present
      // and the layout sums correctly on the outer axis.
      expect(
        await readRenderedSize(scope(page), TERMINAL, "height"),
      ).toBeGreaterThan(0);
      await expectSumInvariant(scope(page));
      await expectSumInvariant(scope(page), "height");

      // Seed isolation: the outer seed must not populate the inner key with
      // outer panels. The inner group may write its own layout after mount;
      // that is unrelated to the outer seed.
      await page.waitForTimeout(WRITE_DEBOUNCE_MS);
      const inner = await readInner(page);
      expect(inner?.[SIDEBAR]).toBeUndefined();
      expect(inner?.[NESTED_INSPECTOR]).toBeUndefined();
    });

    test("both groups hydrate from independent seeded snapshots", async ({
      page,
    }) => {
      await seedSnapshotAt(page, OUTER_KEY, {
        [SIDEBAR]: { collapsed: false, size: 280 },
        [NESTED_INSPECTOR]: { collapsed: false, size: 260 },
      });
      await seedSnapshotAt(
        page,
        INNER_KEY,
        { [TERMINAL]: { collapsed: false, size: 220 } },
        "local",
        "vertical",
      );
      await page.goto("/test/persistence-nested");
      await waitForSettled(scope(page));

      expect(near(await readRenderedSize(scope(page), SIDEBAR), 280, 3)).toBe(
        true,
      );
      expect(
        near(await readRenderedSize(scope(page), NESTED_INSPECTOR), 260, 3),
      ).toBe(true);
      expect(
        near(await readRenderedSize(scope(page), TERMINAL, "height"), 220, 3),
      ).toBe(true);
      await expectSumInvariant(scope(page));
      await expectSumInvariant(scope(page), "height");
    });
  });
});
