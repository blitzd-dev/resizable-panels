"use client";

import {
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { KeyedStore } from "../core/keyed-store.js";
import { sizesDiffer } from "../core/size.js";
import type { PanelGroupContextType } from "../group/group-context.js";
import { usePanelLayoutInternal } from "../provider/contexts.js";
import type {
  InternalPanelControls,
  PanelActionOptions,
  PanelActionResult,
  PanelChangeDetails,
  PanelConfig,
  PanelControls,
  PanelSide,
  PanelValue,
  PanelValueChangeReason,
  SizeSpec,
} from "../types.js";
import type { PanelApi } from "./panel.js";

/** The `maximize`/`reset` compound actions. The result shaping is shared;
 * the size halves are the kinds' genuinely different size models, injected
 * as `readRequestedSize`/`resetSize` (§10). */
export function useCompoundSizeActions(
  maxPx: number,
  setSize: InternalPanelControls["setSize"],
  setCollapsed: InternalPanelControls["setCollapsed"],
  collapsible: boolean,
  defaultCollapsed: boolean,
  requestedCollapsedRef: { current: boolean },
  /** Fallback size reported when the size half was rejected outright.
   * Docked reads its requested-size ref (docked size is component state);
   * peers read the live basis from the group's peer store (allocator-
   * owned). */
  readRequestedSize: () => number,
  /** The size half of `reset`. Docked re-resolves its (required)
   * declarative `defaultSize` through its local clamp-and-commit path;
   * peers either hand an automatic panel back to the allocator's pool or
   * cascade an explicit default through the seam. */
  resetSize: (options?: PanelActionOptions) => {
    size: number;
    changed: boolean;
  },
): {
  maximize: InternalPanelControls["maximize"];
  reset: InternalPanelControls["reset"];
} {
  const maximize = useCallback(
    (options?: PanelActionOptions) => {
      const sizeResult = setSize(maxPx, options);
      const expandResult = setCollapsed(false, options);
      // A compound operation always reports the resulting numeric preferred
      // size, whichever half produced the change (§10).
      const value =
        sizeResult.applied || sizeResult.reason === "unchanged"
          ? sizeResult.value
          : readRequestedSize();
      const constrained =
        "constrained" in sizeResult ? sizeResult.constrained : false;
      return sizeResult.applied || expandResult.applied
        ? { applied: true as const, value, constrained }
        : {
            applied: false as const,
            reason: "unchanged" as const,
            value,
            constrained,
          };
    },
    [maxPx, readRequestedSize, setCollapsed, setSize],
  );
  const reset = useCallback(
    (options?: PanelActionOptions): PanelActionResult<PanelValue> => {
      const sizeOutcome = resetSize(options);
      const collapsedResult = collapsible
        ? setCollapsed(defaultCollapsed, options)
        : null;
      const changed =
        sizeOutcome.changed || (collapsedResult?.applied ?? false);
      const value: PanelValue = {
        size: sizeOutcome.size,
        ...(collapsible ? { collapsed: requestedCollapsedRef.current } : {}),
      };
      return changed
        ? { applied: true, value }
        : { applied: false, reason: "unchanged", value };
    },
    [
      collapsible,
      defaultCollapsed,
      requestedCollapsedRef,
      resetSize,
      setCollapsed,
    ],
  );
  return { maximize, reset };
}

/**
 * Publish this panel's controls to the provider registry under its group's
 * private token, keyed by `panelId`.
 *
 * useLayoutEffect (not useEffect): PanelGroup's auto-distribute reads the
 * registry before paint to size peers in the same frame the docked
 * toggles. With useEffect, the peer's resize lags by one frame.
 *
 * Registering is a store write, not a React state commit: it notifies only
 * subscribers of this panel (the parent group's docked summary, matching
 * usePanelControls consumers) instead of re-rendering every context
 * consumer in the tree.
 *
 * Split register/unregister: re-registering fires whenever `controls`
 * changes (every meaningful drag tick), but unregister-on-unmount has a
 * stable dep list so it only runs when the panel actually goes away.
 */
function useRegisterPanel(
  panelId: string | undefined,
  groupToken: object,
  controls: InternalPanelControls,
  markLayoutSource: (attribution: {
    reason: PanelValueChangeReason;
    trigger: "api";
  }) => () => void,
): PanelControls {
  const { store } = usePanelLayoutInternal();
  const ownerRef = useRef<object>({});
  const owner = ownerRef.current;
  // Project the broad internal controls to the public stable-facts shape
  // (§11). Actions attribute themselves as api-triggered, but only accepted
  // actions keep the mark — rejected and unchanged actions leave no
  // attribution, persistence, or suppression footprint (§10).
  const publicControls = useMemo<PanelControls>(() => {
    const run = <T extends { applied: boolean }>(
      reason: PanelValueChangeReason,
      action: () => T,
    ): T | { applied: false; reason: "disabled" } => {
      if (controls.config.disabled) {
        return { applied: false, reason: "disabled" as const };
      }
      const revoke = markLayoutSource({ reason, trigger: "api" });
      const result = action();
      if (!result.applied) revoke();
      return result;
    };
    const config = controls.config;
    const base = {
      orientation: config.orientation,
      size: controls.size,
      renderedSize: controls.renderedSize,
      // Public readouts report the EFFECTIVE state (R-33/R-37): the controlled
      // prop is authoritative; otherwise the stored bit OR the width-driven
      // auto-fold. A live gesture crossing the parent has not accepted is not
      // reported for a controlled panel.
      collapsed:
        controls.controlledCollapsed ??
        (controls.collapsed || controls.autoCollapsed),
      collapsible: config.collapsible,
      disabled: config.disabled ?? false,
      isReady: controls.isReady,
      constraints: {
        minSize: config.minSize,
        maxSize: config.maxSize,
        collapsedSize: config.collapsedSize,
      },
      setSize: (size: SizeSpec, options?: PanelActionOptions) =>
        run("resize", () => controls.setSize(size, options)),
      maximize: (options?: PanelActionOptions) =>
        run("resize", () => controls.maximize(options)),
      setCollapsed: (collapsed: boolean, options?: PanelActionOptions) =>
        run(collapsed ? "collapse" : "expand", () =>
          controls.setCollapsed(collapsed, options),
        ),
      collapse: (options?: PanelActionOptions) =>
        run("collapse", () => controls.collapse(options)),
      expand: (options?: PanelActionOptions) =>
        run("expand", () => controls.expand(options)),
      toggle: (options?: PanelActionOptions) =>
        run(
          (controls.controlledCollapsed ??
            (controls.collapsed || controls.autoCollapsed))
            ? "expand"
            : "collapse",
          () => controls.toggle(options),
        ),
      reset: (options?: PanelActionOptions) =>
        run("reset", () => controls.reset(options)),
    };
    return config.kind === "docked"
      ? { ...base, kind: "docked" as const, side: config.side as PanelSide }
      : { ...base, kind: "peer" as const };
  }, [controls, markLayoutSource]);
  useLayoutEffect(() => {
    if (!panelId) return;
    store.registerPanel(groupToken, panelId, owner, publicControls);
  }, [panelId, groupToken, owner, publicControls, store]);
  useLayoutEffect(() => {
    if (!panelId) return;
    return () => store.unregisterPanel(groupToken, panelId, owner);
  }, [panelId, groupToken, owner, store]);
  return publicControls;
}

/** Register every panel with its immediate group under a private token.
 * Unlike the public layout registry this is unconditional: id-less panels
 * still participate fully in sizing, ordering, cascades, and constraints. */
function useRegisterGroupPanel(
  token: object,
  controls: InternalPanelControls,
  store: KeyedStore<object, InternalPanelControls>,
  thresholdMotions: KeyedStore<object, unknown>,
) {
  useLayoutEffect(() => {
    store.set(token, controls);
  }, [token, controls, store]);
  useLayoutEffect(() => {
    return () => {
      store.delete(token);
      thresholdMotions.delete(token);
    };
  }, [token, store, thresholdMotions]);
}

/**
 * Assemble the internal controls object the group machinery consumes,
 * publish it (provider registry + group-internal registry), and expose the
 * imperative `apiRef` handle. The config half of `inputs` takes resolved
 * pixel values under their `PanelConfig` names. Every field is a memo
 * dependency, so the published controls can never carry a stale value; the
 * keyed store's `shallowEqualInternalControls` commit gate absorbs
 * identity-only churn. Named divergences between the kinds live in the
 * inputs: `size` (docked passes its committed/live-default preferred px;
 * peers their allocator basis), `isReady` (peers additionally wait for the
 * allocator to commit), and the two `PanelApi` readers below.
 */
export function usePanelWiring(
  inputs: PanelConfig &
    Omit<InternalPanelControls, "config"> & {
      apiRef: Ref<PanelApi> | undefined;
      token: object;
      group: PanelGroupContextType;
      /** `PanelApi.getSize`. Docked reads the registered controls'
       * committed preferred size, falling back to its local state; peers
       * read the live basis from the group's peer store — fresher than the
       * registered snapshot during a cascade. */
      readPanelSize: () => number;
      /** `PanelApi.getRenderedSize`. Both kinds read the registered
       * controls and fall back to their local collapsed-aware rendered
       * size (R-21 aligned the docked fallback, which used to report the
       * expanded effective size on a registry miss). */
      readPanelRenderedSize: () => number;
    },
) {
  const {
    apiRef,
    token,
    group,
    readPanelSize,
    readPanelRenderedSize,
    panelId,
    kind,
    orientation,
    side,
    defaultSize,
    minSize,
    maxSize,
    containerResizeBehavior,
    collapsible,
    autoCollapsible,
    defaultCollapsed,
    collapsedSize,
    resizableWhenCollapsed,
    disabled,
    pinned,
    collapseBelow,
    collapseBelowHysteresis,
    collapseBelowBehavior,
    collapsed,
    autoCollapsed,
    controlledCollapsed,
    applyCollapsedState,
    notifyCollapsedProposal,
    size,
    renderedSize,
    isReady,
    setCollapsed,
    setSize,
    maximize,
    collapse,
    expand,
    toggle,
    reset,
  } = inputs;
  const controls = useMemo<InternalPanelControls>(
    () => ({
      config: {
        panelId,
        kind,
        // Docked-only config keys; a peer config leaves them absent
        // entirely (the comparator treats absent and undefined alike, but
        // the published shape stays exactly what each kind always had).
        ...(kind === "docked" ? { side } : {}),
        orientation,
        defaultSize,
        minSize,
        maxSize,
        containerResizeBehavior,
        collapsible,
        autoCollapsible,
        defaultCollapsed,
        collapsedSize,
        resizableWhenCollapsed,
        disabled,
        ...(kind === "docked" ? { pinned } : {}),
        collapseBelow,
        collapseBelowHysteresis,
        collapseBelowBehavior,
      },
      collapsed,
      autoCollapsed,
      controlledCollapsed,
      applyCollapsedState,
      notifyCollapsedProposal,
      size,
      renderedSize,
      isReady,
      setCollapsed,
      setSize,
      maximize,
      collapse,
      expand,
      toggle,
      reset,
    }),
    [
      panelId,
      kind,
      side,
      orientation,
      defaultSize,
      minSize,
      maxSize,
      containerResizeBehavior,
      collapsible,
      autoCollapsible,
      defaultCollapsed,
      collapsedSize,
      resizableWhenCollapsed,
      disabled,
      pinned,
      collapseBelow,
      collapseBelowHysteresis,
      collapseBelowBehavior,
      collapsed,
      autoCollapsed,
      controlledCollapsed,
      applyCollapsedState,
      notifyCollapsedProposal,
      size,
      renderedSize,
      isReady,
      setCollapsed,
      setSize,
      maximize,
      collapse,
      expand,
      toggle,
      reset,
    ],
  );
  const publicControls = useRegisterPanel(
    panelId,
    group.registryToken,
    controls,
    group.markLayoutSource,
  );
  useRegisterGroupPanel(
    token,
    controls,
    group.panelControls,
    group.thresholdMotions,
  );
  const panelControls = group.panelControls;
  useImperativeHandle(
    apiRef,
    () => ({
      setSize: publicControls.setSize,
      maximize: publicControls.maximize,
      setCollapsed: publicControls.setCollapsed,
      collapse: publicControls.collapse,
      expand: publicControls.expand,
      toggle: publicControls.toggle,
      reset: publicControls.reset,
      // Effective state (R-33): a controlled panel's prop is authoritative.
      isCollapsed: () => {
        const current = panelControls.get(token);
        return current
          ? (current.controlledCollapsed ??
              (current.collapsed || current.autoCollapsed))
          : false;
      },
      getSize: readPanelSize,
      getRenderedSize: readPanelRenderedSize,
    }),
    [
      panelControls,
      publicControls,
      readPanelRenderedSize,
      readPanelSize,
      token,
    ],
  );
}

/** Committed, mount-suppressed per-panel notifications. `onSizeChange`
 * reports semantic preferred-size changes in pixels; `onCollapsedChange`
 * reports both directions of the collapsed transition. Details carry the
 * group's best-effort attribution for the change that committed. For a
 * panel with a controlled `collapsed` prop (R-33) the collapsed observer is
 * suppressed entirely: `onCollapsedChange` is the proposal channel there,
 * emitted per attempt from the foundation, and the acceptance re-render's
 * committed transition must not double-fire as a change event. */
export function usePanelCallbacks({
  panelId,
  size,
  collapsed,
  collapsedIsControlled = false,
  ready = true,
  onSizeChange,
  onCollapsedChange,
  getChangeAttribution,
}: {
  panelId?: string;
  size: number;
  collapsed: boolean;
  collapsedIsControlled?: boolean;
  ready?: boolean;
  onSizeChange?: (size: number, details: PanelChangeDetails) => void;
  onCollapsedChange?: (collapsed: boolean, details: PanelChangeDetails) => void;
  getChangeAttribution: () => PanelChangeDetails;
}) {
  void panelId;
  const callbacksRef = useRef({ onSizeChange, onCollapsedChange });
  callbacksRef.current = { onSizeChange, onCollapsedChange };
  const readyRef = useRef(false);
  const previousRef = useRef({ size, collapsed });

  useEffect(() => {
    if (!ready) return;
    const previous = previousRef.current;
    previousRef.current = { size, collapsed };
    if (!readyRef.current) {
      readyRef.current = true;
      return;
    }
    if (sizesDiffer(previous.size, size)) {
      callbacksRef.current.onSizeChange?.(size, getChangeAttribution());
    }
    if (previous.collapsed === collapsed) return;
    if (collapsedIsControlled) return;
    // The collapsed callback describes the collapsed BIT: its reason is always
    // collapse/expand (mirrors notifyCollapsedProposal's resize→direction
    // remap), never the ambient "resize"/"container-resize"/"restore" the
    // ledger happens to hold. The trigger is kept (system for width-driven
    // folds; the user's api/keyboard for an override-expand). R-37/F3.
    const { trigger } = getChangeAttribution();
    callbacksRef.current.onCollapsedChange?.(collapsed, {
      reason: collapsed ? "collapse" : "expand",
      trigger,
    });
  }, [collapsed, collapsedIsControlled, getChangeAttribution, ready, size]);
}
