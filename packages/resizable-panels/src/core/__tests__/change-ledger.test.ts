import { describe, expect, it } from "vitest";
import type {
  PanelGroupLayout,
  PanelLayoutMap,
  PanelValueChangeTrigger,
} from "../../types";
import {
  type ActiveResizeAttribution,
  type ChangeAttribution,
  type ChangeLedgerSchedulers,
  createChangeLedger,
} from "../change-ledger";
import { createPanelGroupLayout } from "../layout-state";

/**
 * These tests protect the documented event semantics of §2/§4/§10 (the
 * change-ledger module doc — numbering from the retired public-api-redesign
 * design doc, git history 30c3424) at the unit that enforces them. The
 * schedulers are injected and stepped explicitly, so the frame-timed
 * windows (double-rAF attribution clear, one-frame controlled-commit
 * suppression) are driven deterministically — no fake timers, no React.
 */

/** Deterministic schedulers: microtasks and animation frames run only when
 * the test steps them. */
function createTestSchedulers() {
  const microtasks: Array<() => void> = [];
  const frames = new Map<number, () => void>();
  let nextFrameHandle = 1;
  let frameSchedulingAvailable = true;
  const schedulers: ChangeLedgerSchedulers = {
    microtask: (cb) => {
      microtasks.push(cb);
    },
    requestFrame: (cb) => {
      if (!frameSchedulingAvailable) return null;
      const handle = nextFrameHandle;
      nextFrameHandle += 1;
      frames.set(handle, cb);
      return handle;
    },
    cancelFrame: (handle) => {
      frames.delete(handle);
    },
  };
  return {
    schedulers,
    /** Simulate an environment without requestAnimationFrame. */
    disableFrameScheduling() {
      frameSchedulingAvailable = false;
    },
    /** Drain queued microtasks, including ones queued while draining. */
    flushMicrotasks() {
      while (microtasks.length > 0) microtasks.shift()?.();
    },
    /** Run one animation frame: every currently scheduled callback fires;
     * callbacks scheduled during the frame wait for the next one. */
    runFrame() {
      const callbacks = [...frames.values()];
      frames.clear();
      for (const cb of callbacks) cb();
    },
    pendingFrameCount: () => frames.size,
  };
}

function layoutOf(
  panels: PanelLayoutMap,
  order = Object.keys(panels),
): PanelGroupLayout {
  return createPanelGroupLayout("horizontal", order, panels);
}

type Emission = {
  value: PanelLayoutMap;
  previousValue: PanelLayoutMap;
  attribution: ChangeAttribution;
};

/** A minimal stand-in for panel-group's side of the ledger deps: committed
 * layout, controlled prop, active resize session, emission sink, and the
 * persistence seam (dirty flag pairing + explicit-change landings). */
function createHarness() {
  const sched = createTestSchedulers();
  let liveLayout = layoutOf({ a: { size: 100 }, b: { size: 200 } });
  let controlledLayout: PanelGroupLayout | undefined;
  let activeResize: ActiveResizeAttribution | null = null;
  const emissions: Emission[] = [];
  const explicitLandings: PanelGroupLayout[] = [];
  const appliedControlledLayouts: PanelGroupLayout[] = [];
  const dirtyMarks: PanelValueChangeTrigger[] = [];
  let dirty = false;
  const ledger = createChangeLedger(
    {
      readLayout: () => liveLayout,
      getControlledLayout: () => controlledLayout,
      getActiveResize: () => activeResize,
      dispatchValueChange: (next, previous, attribution) => {
        emissions.push({
          value: next.panels,
          previousValue: previous.panels,
          attribution,
        });
      },
      // Mirrors panel-group's pairing: capture-as-was, mark (system
      // triggers never dirty hydration), undo restores the capture.
      markPersistenceDirty: (trigger) => {
        dirtyMarks.push(trigger);
        const wasDirty = dirty;
        if (trigger !== "system") dirty = true;
        return () => {
          if (!wasDirty) dirty = false;
        };
      },
      explicitChangeLanded: (next) => {
        explicitLandings.push(next);
      },
      applyControlledLayout: (layout) => {
        appliedControlledLayouts.push(layout);
        // The group's reconciliation writes the controlled value into its
        // stores; committed state then reads back as that value.
        liveLayout = layout;
      },
    },
    sched.schedulers,
  );
  return {
    ledger,
    sched,
    emissions,
    explicitLandings,
    appliedControlledLayouts,
    dirtyMarks,
    isDirty: () => dirty,
    setDirty(value: boolean) {
      dirty = value;
    },
    setLive(layout: PanelGroupLayout) {
      liveLayout = layout;
    },
    setControlled(layout: PanelGroupLayout | undefined) {
      controlledLayout = layout;
    },
    setActiveResize(active: ActiveResizeAttribution | null) {
      activeResize = active;
    },
  };
}

const BASE = layoutOf({ a: { size: 100 }, b: { size: 200 } });
const GROWN = layoutOf({ a: { size: 150 }, b: { size: 150 } });
const GROWN_MORE = layoutOf({ a: { size: 180 }, b: { size: 120 } });

describe("change-ledger canonicalization (§2)", () => {
  it("measurement settling is recorded but never emitted", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    h.ledger.markCanonicalChange();
    h.setLive(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(0);
  });

  it("the canonical value is included in the next emitted change as previousValue", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    h.ledger.markCanonicalChange();
    h.setLive(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    // The next real change chains from the canonical value, proving the
    // silent settling was recorded as the baseline.
    h.ledger.markLayoutSource({ reason: "collapse", trigger: "api" });
    h.setLive(GROWN_MORE);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(1);
    expect(h.emissions[0].previousValue).toEqual(GROWN.panels);
    expect(h.emissions[0].value).toEqual(GROWN_MORE.panels);
    expect(h.emissions[0].attribution.reason).toBe("collapse");
  });

  it("an explicit attribution in flight beats a canonical claim", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    h.ledger.markLayoutSource({ reason: "restore", trigger: "system" });
    h.ledger.markCanonicalChange(); // refused: a mark is pending
    h.setLive(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(1);
    expect(h.emissions[0].attribution).toMatchObject({
      reason: "restore",
      trigger: "system",
    });
  });

  it("a later explicit mark cancels an earlier canonical claim", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    h.ledger.markCanonicalChange();
    h.ledger.markLayoutSource({ reason: "resize", trigger: "keyboard" });
    h.setLive(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(1);
    expect(h.emissions[0].attribution).toMatchObject({
      reason: "resize",
      trigger: "keyboard",
    });
  });

  it("an active resize session beats a canonical claim", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    h.setActiveResize({ trigger: "pointer", handleId: "seam" });
    h.ledger.markCanonicalChange(); // refused: a session is active
    h.setLive(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(1);
    expect(h.emissions[0].attribution).toEqual({
      reason: "resize",
      trigger: "pointer",
      handleId: "seam",
    });
  });
});

describe("change-ledger revoke semantics (§10)", () => {
  it("a revoked mark leaves no attribution, dirty-flag, or emission footprint", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    const revoke = h.ledger.markLayoutSource({
      reason: "collapse",
      trigger: "api",
    });
    expect(h.ledger.getChangeAttribution()).toEqual({
      reason: "collapse",
      trigger: "api",
    });
    expect(h.isDirty()).toBe(true);
    revoke();
    // Attribution falls back to the pre-mark last attribution.
    expect(h.ledger.getChangeAttribution()).toEqual({
      reason: "set-value",
      trigger: "api",
    });
    // The persistence dirty flag is restored exactly as it was.
    expect(h.isDirty()).toBe(false);
    // The rejected action changed nothing, so its store notification (the
    // group still notifies on no-op commits) emits nothing.
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(0);
  });

  it("revoking a mark that found the flag already dirty preserves it", () => {
    const h = createHarness();
    h.setDirty(true);
    const revoke = h.ledger.markLayoutSource({
      reason: "resize",
      trigger: "api",
    });
    revoke();
    expect(h.isDirty()).toBe(true);
  });

  it("a revoke does not clobber a newer mark's attribution", () => {
    const h = createHarness();
    const revokeFirst = h.ledger.markLayoutSource({
      reason: "collapse",
      trigger: "api",
    });
    h.ledger.markLayoutSource({ reason: "expand", trigger: "keyboard" });
    revokeFirst(); // stale revoke: the newer mark owns the state now
    expect(h.ledger.getChangeAttribution()).toEqual({
      reason: "expand",
      trigger: "keyboard",
    });
  });
});

describe("change-ledger attribution precedence (§4)", () => {
  it("an active resize session wins over a pending mark", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    h.ledger.markLayoutSource({ reason: "collapse", trigger: "api" });
    h.setActiveResize({ trigger: "keyboard" });
    expect(h.ledger.getChangeAttribution()).toEqual({
      reason: "resize",
      trigger: "keyboard",
    });
    h.setLive(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions[0].attribution).toMatchObject({
      reason: "resize",
      trigger: "keyboard",
    });
  });

  it("a pending mark wins over the last recorded attribution", () => {
    const h = createHarness();
    // lastAttribution starts as set-value/api; the pending mark shadows it.
    h.ledger.markLayoutSource({ reason: "expand", trigger: "keyboard" });
    expect(h.ledger.getChangeAttribution()).toEqual({
      reason: "expand",
      trigger: "keyboard",
    });
  });

  it("per-panel callbacks read the last attribution after the pending window closed, while the publisher falls back", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    h.ledger.markLayoutSource({ reason: "expand", trigger: "keyboard" });
    // Double-rAF: the mark expires two frames later.
    h.sched.runFrame();
    h.sched.runFrame();
    // Committed per-panel callbacks still see the last attribution…
    expect(h.ledger.getChangeAttribution()).toEqual({
      reason: "expand",
      trigger: "keyboard",
    });
    // …but the publisher no longer attributes new changes to it.
    h.setLive(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions[0].attribution).toMatchObject({
      reason: "set-value",
      trigger: "api",
    });
  });
});

describe("change-ledger emission dedup and previousValue chaining (§4)", () => {
  it("successive changes chain previousValue from the previous emitted value", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    h.setLive(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    h.setLive(GROWN_MORE);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(2);
    expect(h.emissions[0].previousValue).toEqual(BASE.panels);
    expect(h.emissions[1].previousValue).toEqual(GROWN.panels);
  });

  it("the first change of a resize transaction chains from the transaction baseline", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    // A prior emitted event exists…
    h.setLive(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    // …then a controlled transaction starts and records its own baseline.
    h.setControlled(GROWN);
    h.ledger.setEventBaseline(GROWN);
    h.setActiveResize({ trigger: "pointer" });
    h.ledger.recordControlledProposal(GROWN_MORE);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(2);
    expect(h.emissions[1].previousValue).toEqual(GROWN.panels);
    expect(h.emissions[1].value).toEqual(GROWN_MORE.panels);
  });

  it("pure reorders never emit", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    // Identical values, reversed key order — not a value change (§2).
    h.setLive(layoutOf(BASE.panels, ["b", "a"]));
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    h.ledger.reconcileChildren(layoutOf(BASE.panels, ["b", "a"]));
    expect(h.emissions).toHaveLength(0);
  });

  it("controlled dedup baselines on the last emitted proposal, not the committed prop echo", () => {
    const h = createHarness();
    const controlled = BASE;
    h.setControlled(controlled);
    h.setLive(controlled);
    h.ledger.initializePublisher(controlled);
    h.setActiveResize({ trigger: "pointer", handleId: "seam" });
    // Drag tick: proposal P1 emits against the prop baseline.
    h.ledger.recordControlledProposal(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(1);
    expect(h.emissions[0].value).toEqual(GROWN.panels);
    expect(h.emissions[0].previousValue).toEqual(controlled.panels);
    // The emission re-committed the (unchanged) prop; its echo is
    // suppressed, and the close resets the published snapshot to the prop.
    expect(h.appliedControlledLayouts).toHaveLength(1);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    h.sched.runFrame();
    // A later echo must dedup against the EMITTED proposal (P1), not the
    // re-committed prop value — otherwise every commit echo would re-emit
    // the unchanged proposal (§4: the final value is never duplicated).
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(1);
    // The next real proposal chains from P1.
    h.ledger.recordControlledProposal(GROWN_MORE);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(2);
    expect(h.emissions[1].previousValue).toEqual(GROWN.panels);
  });

  it("an unchanged apply emits nothing and reports false (§10)", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    expect(
      h.ledger.emitAppliedLayout(layoutOf(BASE.panels), {
        reason: "set-value",
        trigger: "api",
      }),
    ).toBe(false);
    expect(h.emissions).toHaveLength(0);
    expect(h.explicitLandings).toHaveLength(0);
    expect(
      h.ledger.emitAppliedLayout(GROWN, {
        reason: "set-value",
        trigger: "api",
      }),
    ).toBe(true);
    expect(h.emissions).toHaveLength(1);
  });

  it("api and keyboard emissions signal the persistence layer; pointer and system do not", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    // api apply → landing.
    h.ledger.emitAppliedLayout(GROWN, { reason: "set-value", trigger: "api" });
    expect(h.explicitLandings).toHaveLength(1);
    // pointer resize → no landing (endResize flushes at transaction end).
    h.setActiveResize({ trigger: "pointer" });
    h.setLive(GROWN_MORE);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(2);
    expect(h.explicitLandings).toHaveLength(1);
    h.setActiveResize(null);
    // system container-resize → no landing.
    h.ledger.markLayoutSource(
      { reason: "container-resize", trigger: "system" },
      true,
    );
    h.setLive(BASE);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(3);
    expect(h.explicitLandings).toHaveLength(1);
    // keyboard resize → landing.
    h.ledger.markLayoutSource({ reason: "resize", trigger: "keyboard" });
    h.setLive(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(4);
    expect(h.explicitLandings).toHaveLength(2);
  });
});

describe("change-ledger deferred attribution clear", () => {
  it("a non-deferred mark survives one frame and expires after two", () => {
    // Alive after one frame: the attributed React-state commit may land a
    // frame after the mark.
    const alive = createHarness();
    alive.ledger.initializePublisher(BASE);
    alive.ledger.markLayoutSource({ reason: "restore", trigger: "system" });
    alive.sched.runFrame();
    alive.setLive(GROWN);
    alive.ledger.notifyStoreCommit();
    alive.sched.flushMicrotasks();
    expect(alive.emissions[0].attribution).toMatchObject({
      reason: "restore",
      trigger: "system",
    });
    // Expired after the double-rAF window: later changes fall back.
    const expired = createHarness();
    expired.ledger.initializePublisher(BASE);
    expired.ledger.markLayoutSource({ reason: "restore", trigger: "system" });
    expired.sched.runFrame();
    expired.sched.runFrame();
    expired.setLive(GROWN);
    expired.ledger.notifyStoreCommit();
    expired.sched.flushMicrotasks();
    expect(expired.emissions[0].attribution).toMatchObject({
      reason: "set-value",
      trigger: "api",
    });
  });

  it("the clear falls back to a microtask when frame scheduling is unavailable", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    h.sched.disableFrameScheduling();
    h.ledger.markLayoutSource({ reason: "restore", trigger: "system" });
    h.sched.flushMicrotasks(); // the fallback clear runs here
    h.setLive(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions[0].attribution).toMatchObject({
      reason: "set-value",
      trigger: "api",
    });
  });

  it("a deferUntilCommit mark stays pending across frames until consumed", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    h.ledger.markLayoutSource(
      { reason: "container-resize", trigger: "system" },
      true,
    );
    h.sched.runFrame();
    h.sched.runFrame();
    h.sched.runFrame();
    h.setLive(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions[0].attribution).toMatchObject({
      reason: "container-resize",
      trigger: "system",
    });
  });

  it("the publisher consumes a pending mark at notification time", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    h.ledger.markLayoutSource({ reason: "collapse", trigger: "api" });
    h.setLive(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions[0].attribution).toMatchObject({ reason: "collapse" });
    // Consumed: a second, unrelated change falls back instead of reusing it.
    h.setLive(GROWN_MORE);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions[1].attribution).toMatchObject({
      reason: "set-value",
      trigger: "api",
    });
  });
});

describe("change-ledger controlled-commit suppression (§2)", () => {
  it("an external controlled value applies without echoing through onValueChange", () => {
    const h = createHarness();
    h.setControlled(BASE);
    h.setLive(BASE);
    h.ledger.initializePublisher(BASE);
    const external = GROWN;
    h.setControlled(external);
    h.ledger.commitControlledLayout(external);
    expect(h.appliedControlledLayouts).toEqual([external]);
    // Store echoes inside the one-frame window are not proposed back.
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(0);
    // The window closes at the next frame; the committed value is now the
    // baseline, so even a late echo emits nothing.
    h.sched.runFrame();
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(0);
  });

  it("the suppression window closes after exactly one frame and resets the proposal baseline", () => {
    const h = createHarness();
    h.setControlled(BASE);
    h.setLive(BASE);
    h.ledger.initializePublisher(BASE);
    h.setControlled(GROWN);
    h.ledger.commitControlledLayout(GROWN);
    h.sched.runFrame();
    // Post-window, a real proposal emits and chains from the committed
    // external value — not from a pre-commit baseline.
    h.setActiveResize({ trigger: "pointer" });
    h.ledger.recordControlledProposal(GROWN_MORE);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(1);
    expect(h.emissions[0].previousValue).toEqual(GROWN.panels);
  });

  it("re-entrant controlled commits cancel the earlier close frame", () => {
    const h = createHarness();
    h.setControlled(BASE);
    h.setLive(BASE);
    h.ledger.initializePublisher(BASE);
    h.ledger.commitControlledLayout(GROWN);
    h.ledger.commitControlledLayout(GROWN_MORE);
    // One close frame, not two: the second commit supersedes the first.
    expect(h.sched.pendingFrameCount()).toBe(1);
    h.sched.runFrame();
    expect(h.sched.pendingFrameCount()).toBe(0);
    // The window is closed after the single surviving frame.
    h.setActiveResize({ trigger: "pointer" });
    h.ledger.recordControlledProposal(BASE);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(1);
  });

  it("the close preserves the drag baseline while a resize session is active", () => {
    const h = createHarness();
    h.setControlled(BASE);
    h.setLive(BASE);
    h.ledger.initializePublisher(BASE);
    h.setActiveResize({ trigger: "pointer" });
    h.ledger.recordControlledProposal(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(1);
    // The automatic prop re-commit closes mid-drag: the emitted-proposal
    // baseline and the live proposal must survive the close.
    h.sched.runFrame();
    h.ledger.recordControlledProposal(GROWN_MORE);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(2);
    expect(h.emissions[1].previousValue).toEqual(GROWN.panels);
  });

  it("the close falls back to a microtask when frame scheduling is unavailable", () => {
    const h = createHarness();
    h.sched.disableFrameScheduling();
    h.setControlled(BASE);
    h.setLive(BASE);
    h.ledger.initializePublisher(BASE);
    h.setControlled(GROWN);
    h.ledger.commitControlledLayout(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks(); // close runs first, then the publish dedups
    expect(h.emissions).toHaveLength(0);
  });

  it("an applied layout in controlled mode records the proposal and re-commits the prop", () => {
    const h = createHarness();
    h.setControlled(BASE);
    h.setLive(BASE);
    h.ledger.initializePublisher(BASE);
    // setValue in controlled mode: emit the proposal, then re-commit the
    // authoritative prop (the parent may not accept the proposal).
    const emitted = h.ledger.emitAppliedLayout(GROWN, {
      reason: "set-value",
      trigger: "api",
    });
    expect(emitted).toBe(true);
    expect(h.emissions).toHaveLength(1);
    expect(h.emissions[0].value).toEqual(GROWN.panels);
    expect(h.appliedControlledLayouts).toEqual([BASE]);
    // The re-commit's echoes are suppressed for the frame window.
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(1);
  });
});

describe("change-ledger end-of-session emission (§4 / R-04)", () => {
  it("no resize transaction may end with its final session value unemitted", () => {
    const h = createHarness();
    h.setControlled(BASE);
    h.setLive(BASE);
    h.ledger.initializePublisher(BASE);
    h.ledger.setEventBaseline(BASE);
    h.setActiveResize({ trigger: "pointer", handleId: "seam" });
    // Tick N: proposal P1 emits; the parent accepts it and re-commits,
    // opening the suppression window. Under jank the close frame is
    // starved, so the window is STILL OPEN when the final tick lands.
    h.ledger.recordControlledProposal(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(1);
    h.setControlled(GROWN);
    h.ledger.commitControlledLayout(GROWN);
    // Final tick N+1: the pointer-up flush records P2, but its publish
    // pass lands inside the open window and is swallowed as an "echo".
    h.ledger.recordControlledProposal(GROWN_MORE);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(1);
    // The end path must emit the final session value itself — BEFORE the
    // end callback reports it and BEFORE the controlled re-commit: the
    // session may not end with lastSizes ≠ the last emitted proposal.
    h.ledger.emitFinalResizeValue(GROWN_MORE);
    expect(h.emissions).toHaveLength(2);
    expect(h.emissions[1].value).toEqual(GROWN_MORE.panels);
    // previousValue chains from the last emitted proposal (P1).
    expect(h.emissions[1].previousValue).toEqual(GROWN.panels);
    expect(h.emissions[1].attribution).toEqual({
      reason: "resize",
      trigger: "pointer",
      handleId: "seam",
    });
    // Pointer emissions never signal the explicit persistence landing —
    // endResize owns the pointer-path flush.
    expect(h.explicitLandings).toHaveLength(0);
    // endResize's finally: the transaction closes and the prop re-commits.
    // The late store echo is STILL suppressed — once the final value has
    // been emitted, everything the window swallows is a genuine echo.
    h.setActiveResize(null);
    h.ledger.clearControlledProposal();
    h.ledger.commitControlledLayout(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    h.sched.runFrame();
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(2);
  });

  it("the end path never duplicates a final value the publisher already emitted", () => {
    const h = createHarness();
    h.setControlled(BASE);
    h.setLive(BASE);
    h.ledger.initializePublisher(BASE);
    h.ledger.setEventBaseline(BASE);
    h.setActiveResize({ trigger: "pointer", handleId: "seam" });
    h.ledger.recordControlledProposal(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    // The common, unjanked cadence: the post-emission prop re-commit's
    // window closes within a frame, and the publisher's next pass already
    // emitted the final proposal before the end path runs.
    h.sched.runFrame();
    h.ledger.recordControlledProposal(GROWN_MORE);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(2);
    h.ledger.emitFinalResizeValue(GROWN_MORE);
    // §4: the final value is never duplicated.
    expect(h.emissions).toHaveLength(2);
  });

  it("an uncontrolled final tick that outruns its publish pass is emitted by the end path exactly once", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    h.ledger.setEventBaseline(BASE);
    h.setActiveResize({ trigger: "pointer", handleId: "seam" });
    h.setLive(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(1);
    // Final tick: the store commit notified, but its publish microtask is
    // still queued when the end path runs (the end microtask was queued
    // earlier in the pointer-up task — the docked-panel shape).
    h.setLive(GROWN_MORE);
    h.ledger.notifyStoreCommit();
    h.ledger.emitFinalResizeValue(GROWN_MORE);
    expect(h.emissions).toHaveLength(2);
    expect(h.emissions[1].value).toEqual(GROWN_MORE.panels);
    expect(h.emissions[1].previousValue).toEqual(GROWN.panels);
    expect(h.emissions[1].attribution).toMatchObject({
      reason: "resize",
      trigger: "pointer",
    });
    // The late publish pass dedups to silence instead of re-emitting.
    h.setActiveResize(null);
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(2);
  });

  it("a session that settled on the last emitted value ends silently", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    h.ledger.setEventBaseline(BASE);
    h.setActiveResize({ trigger: "pointer" });
    // No-move (or moved-and-returned-to-the-emitted-value) session: the
    // final value equals the transaction baseline recorded at start.
    h.ledger.emitFinalResizeValue(BASE);
    expect(h.emissions).toHaveLength(0);
  });

  it("the end-path emission is inert without an active session", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    h.ledger.emitFinalResizeValue(GROWN);
    expect(h.emissions).toHaveLength(0);
  });

  it("a controlled keyboard transaction's atomic value survives an end inside an open suppression window", () => {
    const h = createHarness();
    h.setControlled(BASE);
    h.setLive(BASE);
    h.ledger.initializePublisher(BASE);
    // A previous acceptance's window is still open (starved close frame).
    h.ledger.commitControlledLayout(BASE);
    h.ledger.setEventBaseline(BASE);
    h.setActiveResize({ trigger: "keyboard" });
    h.ledger.recordControlledProposal(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(0);
    h.ledger.emitFinalResizeValue(GROWN);
    expect(h.emissions).toHaveLength(1);
    expect(h.emissions[0].attribution).toMatchObject({
      reason: "resize",
      trigger: "keyboard",
    });
    // Keyboard emissions signal the persistence layer exactly once.
    expect(h.explicitLandings).toHaveLength(1);
  });
});

describe("change-ledger membership reconciliation (§2)", () => {
  it("membership changes emit children/system only after publisher initialization", () => {
    const h = createHarness();
    const withC = layoutOf({
      a: { size: 100 },
      b: { size: 200 },
      c: { size: 50 },
    });
    // Pre-initialization passes (SSR / first client render) stay silent.
    h.ledger.reconcileChildren(BASE);
    expect(h.emissions).toHaveLength(0);
    h.ledger.initializePublisher(BASE);
    h.ledger.reconcileChildren(withC);
    expect(h.emissions).toHaveLength(1);
    expect(h.emissions[0].attribution).toMatchObject({
      reason: "children",
      trigger: "system",
    });
    expect(h.emissions[0].previousValue).toEqual(BASE.panels);
    expect(h.emissions[0].value).toEqual(withC.panels);
  });

  it("controlled groups never emit membership changes", () => {
    const h = createHarness();
    h.setControlled(BASE);
    h.ledger.initializePublisher(BASE);
    h.ledger.reconcileChildren(layoutOf({ a: { size: 100 }, c: { size: 50 } }));
    expect(h.emissions).toHaveLength(0);
  });

  it("publisher initialization does not overwrite an existing event baseline", () => {
    const h = createHarness();
    // A transaction baseline recorded before the first publisher frame
    // (e.g. an early drag) must survive initialization.
    h.ledger.setEventBaseline(BASE);
    h.ledger.initializePublisher(GROWN);
    h.ledger.emitAppliedLayout(GROWN_MORE, {
      reason: "set-value",
      trigger: "api",
    });
    expect(h.emissions[0].previousValue).toEqual(BASE.panels);
  });
});

describe("change-ledger publisher pass cancellation (R-30)", () => {
  it("a cancelled pass drains as a no-op — teardown emits nothing", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    // Teardown shape: children unregister (store notification schedules the
    // pass over the emptied registry), THEN the publisher effect's cleanup
    // cancels — the queued microtask drains after everything is gone.
    h.setLive(layoutOf({}));
    h.ledger.notifyStoreCommit();
    h.ledger.cancelScheduledPublish();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(0);
  });

  it("a fresh pass scheduled after a cancel emits exactly once, from live state", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    // Old subscription: a pass is queued, then its effect cleanup cancels.
    h.setLive(GROWN);
    h.ledger.notifyStoreCommit();
    h.ledger.cancelScheduledPublish();
    // New subscription: a later store commit schedules a fresh pass. The
    // stale pass drains first and must neither emit nor consume the fresh
    // pass's queued slot.
    h.setLive(GROWN_MORE);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(1);
    expect(h.emissions[0].value).toEqual(GROWN_MORE.panels);
    expect(h.emissions[0].previousValue).toEqual(BASE.panels);
  });

  it("cancelling with nothing queued never silences the next pass", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    // StrictMode shape: cleanup (cancel) runs with no pass in flight, the
    // replacement subscription must still publish normally.
    h.ledger.cancelScheduledPublish();
    h.setLive(GROWN);
    h.ledger.notifyStoreCommit();
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(1);
    expect(h.emissions[0].value).toEqual(GROWN.panels);
  });

  it("the synchronous end-path emission (R-04) is unaffected by a cancel", () => {
    const h = createHarness();
    h.ledger.initializePublisher(BASE);
    h.ledger.setEventBaseline(BASE);
    h.setActiveResize({ trigger: "pointer" });
    h.setLive(GROWN);
    h.ledger.notifyStoreCommit();
    // Unmount-during-drag: the publisher's pass is cancelled by teardown,
    // but the session's final value must still be delivered (§4 / R-04 —
    // no transaction ends with its final value unemitted).
    h.ledger.cancelScheduledPublish();
    h.ledger.emitFinalResizeValue(GROWN);
    expect(h.emissions).toHaveLength(1);
    expect(h.emissions[0].value).toEqual(GROWN.panels);
    expect(h.emissions[0].attribution).toMatchObject({
      reason: "resize",
      trigger: "pointer",
    });
    h.sched.flushMicrotasks();
    expect(h.emissions).toHaveLength(1);
  });
});
