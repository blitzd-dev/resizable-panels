import type {
  PanelChangeDetails,
  PanelGroupLayout,
  PanelValueChangeReason,
  PanelValueChangeTrigger,
} from "../types.js";
import { panelValuesEqual } from "./layout-state.js";

/** INTERNAL: attribution for the next value change — what operation and
 * input produced it, and through which declared handle. */
export type ChangeAttribution = {
  reason: PanelValueChangeReason;
  trigger: PanelValueChangeTrigger;
  handleId?: string;
};

/**
 * Change ledger: one explicit model of how a `<PanelGroup>` decides what a
 * committed store change MEANS (attribution), whether it is REPORTED
 * (emission dedup, canonicalization, controlled echo suppression), and which
 * `previousValue` it chains from. `panel-group.tsx` owns the React wiring —
 * stores, effects, resize sessions, persistence — and calls in; the ledger
 * owns the bookkeeping those pieces used to coordinate through ~10 refs
 * (R-12). This doc comment is the canonical statement of the invariants;
 * the §2/§4/§10 numbering comes from the retired public-api-redesign design
 * doc (deleted in 30c3424, recoverable from git history).
 *
 * §2 — live group value vs persistence documents:
 * - Measurement settling is canonicalization, not a change. A canonical
 *   claim (`markCanonicalChange`, e.g. a peer pool's first allocation) makes
 *   the next observed change RECORD its outcome as the emission baseline
 *   without emitting; the canonical value is then included in the next
 *   emitted change.
 * - Canonicalization only claims otherwise-unattributed settling: an
 *   explicit attribution in flight, or an active resize session, wins.
 * - Reordering identical keys is not a value change: every dedup compares
 *   panel values (`panelValuesEqual`), never topology.
 * - Applying an external controlled value does not echo back through
 *   `onValueChange`: `commitControlledLayout` opens a suppression window
 *   spanning exactly one animation frame — covering both the synchronous
 *   peer-store update and the panel-local docked state commit that lands on
 *   the following React render.
 * - A group being torn down emits nothing (R-30). The publisher's coalesced
 *   pass is scoped to the subscription that scheduled it: the group's
 *   publisher effect calls `cancelScheduledPublish` on cleanup, so a pass
 *   queued by unregistering children can never drain after teardown and
 *   report the empty registry as an api change. Partial membership changes
 *   keep emitting — a surviving (or immediately re-subscribing) effect
 *   instance re-reports from live state through `reconcileChildren`, and
 *   later store commits schedule fresh passes.
 *
 * §4 — value changes vs resize lifecycle:
 * - `previousValue` is the immediately prior EMITTED value; the first change
 *   of a pointer transaction chains from the transaction baseline recorded
 *   at session start (`setEventBaseline`).
 * - The final drag value is never emitted twice. In controlled mode the
 *   dedup baseline is the last EMITTED proposal — the controlled re-commit
 *   resets the published snapshot to the prop value, and comparing against
 *   that would re-emit an unchanged proposal on every commit echo.
 * - No resize transaction may end with its final session value unemitted
 *   (R-04). The publisher's final pass can lose the race against session
 *   end: under jank it lands inside a still-open suppression window (the
 *   parent's previous acceptance, its close frame starved) and is swallowed
 *   as an "echo"; in the docked-panel shape its microtask is queued after
 *   the end microtask. So the end path calls `emitFinalResizeValue` —
 *   synchronously, BEFORE the end callback fires and BEFORE the controlled
 *   re-commit reopens the window — emitting the settled value with the
 *   session's attribution iff the publisher has not already emitted it.
 *   `onResizeEnd.value` therefore always equals the last emitted proposal,
 *   and everything the suppression window swallows afterwards is a genuine
 *   echo of an already-emitted value.
 * - Attribution precedence: an active resize session wins over a pending
 *   mark, which wins over the last recorded attribution (kept for per-panel
 *   committed callbacks that fire after the pending window has closed).
 *
 * §10 — actions and results:
 * - Marks are revocable: a rejected or unchanged action invokes the revoke
 *   handle returned by `markLayoutSource` and leaves NO attribution,
 *   persistence-dirty, or emission footprint.
 * - Persistence itself stays in `panel-group.tsx`. The ledger signals the
 *   group's persistence layer through two injected hooks:
 *   `markPersistenceDirty` at mark time (returning the undo that the revoke
 *   handle invokes) and `explicitChangeLanded` when an api- or
 *   keyboard-triggered change is actually emitted (the group reopens its
 *   write gate and flushes there). The write gate, dirty flag, and
 *   hydration state never enter this module.
 *
 * Timing (frame-scoped windows preserved verbatim — R-04's fix is causal
 * ordering at session end via `emitFinalResizeValue`, not wider windows;
 * the windows themselves only ever suppress genuine echoes):
 * - A non-deferred mark expires two frames after it was recorded (double
 *   rAF) unless the publisher consumes it earlier; `deferUntilCommit` marks
 *   never expire on a timer.
 * - The controlled-commit suppression window spans exactly one frame.
 * - All scheduling routes through injected schedulers so unit tests can
 *   drive these windows deterministically; the defaults are the real
 *   `queueMicrotask`/`requestAnimationFrame` with the documented microtask
 *   fallbacks when frame scheduling is unavailable.
 */
export type ChangeLedger = {
  /** Attribute the next observed change. Returns the §10 revoke handle: a
   * rejected or unchanged action must call it so the mark leaves no
   * attribution or persistence footprint. Non-deferred marks also expire on
   * the double-rAF timer (see module doc); `deferUntilCommit` marks stay
   * pending until the publisher consumes them or the revoke runs. */
  markLayoutSource: (
    attribution: ChangeAttribution,
    deferUntilCommit?: boolean,
  ) => () => void;
  /** Claim the next committed store change as canonicalization (§2):
   * recorded, never emitted. An explicit attribution in flight or an active
   * resize session wins — the claim is then a no-op. */
  markCanonicalChange: () => void;
  /** Best-effort attribution for per-panel committed callbacks: active
   * resize session, else pending mark, else the last recorded attribution. */
  getChangeAttribution: () => PanelChangeDetails;
  /** Record the transaction baseline at resize-session start: the first
   * emitted change chains its `previousValue` from here rather than from an
   * older emitted event (§4). */
  setEventBaseline: (layout: PanelGroupLayout) => void;
  /** Synchronous, atomic emission for an applied layout (setValue, reset,
   * restore). Peers commit through stores while docked panels commit through
   * React state one commit later; waiting for store observation would split
   * one apply into two emissions (observed deterministically on React 18
   * async restores). The publisher dedups the commit echoes against the
   * value recorded here. Returns whether a change was emitted — an
   * unchanged apply emits nothing (§10). */
  emitAppliedLayout: (
    applied: PanelGroupLayout,
    attribution: ChangeAttribution,
  ) => boolean;
  /** End-of-session emission (§4 / R-04: no resize transaction may end with
   * its final session value unemitted). Called by `endResize` BEFORE the end
   * callback fires and BEFORE the controlled re-commit reopens the echo
   * suppression window: emits `final` with the active session's resize
   * attribution iff it differs from the last emitted value. When the
   * publisher already emitted the final value (the common, unjanked case)
   * this is a silent no-op — the final value is never duplicated. */
  emitFinalResizeValue: (final: PanelGroupLayout) => void;
  /** Record the live controlled proposal for the active resize session; the
   * publisher emits proposals from here instead of observed store state. */
  recordControlledProposal: (proposal: PanelGroupLayout) => void;
  /** Drop the controlled proposal when the resize transaction ends. */
  clearControlledProposal: () => void;
  /** Apply a parent-owned layout without publishing it back as a proposal.
   * Panel-local docked state may commit on the following React render, so
   * the suppression spans one animation frame and covers both the
   * synchronous peer-store update and that local-state registration pass. */
  commitControlledLayout: (layout: PanelGroupLayout) => void;
  /** Unmount cleanup: cancel a scheduled controlled-commit close frame. */
  cancelScheduledControlledCommit: () => void;
  /** First-frame publisher setup: record the initial dedup baselines and
   * open emission. SSR and the first client render emit no change (§2). */
  initializePublisher: (current: PanelGroupLayout) => void;
  /** Children-commit pass. Child membership changes the published value when
   * identified panels enter or leave — emitted as `children`/`system`. Pure
   * reorders keep the value identical and stay silent (§2). */
  reconcileChildren: (committed: PanelGroupLayout) => void;
  /** Store-commit notification. Captures attribution synchronously at
   * notification time, coalesces bursts into one microtask, then dedups and
   * emits (or records canonicalization) in that microtask. */
  notifyStoreCommit: () => void;
  /** Publisher-effect cleanup (R-30): a pass scheduled by a notification
   * that arrived during THIS subscription's lifetime must never drain after
   * it — during full teardown the queued microtask would otherwise observe
   * the empty registry and emit `{}` with the fallback attribution. The
   * cancel is instance-scoped, not permanent: the next `notifyStoreCommit`
   * schedules a fresh pass, and a re-subscribing effect instance re-reports
   * membership deltas from live state via `reconcileChildren`. Safe to call
   * with no pass queued. */
  cancelScheduledPublish: () => void;
};

/** The in-flight resize transaction's attribution facts. `null` while no
 * session is active; the session mechanics themselves stay in panel-group. */
export type ActiveResizeAttribution = {
  trigger: Extract<PanelValueChangeTrigger, "pointer" | "keyboard">;
  handleId?: string;
};

export type ChangeLedgerDeps = {
  /** Read the committed live layout from the group's stores/registry. */
  readLayout: () => PanelGroupLayout;
  /** The controlled `value` prop as an internal layout, when controlled. */
  getControlledLayout: () => PanelGroupLayout | undefined;
  /** Attribution facts of the active resize session, or null. Precedence:
   * an active session wins over any pending mark (§4). */
  getActiveResize: () => ActiveResizeAttribution | null;
  /** Deliver one value change (or controlled proposal) to the group's
   * `onValueChange`. The ledger has already resolved dedup and chaining. */
  dispatchValueChange: (
    next: PanelGroupLayout,
    previous: PanelGroupLayout,
    attribution: ChangeAttribution,
  ) => void;
  /** Persistence seam, mark side: record a pending explicit mutation for the
   * group's hydration dirty flag. Returns the undo the §10 revoke handle
   * invokes; the undo must restore the dirty state exactly as it was when
   * the mark landed. */
  markPersistenceDirty: (trigger: PanelValueChangeTrigger) => () => void;
  /** Persistence seam, landing side: an api- or keyboard-triggered change
   * was emitted. Atomic explicit changes flush persistence immediately;
   * pointer changes stream through the debounced writer instead, with their
   * explicit flush at transaction end (endResize). */
  explicitChangeLanded: (next: PanelGroupLayout) => void;
  /** Apply a controlled layout to the group's stores (reconciliation
   * mechanics only — no emission, no attribution). */
  applyControlledLayout: (layout: PanelGroupLayout) => void;
};

export type ChangeLedgerSchedulers = {
  /** `queueMicrotask`. */
  microtask: (cb: () => void) => void;
  /** `requestAnimationFrame` when available. Returns `null` when frame
   * scheduling is unavailable so call sites apply their documented
   * microtask fallbacks. Handles must be nonzero (`0` means "none"). */
  requestFrame: (cb: () => void) => number | null;
  /** `cancelAnimationFrame` (no-op when unavailable). */
  cancelFrame: (handle: number) => void;
};

/** Real schedulers. Availability is checked at call time, matching the
 * original inline `typeof requestAnimationFrame` guards. */
const runtimeSchedulers: ChangeLedgerSchedulers = {
  microtask: (cb) => queueMicrotask(cb),
  requestFrame: (cb) =>
    typeof requestAnimationFrame === "undefined"
      ? null
      : requestAnimationFrame(cb),
  cancelFrame: (handle) => {
    if (typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(handle);
    }
  },
};

export function createChangeLedger(
  deps: ChangeLedgerDeps,
  schedulers: ChangeLedgerSchedulers = runtimeSchedulers,
): ChangeLedger {
  /** Explicit attribution for the next observed change, until consumed by
   * the publisher, revoked, or expired by the deferred clear. */
  let pendingSource: ChangeAttribution | null = null;
  /** Latest non-canonical attribution, kept for per-panel committed
   * callbacks that fire after the pending microtask window has closed. */
  let lastAttribution: ChangeAttribution = {
    reason: "set-value",
    trigger: "api",
  };
  /** Sentinel: the next committed store change is canonicalization
   * (measurement settling, e.g. a peer pool's first allocation), never
   * emitted (§2). */
  let canonicalChangePending = false;
  /** The last EMITTED value — what `previousValue` chains from (§4). */
  let lastEventLayout: PanelGroupLayout | null = null;
  /** The last PUBLISHED snapshot — what the uncontrolled dedup and the
   * membership pass compare against. */
  let lastPublishedLayout: PanelGroupLayout | null = null;
  let publisherInitialized = false;
  /** Live controlled proposal for the active resize session. */
  let controlledProposal: PanelGroupLayout | null = null;
  /** True while a controlled commit's one-frame suppression window is open. */
  let controlledCommitInProgress = false;
  let controlledCommitFrame = 0;
  /** One publish microtask coalesces a burst of store notifications. */
  let publishQueued = false;
  /** Publisher-subscription epoch (R-30). A queued pass captures the epoch
   * at schedule time; `cancelScheduledPublish` bumps it, so a cancelled
   * pass drains as a no-op WITHOUT touching `publishQueued` — a fresh pass
   * scheduled by the next subscription may already be queued behind it. */
  let publishEpoch = 0;

  /** Emit one value change (or controlled proposal). `previous` is the
   * immediately prior emitted value; the first change of a pointer
   * transaction passes the transaction baseline explicitly. */
  const emitValueChange = (
    next: PanelGroupLayout,
    attribution: ChangeAttribution,
    previous = lastEventLayout ?? next,
  ) => {
    deps.dispatchValueChange(next, previous, attribution);
    // Atomic explicit changes flush persistence immediately. Pointer
    // changes stream through the debounced writer; their explicit flush
    // happens once at transaction end (endResize).
    if (attribution.trigger === "api" || attribution.trigger === "keyboard") {
      deps.explicitChangeLanded(next);
    }
    lastEventLayout = next;
  };

  const commitControlledLayout = (nextLayout: PanelGroupLayout) => {
    controlledCommitInProgress = true;
    if (controlledCommitFrame) {
      schedulers.cancelFrame(controlledCommitFrame);
    }
    deps.applyControlledLayout(nextLayout);
    const finish = () => {
      controlledCommitFrame = 0;
      controlledCommitInProgress = false;
      const committed = deps.readLayout();
      lastPublishedLayout = committed;
      if (deps.getActiveResize() === null) {
        lastEventLayout = committed;
        controlledProposal = null;
      }
    };
    const handle = schedulers.requestFrame(finish);
    if (handle === null) schedulers.microtask(finish);
    else controlledCommitFrame = handle;
  };

  return {
    markLayoutSource: (attribution, deferUntilCommit = false) => {
      const undoPersistenceDirty = deps.markPersistenceDirty(
        attribution.trigger,
      );
      const previousAttribution = lastAttribution;
      canonicalChangePending = false;
      pendingSource = attribution;
      lastAttribution = attribution;
      // Revoke handle: a rejected or unchanged action must leave no
      // attribution or persistence footprint (§10).
      const revoke = () => {
        if (pendingSource === attribution) {
          pendingSource = null;
        }
        if (lastAttribution === attribution) {
          lastAttribution = previousAttribution;
        }
        undoPersistenceDirty();
      };
      if (deferUntilCommit) return revoke;
      // The attributed change may commit through React state (docked panel
      // collapse/size), whose store notification lands after the current
      // task's microtasks. Keep the mark alive until the frame after the
      // commit; the publisher consumes it earlier when a change is
      // observed.
      const clear = () => {
        if (pendingSource === attribution) {
          pendingSource = null;
        }
      };
      const firstFrame = schedulers.requestFrame(() => {
        schedulers.requestFrame(clear);
      });
      if (firstFrame === null) schedulers.microtask(clear);
      return revoke;
    },

    markCanonicalChange: () => {
      // An explicit attribution in flight wins: canonicalization only claims
      // otherwise-unattributed settling.
      if (pendingSource || deps.getActiveResize()) return;
      canonicalChangePending = true;
    },

    getChangeAttribution: (): PanelChangeDetails => {
      const active = deps.getActiveResize();
      if (active) return { reason: "resize", trigger: active.trigger };
      const pending = pendingSource ?? lastAttribution;
      return { reason: pending.reason, trigger: pending.trigger };
    },

    setEventBaseline: (layout) => {
      lastEventLayout = layout;
    },

    emitAppliedLayout: (applied, attribution) => {
      const previous = lastEventLayout ?? lastPublishedLayout ?? applied;
      if (panelValuesEqual(previous.panels, applied.panels)) return false;
      lastPublishedLayout = applied;
      if (deps.getControlledLayout()) {
        controlledProposal = applied;
      }
      // emitValueChange also signals the persistence layer for
      // api-triggered changes (explicitChangeLanded).
      emitValueChange(applied, attribution, previous);
      const controlled = deps.getControlledLayout();
      if (controlled) {
        commitControlledLayout(controlled);
      }
      return true;
    },

    emitFinalResizeValue: (final) => {
      const active = deps.getActiveResize();
      // Only a live transaction has a final session value; endResize calls
      // this from its end microtask, before the session ref clears.
      if (!active) return;
      // "Already emitted" is exactly the previousValue this emission would
      // chain from: the last emitted value (§4). Equal means the publisher
      // beat the end path to it — emitting again would duplicate the final
      // value.
      const previous = lastEventLayout ?? lastPublishedLayout ?? final;
      if (panelValuesEqual(previous.panels, final.panels)) return;
      // Align the publisher baselines so its (possibly still queued) final
      // pass dedups to silence instead of re-emitting.
      lastPublishedLayout = final;
      if (deps.getControlledLayout()) {
        controlledProposal = final;
      }
      emitValueChange(
        final,
        {
          reason: "resize",
          trigger: active.trigger,
          handleId: active.handleId,
        },
        previous,
      );
    },

    recordControlledProposal: (proposal) => {
      controlledProposal = proposal;
    },

    clearControlledProposal: () => {
      controlledProposal = null;
    },

    commitControlledLayout,

    cancelScheduledControlledCommit: () => {
      if (controlledCommitFrame) {
        schedulers.cancelFrame(controlledCommitFrame);
      }
    },

    initializePublisher: (current) => {
      lastPublishedLayout = current;
      lastEventLayout ??= current;
      publisherInitialized = true;
    },

    reconcileChildren: (committed) => {
      if (
        !controlledCommitInProgress &&
        !deps.getControlledLayout() &&
        publisherInitialized &&
        !panelValuesEqual(
          lastPublishedLayout?.panels ?? committed.panels,
          committed.panels,
        )
      ) {
        emitValueChange(
          committed,
          { reason: "children", trigger: "system" },
          lastPublishedLayout ?? committed,
        );
      }
      lastPublishedLayout = committed;
    },

    notifyStoreCommit: () => {
      if (publishQueued) return;
      publishQueued = true;
      const active = deps.getActiveResize();
      const attribution: ChangeAttribution =
        (active
          ? {
              reason: "resize",
              trigger: active.trigger,
              handleId: active.handleId,
            }
          : pendingSource) ??
        ({ reason: "set-value", trigger: "api" } as const);
      // Canonicalization: measurement settling (a peer pool's first
      // allocation) is recorded (so later changes chain correctly) but
      // never emitted (§2).
      const canonical = !active && !pendingSource && canonicalChangePending;
      canonicalChangePending = false;
      if (pendingSource === attribution) {
        pendingSource = null;
      }
      const epoch = publishEpoch;
      schedulers.microtask(() => {
        // Cancelled by the scheduling subscription's cleanup (R-30): the
        // world this pass captured is gone. `publishQueued` belongs to
        // whichever pass the CURRENT epoch scheduled — leave it alone.
        if (epoch !== publishEpoch) return;
        publishQueued = false;
        if (controlledCommitInProgress) return;
        const observed = deps.readLayout();
        const controlled = deps.getControlledLayout();
        const next = controlled ? (controlledProposal ?? observed) : observed;
        const previous = lastPublishedLayout;
        // Dedup against exactly what an emission would report as
        // previousValue. In controlled mode that is the last EMITTED
        // proposal — the controlled re-commit resets the published
        // snapshot to the prop value, and comparing against that would
        // re-emit an unchanged proposal on every commit echo (§4: the
        // final value is never duplicated).
        const baseline = controlled
          ? (lastEventLayout ?? previous ?? next)
          : (previous ?? next);
        if (panelValuesEqual(baseline.panels, next.panels)) {
          // Keep topology fresh so a silent reorder cannot resurface as a
          // later spurious membership change.
          lastPublishedLayout = next;
          return;
        }
        lastPublishedLayout = next;
        if (controlled) {
          controlledProposal = next;
        }
        if (canonical) {
          lastEventLayout = next;
          return;
        }
        emitValueChange(next, attribution, baseline);
        const controlledNow = deps.getControlledLayout();
        if (controlledNow) {
          commitControlledLayout(controlledNow);
        }
      });
    },

    cancelScheduledPublish: () => {
      publishEpoch += 1;
      // Reopen scheduling immediately: a re-subscribing effect instance
      // must be able to queue a fresh pass even though the cancelled one
      // has not drained yet (it will no-op on the epoch check).
      publishQueued = false;
    },
  };
}
