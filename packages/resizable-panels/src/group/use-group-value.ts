"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  type ChangeAttribution,
  createChangeLedger,
} from "../core/change-ledger.js";
import { distributeContainerLayout } from "../core/container-layout.js";
import type { KeyedStore } from "../core/keyed-store.js";
import {
  createPanelGroupLayout,
  getPanelLayoutState,
  panelLayoutMapFromEntries,
  panelValuesEqual,
  reconcilePanelGroupLayout,
} from "../core/layout-state.js";
import { mapsAlmostEqual } from "../core/size.js";
import type {
  InternalPanelControls,
  PanelGroupCommandResult,
  PanelGroupLayout,
  PanelGroupOrientation,
  PanelGroupValue,
  PanelGroupValueChangeDetails,
  PanelLayoutMap,
  PanelLayoutState,
  PanelValueChangeTrigger,
} from "../types.js";
import { sortChildrenByDomOrder } from "./child-order.js";
import { effectiveCollapsed } from "./collapsed-state.js";
import type { ActiveResize, ChildEntry, PeerSlot } from "./group-context.js";
import { readContentBoxMainSize } from "./use-container-measurement.js";

/**
 * The group's value machinery: controlled/default layout wrapping, the
 * canonical current-layout reader, the change ledger (attribution, emission
 * dedup, controlled-commit suppression — see change-ledger.ts), and the
 * apply/reset/get/set command surface. Pure callbacks — the composition
 * root registers the publisher and controlled-commit effects itself so
 * every effect keeps its original registration order.
 */
export function useGroupValue({
  orientation,
  controlledValue,
  defaultValue,
  activeResizeRef,
  callbacksRef,
  panelControls,
  peerSizes,
  peerSlots,
  markExplicitPeerSize,
  explicitZeroPeersRef,
  childOrderRef,
  groupElementRef,
  reservedGutterSize,
  markPersistenceDirtyRevocable,
  reopenPersistenceWriteGate,
  flushPersistenceRef,
}: {
  orientation: PanelGroupOrientation;
  controlledValue: PanelGroupValue | undefined;
  defaultValue: PanelGroupValue | undefined;
  activeResizeRef: { readonly current: ActiveResize | null };
  callbacksRef: {
    readonly current: {
      onValueChange?: (
        value: PanelGroupValue,
        details: PanelGroupValueChangeDetails,
      ) => void;
    };
  };
  panelControls: KeyedStore<object, InternalPanelControls>;
  peerSizes: KeyedStore<object, number>;
  peerSlots: KeyedStore<object, PeerSlot>;
  markExplicitPeerSize: (token: object, size: number) => void;
  explicitZeroPeersRef: { current: Set<object> };
  childOrderRef: { readonly current: ChildEntry[] };
  groupElementRef: { readonly current: HTMLDivElement | null };
  reservedGutterSize: () => number;
  markPersistenceDirtyRevocable: (
    trigger: PanelValueChangeTrigger,
  ) => () => void;
  reopenPersistenceWriteGate: () => void;
  flushPersistenceRef: {
    readonly current: (layout?: PanelGroupLayout) => void;
  };
}) {
  // Public values carry no topology; wrap them into the internal snapshot
  // shape at the boundary. Key order stands in for order — reconciliation
  // against mounted children makes actual order irrelevant here.
  const wrapValue = useCallback(
    (value: PanelGroupValue): PanelGroupLayout =>
      createPanelGroupLayout(
        orientation,
        Object.keys(value),
        value as PanelLayoutMap,
      ),
    [orientation],
  );
  const controlledLayout = useMemo(
    () => (controlledValue ? wrapValue(controlledValue) : undefined),
    [controlledValue, wrapValue],
  );
  const controlledLayoutRef = useRef<PanelGroupLayout | undefined>(undefined);
  controlledLayoutRef.current = controlledLayout;

  // Server and first-client markup only depend on props. Persistence is
  // reconciled after hydration; pass the server-known value as
  // `defaultValue` when the first paint must already reflect it.
  const propSeedLayout = useMemo(
    () => controlledLayout ?? (defaultValue ? wrapValue(defaultValue) : null),
    [controlledLayout, defaultValue, wrapValue],
  );
  // Reset baseline: the currently authored `defaultValue` only. Controlled
  // values and restored persisted values must never become what
  // `resetValue()` returns to.
  const defaultValueRef = useRef(defaultValue);
  defaultValueRef.current = defaultValue;

  // biome-ignore lint/correctness/useExhaustiveDependencies: composition-root refs are stable for the group's lifetime; reading .current at call time (not render time) is the design.
  const getCurrentLayout = useCallback((): PanelGroupLayout => {
    const panels = new Map<string, PanelLayoutState>();
    const order: string[] = [];
    for (const entry of sortChildrenByDomOrder(childOrderRef.current)) {
      const key = entry.panelId;
      if (!key || panels.has(key)) continue;
      const controls = panelControls.get(entry.token);
      if (!controls) continue;
      order.push(key);
      panels.set(key, {
        size:
          entry.kind === "peer"
            ? (peerSizes.get(entry.token) ?? controls.size)
            : controls.size,
        ...(controls.config.collapsible
          ? { collapsed: effectiveCollapsed(controls) }
          : {}),
      });
    }
    return createPanelGroupLayout(
      orientation,
      order,
      panelLayoutMapFromEntries(panels),
    );
  }, [orientation, panelControls, peerSizes]);

  // getCurrentLayout / applyLayoutState change identity with orientation;
  // the once-created ledger reads them through refs so its dependency
  // functions never go stale.
  const getCurrentLayoutRef = useRef(getCurrentLayout);
  getCurrentLayoutRef.current = getCurrentLayout;
  const applyLayoutStateRef = useRef<
    (
      next: PanelGroupLayout,
      proposeControlledCollapsed?: boolean,
    ) => PanelGroupLayout | null
  >(() => null);
  // The change ledger owns attribution marking/revocation, canonical
  // claims, emission dedup baselines, and controlled-commit suppression
  // (§2/§4/§10 — see change-ledger.ts for the canonical invariant
  // statement). Every dependency below closes over stable refs or
  // []-dep callbacks, so creating it once per mounted group is safe.
  const [ledger] = useState(() =>
    createChangeLedger({
      readLayout: () => getCurrentLayoutRef.current(),
      getControlledLayout: () => controlledLayoutRef.current,
      getActiveResize: () => {
        const active = activeResizeRef.current;
        return active
          ? { trigger: active.trigger, handleId: active.handleId }
          : null;
      },
      dispatchValueChange: (next, previous, attribution) => {
        callbacksRef.current.onValueChange?.(next.panels, {
          previousValue: previous.panels,
          reason: attribution.reason,
          trigger: attribution.trigger,
          handleId: attribution.handleId,
        });
      },
      // Persistence seam, mark side: mark + undo pairing lives in the
      // persistence hook so the ledger never sees hydration state.
      markPersistenceDirty: markPersistenceDirtyRevocable,
      // Persistence seam, landing side: an emitted api/keyboard change is
      // the user taking ownership of the layout — reopen the write gate
      // and flush immediately.
      explicitChangeLanded: (next) => {
        reopenPersistenceWriteGate();
        flushPersistenceRef.current(controlledLayoutRef.current ?? next);
      },
      applyControlledLayout: (nextLayout) => {
        // A controlled-group commit is the parent's acceptance echo, not
        // an explicit application: a panel with its own controlled
        // `collapsed` prop keeps its bit silently (the panel prop wins —
        // R-33) instead of receiving a proposal per re-commit.
        applyLayoutStateRef.current(nextLayout, false);
      },
    }),
  );
  const markLayoutSource = ledger.markLayoutSource;

  // biome-ignore lint/correctness/useExhaustiveDependencies: composition-root refs are stable for the group's lifetime; reading .current at call time (not render time) is the design.
  const applyLayoutState = useCallback(
    (
      nextLayout: PanelGroupLayout,
      // Whether panels with a controlled `collapsed` prop receive the
      // applied value's collapsed bit as a PROPOSAL (their setCollapsed
      // routes to the proposal channel — R-33). True for explicit
      // applications (setValue, reset); false for persistence restores
      // (restores SKIP the collapsed field for controlled panels) and
      // controlled-group commits (acceptance echoes must not re-propose).
      proposeControlledCollapsed = true,
    ) => {
      if (nextLayout.orientation !== orientation) return null;
      const currentLayout = getCurrentLayout();
      const available = new Map<
        string,
        { minSize: number; maxSize: number; collapsible: boolean }
      >();
      const entriesById = new Map<string, ChildEntry>();
      for (const entry of childOrderRef.current) {
        const key = entry.panelId;
        if (!key || entriesById.has(key)) continue;
        const controls = panelControls.get(entry.token);
        if (!controls) continue;
        entriesById.set(key, entry);
        available.set(key, {
          minSize: controls.config.minSize,
          maxSize: controls.config.maxSize,
          collapsible: controls.config.collapsible,
        });
      }
      const reconciled = reconcilePanelGroupLayout(nextLayout, available);
      // Replacement semantics (§2): mounted identified panels omitted from
      // the applied value restore their declarative defaults. Automatic
      // peers have no explicit default — the allocator keeps owning them.
      for (const [id, entry] of entriesById) {
        if (getPanelLayoutState(reconciled, id)) continue;
        const controls = panelControls.get(entry.token);
        if (!controls) continue;
        const explicitDefault =
          entry.kind === "docked" ||
          peerSlots.get(entry.token)?.defaultSize !== undefined;
        if (!explicitDefault) continue;
        const defaultState: PanelLayoutState = {
          size: controls.config.defaultSize,
        };
        if (controls.config.collapsible) {
          defaultState.collapsed = controls.config.defaultCollapsed;
        }
        // defineProperty: a plain bracket write to an id like "__proto__"
        // would hit the prototype setter instead of defining a panel key.
        Object.defineProperty(reconciled, id, {
          value: defaultState,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      const nextPeerSizes = new Map(peerSizes.getMap());
      for (const [id, state] of Object.entries(reconciled)) {
        const entry = entriesById.get(id);
        if (!entry) continue;
        const controls = panelControls.get(entry.token);
        if (!controls) continue;
        if (entry.kind === "peer") {
          markExplicitPeerSize(entry.token, state.size);
          nextPeerSizes.set(entry.token, state.size);
        } else {
          controls.setSize(state.size);
        }
        if (
          state.collapsed !== undefined &&
          (controls.controlledCollapsed === undefined ||
            proposeControlledCollapsed)
        ) {
          // For a controlled panel this routes to the proposal channel
          // (nothing applies; `unchanged` values emit nothing — R-33).
          controls.setCollapsed(state.collapsed);
        }
      }
      if (!mapsAlmostEqual(peerSizes.getMap(), nextPeerSizes)) {
        peerSizes.replaceAll(nextPeerSizes);
      }

      const appliedPanels = new Map<string, PanelLayoutState>(
        Object.entries(currentLayout.panels).map(([id, state]) => [
          id,
          { ...state },
        ]),
      );
      for (const [id, state] of Object.entries(reconciled)) {
        // The reported outcome pins a controlled panel's collapsed bit to
        // its prop (R-33): the requested bit was proposed (or skipped),
        // never applied, and applied layouts report the EFFECTIVE state.
        const entry = entriesById.get(id);
        const controls = entry ? panelControls.get(entry.token) : undefined;
        appliedPanels.set(id, {
          ...getPanelLayoutState(currentLayout.panels, id),
          ...state,
          ...(controls && controls.controlledCollapsed !== undefined
            ? { collapsed: controls.controlledCollapsed }
            : {}),
        });
      }
      return createPanelGroupLayout(
        orientation,
        currentLayout.order,
        panelLayoutMapFromEntries(appliedPanels),
      );
    },
    [
      getCurrentLayout,
      markExplicitPeerSize,
      orientation,
      panelControls,
      peerSizes,
      peerSlots,
    ],
  );
  applyLayoutStateRef.current = applyLayoutState;

  const applyLayout = useCallback(
    (
      nextLayout: PanelGroupLayout,
      attribution: ChangeAttribution = {
        reason: "set-value",
        trigger: "api",
      },
    ): PanelGroupLayout | null => {
      markLayoutSource(attribution);
      // Persistence restores SKIP the collapsed field for panels with a
      // controlled `collapsed` prop — sizes still restore (R-33). Every
      // explicit application (setValue, reset) proposes instead.
      const appliedLayout = applyLayoutState(
        nextLayout,
        attribution.reason !== "restore",
      );
      // Emit the reconciled outcome synchronously and atomically (§2 —
      // see ChangeLedger.emitAppliedLayout for the full rationale). An
      // unchanged apply emits nothing, so it neither reopens the write
      // gate nor forces a write — only accepted mutations do (§12).
      if (appliedLayout) {
        ledger.emitAppliedLayout(appliedLayout, attribution);
      }
      return appliedLayout;
    },
    [applyLayoutState, ledger, markLayoutSource],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: composition-root refs are stable for the group's lifetime; reading .current at call time (not render time) is the design.
  const resetLayout = useCallback((): PanelGroupLayout | null => {
    const authoredDefault = defaultValueRef.current;
    if (authoredDefault) {
      return applyLayout(wrapValue(authoredDefault), {
        reason: "reset",
        trigger: "api",
      });
    }
    const entries = sortChildrenByDomOrder(childOrderRef.current);
    const measuredContainerSize = groupElementRef.current
      ? readContentBoxMainSize(groupElementRef.current, orientation)
      : 0;
    const defaults = distributeContainerLayout(
      Math.max(0, measuredContainerSize - reservedGutterSize()),
      entries.flatMap((entry) => {
        const controls = panelControls.get(entry.token);
        if (!controls) return [];
        const slot =
          entry.kind === "peer" ? peerSlots.get(entry.token) : undefined;
        const configuredDefault =
          entry.kind === "peer" ? slot?.defaultPx : controls.config.defaultSize;
        return [
          {
            token: entry.token,
            behavior: controls.config.containerResizeBehavior,
            // Resolve expanded preferences for every peer first. The
            // semantic default-collapsed state is committed below; keeping
            // its expanded preference lets a later expansion restore a
            // real allocated size instead of the old zero sentinel.
            collapsed: false,
            collapsedSize: controls.config.collapsedSize,
            currentSize: configuredDefault,
            defaultSize: configuredDefault,
            // Peer slots are registered from the same render that resolved
            // their container-relative bounds. The public/group controls
            // store can still contain the pre-measurement 0px bounds for
            // one layout-effect turn, so allocator inputs must use the slot
            // snapshot instead of that lagging copy.
            minSize:
              entry.kind === "peer"
                ? (slot?.minPx ?? controls.config.minSize)
                : controls.config.minSize,
            maxSize:
              entry.kind === "peer"
                ? (slot?.maxPx ?? controls.config.maxSize)
                : controls.config.maxSize,
          },
        ];
      }),
    );
    const nextPeerSizes = new Map(peerSizes.getMap());
    markLayoutSource({ reason: "reset", trigger: "api" });
    const appliedPanels = new Map<string, PanelLayoutState>();
    for (const entry of entries) {
      const controls = panelControls.get(entry.token);
      if (!controls) continue;
      let appliedSize = controls.size;
      if (entry.kind === "peer") {
        const allocated = defaults.sizes.get(entry.token);
        if (allocated !== undefined) {
          explicitZeroPeersRef.current.delete(entry.token);
          nextPeerSizes.set(entry.token, allocated);
          appliedSize = allocated;
        }
      } else {
        controls.setSize(controls.config.defaultSize);
        appliedSize = controls.config.defaultSize;
      }
      if (controls.config.collapsible) {
        // A controlled panel receives this as a proposal (R-33); the
        // reported outcome below pins to its authoritative prop.
        controls.setCollapsed(controls.config.defaultCollapsed);
      }
      if (entry.panelId) {
        appliedPanels.set(entry.panelId, {
          size: appliedSize,
          ...(controls.config.collapsible
            ? {
                collapsed:
                  controls.controlledCollapsed ??
                  controls.config.defaultCollapsed,
              }
            : {}),
        });
      }
    }
    if (!mapsAlmostEqual(peerSizes.getMap(), nextPeerSizes)) {
      peerSizes.replaceAll(nextPeerSizes);
    }
    return createPanelGroupLayout(
      orientation,
      entries.flatMap((entry) => (entry.panelId ? [entry.panelId] : [])),
      panelLayoutMapFromEntries(appliedPanels),
    );
  }, [
    applyLayout,
    markLayoutSource,
    orientation,
    panelControls,
    peerSizes,
    peerSlots,
    reservedGutterSize,
    wrapValue,
  ]);

  const getValue = useCallback(
    (): PanelGroupValue => getCurrentLayout().panels,
    [getCurrentLayout],
  );
  const setValue = useCallback(
    (value: PanelGroupValue) =>
      applyLayout(wrapValue(value), { reason: "set-value", trigger: "api" }),
    [applyLayout, wrapValue],
  );

  // Dispatcher command results report the reconciled layout the apply
  // computed. Docked panel sizes commit through React state, so re-reading
  // the live registry synchronously would lag one commit; the applied
  // layout from the reconciler is the authoritative outcome.
  const runGroupCommand = useCallback(
    (command: () => PanelGroupLayout | null): PanelGroupCommandResult => {
      const before = getCurrentLayout().panels;
      const applied = command();
      const after = applied?.panels ?? getCurrentLayout().panels;
      return panelValuesEqual(before, after)
        ? { applied: false, reason: "unchanged", value: after }
        : { applied: true, value: after };
    },
    [getCurrentLayout],
  );

  return {
    controlledLayout,
    controlledLayoutRef,
    propSeedLayout,
    getCurrentLayout,
    ledger,
    applyLayout,
    resetLayout,
    getValue,
    setValue,
    runGroupCommand,
  };
}
