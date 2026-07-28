"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChangeAttribution } from "../core/change-ledger.js";
import type { KeyedStore } from "../core/keyed-store.js";
import {
  createPanelGroupLayout,
  parsePersistedValue,
  serializePersistedValue,
} from "../core/layout-state.js";
import {
  enqueuePersistenceWrite,
  type PersistenceWriteResult,
} from "../core/persistence-write.js";
import { PERSISTENCE_WRITE_DEBOUNCE_MS } from "../core/timing.js";
import type {
  InternalPanelControls,
  PanelGroupLayout,
  PanelGroupOrientation,
  PanelGroupPersistenceOptions,
  PanelLayoutMap,
  PanelPersistenceError,
  PanelPersistenceStatus,
  PanelStorage,
  PanelValueChangeTrigger,
} from "../types.js";

type PersistenceIdentity = {
  key: string | undefined;
  storage: PanelStorage | null;
  orientation: PanelGroupOrientation;
  mountedGroupGeneration: object;
};

type PersistenceHydrationState = {
  identity: PersistenceIdentity;
  generation: number;
  readEnabled: boolean;
  status: "pending" | "ready";
  dirty: boolean;
  /** Set when the restore read failed (storage error or invalid record).
   * While set, write-back is suppressed so current defaults cannot
   * overwrite the record that could not be read; the first explicit
   * mutation reopens the gate. */
  writeBlocked: boolean;
  /** `restoring` was already reported for this generation. Strict Mode
   * re-runs the read effect after an async read was cancelled; the status
   * contract is exactly one `restoring` per restore attempt. */
  restoringReported: boolean;
};

/** The persistence callbacks the group routes through its render-fresh
 * callbacks ref. Structurally a subset of the group's full callbacks ref,
 * so the group can pass its own ref directly. */
type PersistenceCallbacksRef = {
  readonly current: {
    onPersistenceError?: (error: PanelPersistenceError) => void;
    onPersistenceStatusChange?: (status: PanelPersistenceStatus) => void;
  };
};

export type GroupPersistenceState = ReturnType<typeof useGroupPersistenceState>;

/**
 * The synchronous half of `<PanelGroup persistence>`: configuration
 * identity, the hydration state machine's refs, and the dirty/write-gate
 * callbacks the ledger and resize sessions consult. Owns no effects — the
 * asynchronous read/write lifecycle lives in `useGroupPersistenceEffects`,
 * called later in the group so its effects keep their original registration
 * order relative to allocation and the publisher.
 */
export function useGroupPersistenceState({
  persistence,
  hasControlledValue,
  orientation,
}: {
  persistence: PanelGroupPersistenceOptions | undefined;
  /** Controlled `value` and built-in persistence are mutually exclusive
   * (§12): a controlled parent owns storage and restoration. */
  hasControlledValue: boolean;
  orientation: PanelGroupOrientation;
}) {
  // The persistence options object is routinely a fresh literal each
  // render; identity-sensitive machinery keys off the stable fields
  // (key, storage, orientation) while callbacks route through the group's
  // callbacks ref like every other event prop.
  const persistenceKey = persistence?.key;
  // Resolved at render time, not frozen in mount state: a group that
  // mounts with a custom `persistence.storage` and later drops the option
  // must fall back to the default adapter instead of silently disabling
  // persistence (R-06). Safe to call every render: `getDefaultStorage`
  // is a cheap property read and identity-stable — `window.localStorage`
  // is the same Storage object on every access (and the SSR/denied paths
  // return null consistently) — so `effectiveStorage` only changes
  // identity on a genuine configuration change, and the
  // `persistenceIdentity` memo below does not churn hydration.
  const effectiveStorage = persistence?.storage ?? getDefaultStorage();
  // Persistence reads belong to one exact mounted-group configuration.
  // Object identity distinguishes adapters, while the mount token prevents
  // an async completion from a discarded group instance being confused with
  // a later instance that happens to reuse the same public key.
  const mountedGroupGeneration = useRef<object>({}).current;
  const persistenceIdentity = useMemo<PersistenceIdentity>(
    () => ({
      key: persistenceKey,
      storage: effectiveStorage,
      orientation,
      mountedGroupGeneration,
    }),
    [persistenceKey, effectiveStorage, mountedGroupGeneration, orientation],
  );
  // Controlled `value` and built-in persistence are mutually exclusive
  // (§12): a controlled parent owns storage and restoration, so neither
  // reads nor writes run. `defaultValue` does NOT disable restoration —
  // it is the SSR/first-paint fallback that a valid restored value then
  // replaces.
  const persistenceEnabled = Boolean(
    persistenceKey && effectiveStorage && !hasControlledValue,
  );
  const hydrationGenerationCounterRef = useRef(1);
  // The ref is the synchronous authority checked by interaction handlers and
  // async completions. `hydrationRevision` only asks React to reconsider the
  // write-back effect when a pending generation becomes ready.
  const hydrationStateRef = useRef<PersistenceHydrationState>({
    identity: persistenceIdentity,
    generation: 1,
    readEnabled: persistenceEnabled,
    status: persistenceEnabled ? "pending" : "ready",
    dirty: false,
    writeBlocked: false,
    restoringReported: false,
  });
  const [hydrationRevision, setHydrationRevision] = useState(0);
  void hydrationRevision;
  const hydrationMatchesCurrentConfiguration =
    persistenceIdentitiesEqual(
      hydrationStateRef.current.identity,
      persistenceIdentity,
    ) && hydrationStateRef.current.readEnabled === persistenceEnabled;
  const storageHydrated =
    hydrationMatchesCurrentConfiguration &&
    hydrationStateRef.current.status === "ready";

  const flushPersistenceRef = useRef<(layout?: PanelGroupLayout) => void>(
    () => {},
  );

  const markPersistenceDirty = useCallback(
    (trigger: PanelValueChangeTrigger) => {
      if (trigger === "system") return;
      const hydration = hydrationStateRef.current;
      if (hydration.status === "pending") hydration.dirty = true;
    },
    [],
  );
  // Ledger seam, mark side: pair the hydration dirty flag with the mark,
  // and hand back the undo the §10 revoke handle runs. The captures happen
  // here so the ledger never sees hydration state.
  const markPersistenceDirtyRevocable = useCallback(
    (trigger: PanelValueChangeTrigger): (() => void) => {
      const hydration = hydrationStateRef.current;
      const wasDirty = hydration.dirty;
      markPersistenceDirty(trigger);
      return () => {
        if (!wasDirty && hydrationStateRef.current === hydration) {
          hydration.dirty = false;
        }
      };
    },
    [markPersistenceDirty],
  );
  // A completed explicit mutation is the user taking ownership of the
  // layout; it reopens the write gate closed by a failed restore read.
  // Called only where an explicit change actually lands (transaction end /
  // applied layout), never for rejected or no-op actions.
  const reopenPersistenceWriteGate = useCallback(() => {
    const hydration = hydrationStateRef.current;
    if (hydration.status === "ready" && hydration.writeBlocked) {
      hydration.writeBlocked = false;
    }
  }, []);

  return {
    persistenceKey,
    effectiveStorage,
    persistenceIdentity,
    persistenceEnabled,
    hydrationGenerationCounterRef,
    hydrationStateRef,
    setHydrationRevision,
    storageHydrated,
    flushPersistenceRef,
    markPersistenceDirty,
    markPersistenceDirtyRevocable,
    reopenPersistenceWriteGate,
  };
}

/**
 * The asynchronous persistence lifecycle: the identity-reset effect, the
 * mount-time restore read, and the debounced write-back subscription.
 * Deliberately a separate hook from `useGroupPersistenceState` so the group
 * can register these effects late — after allocation and the publisher —
 * exactly where their effect order always was.
 */
export function useGroupPersistenceEffects({
  state,
  callbacksRef,
  childOrderLength,
  propSeedLayout,
  setSnapshot,
  setSkipAnimation,
  applyLayout,
  getCurrentLayout,
  controlledLayoutRef,
  panelControls,
  peerSizes,
  layoutTokens,
}: {
  state: GroupPersistenceState;
  callbacksRef: PersistenceCallbacksRef;
  childOrderLength: number;
  /** Server/first-paint seed derived from the group's props; identity reset
   * restores the snapshot to it. */
  propSeedLayout: PanelGroupLayout | null;
  setSnapshot: (panels: PanelLayoutMap | null) => void;
  setSkipAnimation: (skip: boolean) => void;
  applyLayout: (
    nextLayout: PanelGroupLayout,
    attribution?: ChangeAttribution,
  ) => PanelGroupLayout | null;
  getCurrentLayout: () => PanelGroupLayout;
  controlledLayoutRef: { readonly current: PanelGroupLayout | undefined };
  panelControls: KeyedStore<object, InternalPanelControls>;
  peerSizes: KeyedStore<object, number>;
  layoutTokens: readonly object[];
}) {
  const {
    persistenceKey,
    effectiveStorage,
    persistenceIdentity,
    persistenceEnabled,
    hydrationGenerationCounterRef,
    hydrationStateRef,
    setHydrationRevision,
    storageHydrated,
    flushPersistenceRef,
  } = state;
  const persistenceCleanupTokenRef = useRef<object | null>(null);
  const reportedWriteErrorsRef = useRef(
    new WeakMap<PanelStorage, Map<string, number>>(),
  );

  useLayoutEffect(() => {
    const previous = hydrationStateRef.current;
    if (
      persistenceIdentitiesEqual(previous.identity, persistenceIdentity) &&
      previous.readEnabled === persistenceEnabled
    )
      return;
    // The current save callback belongs to the previous identity and closes
    // over its orientation. Flush it before resetting hydration state so a
    // key/storage/orientation transition cannot discard the latest layout or
    // accidentally serialize it under the new identity.
    flushPersistenceRef.current();
    hydrationGenerationCounterRef.current += 1;
    hydrationStateRef.current = {
      identity: persistenceIdentity,
      generation: hydrationGenerationCounterRef.current,
      readEnabled: persistenceEnabled,
      status: persistenceEnabled ? "pending" : "ready",
      dirty: false,
      writeBlocked: false,
      restoringReported: false,
    };
    setSnapshot(propSeedLayout?.panels ?? null);
    setHydrationRevision((revision) => revision + 1);
  }, [
    persistenceIdentity,
    persistenceEnabled,
    propSeedLayout,
    flushPersistenceRef,
    hydrationGenerationCounterRef,
    hydrationStateRef,
    setHydrationRevision,
    setSnapshot,
  ]);

  useLayoutEffect(() => {
    const hydration = hydrationStateRef.current;
    if (
      !persistenceIdentitiesEqual(hydration.identity, persistenceIdentity) ||
      hydration.readEnabled !== persistenceEnabled ||
      hydration.status !== "pending" ||
      !hydration.readEnabled ||
      childOrderLength === 0
    )
      return;
    const { key: hydrationKey, orientation: hydrationOrientation } =
      hydration.identity;
    const hydrationStorage = hydration.identity.storage;
    if (!hydrationKey || !hydrationStorage) return;
    const generation = hydration.generation;
    const identity = hydration.identity;
    let cancelled = false;
    // Exactly one `restoring` per restore attempt: a Strict Mode effect
    // re-run after a cancelled async read must not repeat it.
    if (!hydration.restoringReported) {
      hydration.restoringReported = true;
      callbacksRef.current.onPersistenceStatusChange?.({
        state: "restoring",
        key: hydrationKey,
      });
    }
    const commit = (read: PersistenceReadResult) => {
      const active = hydrationStateRef.current;
      if (
        cancelled ||
        active.generation !== generation ||
        active.status !== "pending" ||
        !persistenceIdentitiesEqual(active.identity, identity)
      )
        return;
      active.status = "ready";
      // A failed read keeps the declarative fallback but must not let the
      // write-back effect overwrite the record that could not be read. An
      // explicit mutation (already recorded as dirty, or arriving later
      // through markPersistenceDirty) reopens the gate.
      if (read.failure) {
        if (!active.dirty) active.writeBlocked = true;
        callbacksRef.current.onPersistenceError?.({
          operation: read.failure.operation,
          key: hydrationKey,
          error: read.failure.error,
        });
      }
      // A restored value applies without transition but never becomes the
      // reset baseline — resetValue() restores declarative defaults.
      if (read.layout && !active.dirty) {
        setSkipAnimation(true);
        setSnapshot(read.layout.panels);
        applyLayout(read.layout, { reason: "restore", trigger: "system" });
      }
      // `ready` fires exactly once per restore attempt — commit is the
      // only pending→ready transition — whether the read succeeded, found
      // nothing, or failed.
      callbacksRef.current.onPersistenceStatusChange?.({
        state: "ready",
        key: hydrationKey,
      });
      setHydrationRevision((revision) => revision + 1);
    };
    const result = readLayoutValue(
      hydrationStorage,
      hydrationKey,
      hydrationOrientation,
    );
    if (isPromise(result)) void result.then(commit);
    else commit(result);
    return () => {
      cancelled = true;
    };
  }, [
    applyLayout,
    childOrderLength,
    persistenceIdentity,
    persistenceEnabled,
    setSkipAnimation,
    callbacksRef,
    hydrationStateRef,
    setHydrationRevision,
    setSnapshot,
  ]);

  // ─── persistence write-back ──────────────────────────────────────────────
  // Subscribed directly to this group's own docked ids and its peer-size
  // store — drags elsewhere in the tree never touch the debounce timer.
  // Adapter calls are coordinated globally by storage object + key, so
  // groups sharing a persistence destination cannot race each other.
  useEffect(() => {
    if (
      !persistenceEnabled ||
      !persistenceKey ||
      !effectiveStorage ||
      !storageHydrated
    )
      return;
    const hydrationAtStart = hydrationStateRef.current;
    if (
      !persistenceIdentitiesEqual(
        hydrationAtStart.identity,
        persistenceIdentity,
      ) ||
      hydrationAtStart.status !== "ready"
    )
      return;
    const generation = hydrationAtStart.generation;
    let t: ReturnType<typeof setTimeout> | undefined;
    let lastLiveLayout = controlledLayoutRef.current ?? getCurrentLayout();
    persistenceCleanupTokenRef.current = null;

    const reportResult = (result: PersistenceWriteResult) => {
      if (result.status !== "error") return;
      let revisionsByKey = reportedWriteErrorsRef.current.get(effectiveStorage);
      if (!revisionsByKey) {
        revisionsByKey = new Map();
        reportedWriteErrorsRef.current.set(effectiveStorage, revisionsByKey);
      }
      // Immediate interaction-end flushing, the layout publisher, and
      // StrictMode teardown may all observe the same coordinator request.
      // Report one adapter failure once to each mounted group instance.
      if (revisionsByKey.get(persistenceKey) === result.revision) return;
      revisionsByKey.set(persistenceKey, result.revision);
      callbacksRef.current.onPersistenceError?.({
        operation: "write",
        key: persistenceKey,
        error: result.error,
      });
    };
    const enqueueLayout = (next: PanelGroupLayout) => {
      const result = enqueuePersistenceWrite(
        effectiveStorage,
        persistenceKey,
        serializePersistedValue(next.orientation, next.panels),
      );
      // Coordinator promises always fulfill, including adapter failures.
      // Observing the result here provides a typed error surface without an
      // unhandled rejection or a poisoned queue.
      void result.then(reportResult);
    };
    const flush = (providedLayout?: PanelGroupLayout) => {
      if (t) {
        clearTimeout(t);
        t = undefined;
      }
      const hydration = hydrationStateRef.current;
      if (
        hydration.generation !== generation ||
        hydration.status !== "ready" ||
        hydration.writeBlocked ||
        !persistenceIdentitiesEqual(
          hydration.identity,
          hydrationAtStart.identity,
        )
      )
        return;
      lastLiveLayout =
        controlledLayoutRef.current ?? providedLayout ?? lastLiveLayout;
      enqueueLayout(lastLiveLayout);
    };
    const schedule = () => {
      // Store notifications run while panel registrations are still live.
      // Capture here rather than re-reading from a parent cleanup after its
      // children may already have unregistered.
      const observed = controlledLayoutRef.current ?? getCurrentLayout();
      // Child effects unregister before their parent during a real unmount.
      // Do not replace the last valid snapshot with that transient empty
      // registry; ordinary child removal still captures the remaining group.
      if (observed.order.length === layoutTokens.length) {
        lastLiveLayout = observed;
      }
      if (t) clearTimeout(t);
      t = setTimeout(flush, PERSISTENCE_WRITE_DEBOUNCE_MS);
    };
    flushPersistenceRef.current = flush;
    const unsubs = layoutTokens.map((token) =>
      panelControls.subscribeKey(token, schedule),
    );
    unsubs.push(peerSizes.subscribeAny(schedule));
    schedule();
    return () => {
      if (t) clearTimeout(t);
      for (const u of unsubs) u();
      if (flushPersistenceRef.current === flush) {
        flushPersistenceRef.current = () => {};
      }

      const hydration = hydrationStateRef.current;
      if (
        hydration.generation !== generation ||
        hydration.status !== "ready" ||
        hydration.writeBlocked ||
        !persistenceIdentitiesEqual(
          hydration.identity,
          hydrationAtStart.identity,
        )
      )
        return;

      // React StrictMode immediately re-runs effects after a synthetic
      // cleanup. Give that setup one microtask to cancel this token. A real
      // unmount has no replacement setup, so its synchronously captured
      // final layout is still enqueued without waiting for React state.
      const captured = controlledLayoutRef.current ?? lastLiveLayout;
      const cleanupToken = {};
      persistenceCleanupTokenRef.current = cleanupToken;
      queueMicrotask(() => {
        if (persistenceCleanupTokenRef.current !== cleanupToken) return;
        persistenceCleanupTokenRef.current = null;
        enqueueLayout(captured);
      });
    };
  }, [
    persistenceKey,
    persistenceEnabled,
    effectiveStorage,
    getCurrentLayout,
    panelControls,
    peerSizes,
    layoutTokens,
    persistenceIdentity,
    storageHydrated,
    callbacksRef,
    controlledLayoutRef,
    flushPersistenceRef,
    hydrationStateRef,
  ]);
}

function persistenceIdentitiesEqual(
  a: PersistenceIdentity,
  b: PersistenceIdentity,
): boolean {
  return (
    a.key === b.key &&
    a.storage === b.storage &&
    a.orientation === b.orientation &&
    a.mountedGroupGeneration === b.mountedGroupGeneration
  );
}

function getDefaultStorage(): PanelStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

type PersistenceReadFailure = {
  /** `read`: the adapter itself threw or rejected. `deserialize`: it
   * returned a value that is not a valid v1 layout document. */
  operation: "read" | "deserialize";
  error: unknown;
};

type PersistenceReadResult = {
  layout: PanelGroupLayout | null;
  /** Set when the storage read or deserialization failed, as opposed to a
   * genuinely empty entry. Failures must not open the write-back gate. */
  failure: PersistenceReadFailure | null;
};

function readLayoutValue(
  storage: PanelStorage,
  key: string,
  orientation: PanelGroupOrientation,
): PersistenceReadResult | Promise<PersistenceReadResult> {
  const parse = (value: string | null): PersistenceReadResult => {
    if (!value) return { layout: null, failure: null };
    try {
      const panels = parsePersistedValue(
        JSON.parse(value) as unknown,
        orientation,
      );
      // A non-empty record that fails version/schema/orientation validation
      // is a deserialization failure, not an empty entry. Pre-release
      // formats are rejected, never migrated.
      return {
        layout: panels
          ? createPanelGroupLayout(orientation, Object.keys(panels), panels)
          : null,
        failure: panels
          ? null
          : {
              operation: "deserialize",
              error: new Error(
                `Stored value under "${key}" is not a compatible persisted layout document. It was left untouched; the next accepted explicit change will overwrite it.`,
              ),
            },
      };
    } catch (error) {
      return { layout: null, failure: { operation: "deserialize", error } };
    }
  };
  const readFailure = (error: unknown): PersistenceReadResult => ({
    layout: null,
    failure: { operation: "read", error },
  });
  try {
    const raw = storage.getItem(key);
    if (isPromise(raw)) {
      return raw.then(parse).catch(readFailure);
    }
    return parse(raw);
  } catch (error) {
    return readFailure(error);
  }
}

function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof (value as Promise<T> | null)?.then === "function";
}
