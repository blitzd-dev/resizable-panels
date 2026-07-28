"use client";

import {
  type CSSProperties,
  type Ref,
  useCallback,
  useLayoutEffect,
} from "react";
import {
  clamp,
  resolveSizeField,
  SIZE_EPSILON,
  sizesDiffer,
} from "../core/size.js";
import { usePanelRenderedSize, usePeerSize } from "../group/group-context.js";
import type {
  PanelActionOptions,
  PanelActionResult,
  PanelSizeActionDetails,
  SizeSpec,
} from "../types.js";
import type { PeerPanelProps } from "./panel.js";
import { renderPanelShell, toCssSize } from "./panel-shell.js";
import { rejected, usePanelFoundation } from "./use-panel-foundation.js";
import {
  useCompoundSizeActions,
  usePanelCallbacks,
  usePanelWiring,
} from "./use-panel-wiring.js";
import { useThresholdPresentation } from "./use-threshold-motion.js";

// ─── peer panel ──────────────────────────────────────────────────────────────

type PeerPanelInternalProps = PeerPanelProps & {
  elementRef?: Ref<HTMLDivElement>;
};

export function PeerPanel({
  panelId,
  id,
  apiRef,
  slotProps,
  defaultSize,
  minSize = 0,
  maxSize = "100%",
  containerResizeBehavior = "proportional",
  disabled = false,
  collapsible: collapsibleProp = false,
  collapsed: controlledCollapsed,
  defaultCollapsed = false,
  collapsedSize = 0,
  resizableWhenCollapsed = false,
  collapseBelow,
  collapseBelowHysteresis = 12,
  collapseBelowBehavior = "animated",
  onSizeChange,
  onCollapsedChange,
  className,
  style,
  children,
  elementRef,
  ...elementProps
}: PeerPanelInternalProps) {
  // Resolve the R-37 auto mode (see SidePanel).
  const autoCollapsible = collapsibleProp === "auto";
  const collapsible = collapsibleProp === "auto" ? true : collapsibleProp;
  const f = usePanelFoundation({
    kind: "peer",
    panelId,
    id,
    elementRef,
    slotProps,
    minSize,
    maxSize,
    defaultSize,
    collapsible,
    autoCollapsible,
    defaultCollapsed,
    controlledCollapsed,
    onCollapsedChange,
    collapsedSize,
    collapseBelow,
    collapseBelowHysteresis,
    resizableWhenCollapsed,
    consumerInert: elementProps.inert === true,
  });
  const {
    group,
    layout,
    token,
    isHorizontal,
    contentSlotStyle,
    minPx,
    maxPx,
    defaultPx,
    ctx,
    sizeLabel,
    collapsedSizePx,
    collapseBelowPx,
    collapseBelowHysteresisPx,
    restored,
    collapsed,
    autoCollapsed,
    presentationCollapsed,
    requestedCollapsedRef,
    setSkipAnim,
    setCollapsed,
    collapse,
    expand,
    toggle,
  } = f;

  // An invalid optional peer defaultSize behaves as absent (§13): the
  // foundation resolves it to undefined and every default-driven decision
  // below — the explicit-basis flag, reset, and the bootstrap CSS basis —
  // must see the panel as automatic, exactly as if the prop were omitted.
  const effectiveDefaultSize =
    defaultPx === undefined ? undefined : defaultSize;

  // Stable function refs — see the docked registerChild effect for why we
  // don't depend on the whole group context here.
  const registerPeer = group.registerPeer;
  const registerChild = group.registerChild;
  const getOrderElement = f.getOrderElement;
  const domId = f.domId;

  // Register slot. The group will use min/max to clamp on seam drags and
  // defaultPx for initial distribution.
  useLayoutEffect(() => {
    return registerPeer(token, {
      defaultSize: effectiveDefaultSize,
      defaultIsExplicit:
        effectiveDefaultSize !== undefined || restored?.size !== undefined,
      boundsReady: group.containerSize > 0,
      minPx,
      maxPx,
      // Restored size takes precedence over the spec default so persisted
      // sizes survive across reloads.
      defaultPx: restored?.size ?? defaultPx,
    });
  }, [
    token,
    effectiveDefaultSize,
    group.containerSize,
    minPx,
    maxPx,
    defaultPx,
    restored?.size,
    registerPeer,
  ]);

  // Track document-order in the group's child registry.
  useLayoutEffect(() => {
    return registerChild({
      kind: "peer",
      token,
      panelId,
      domId,
      getElement: getOrderElement,
    });
  }, [domId, getOrderElement, registerChild, token, panelId]);

  const resolvedSize = usePeerSize(token);
  const size = resolvedSize ?? 0;
  const allocatedSize = usePanelRenderedSize(token);
  const renderedSize =
    allocatedSize ?? (presentationCollapsed ? collapsedSizePx : size);

  // Imperative size setter. Delegates to the group's setPeerSize helper,
  // which routes the change through the seam cascade and reports the size
  // it actually applied — the cascade may move less than the panel-local
  // clamp when neighbor capacity runs out (§10).
  const layoutSetSkipAnim = layout.setSkipAnim;
  const setSizeClamped = useCallback(
    (
      next: SizeSpec,
      options?: PanelActionOptions,
    ): PanelActionResult<number, PanelSizeActionDetails> => {
      const resolved = resolveSizeField(next, ctx, {
        label: sizeLabel,
        property: "setSize()",
        fallback: undefined,
      });
      if (resolved === undefined) return rejected("invalid-size");
      const clamped = clamp(resolved, minPx, maxPx);
      const liveSize = group.peerSizes.get(token) ?? size;
      if (!sizesDiffer(clamped, liveSize)) {
        return {
          applied: false,
          reason: "unchanged",
          value: liveSize,
          constrained: sizesDiffer(resolved, clamped),
        };
      }
      if (options?.transition === "none") {
        setSkipAnim(true);
        layoutSetSkipAnim(true);
      }
      if (requestedCollapsedRef.current) {
        // While collapsed, only the expansion-restore preference changes;
        // no cascade runs, so the preference is applied verbatim.
        group.setPeerPreferredSize(token, clamped);
        return {
          applied: true,
          value: clamped,
          constrained: sizesDiffer(resolved, clamped),
        };
      }
      const appliedPx = group.setPeerSize(token, clamped) ?? liveSize;
      const constrained =
        sizesDiffer(resolved, clamped) || sizesDiffer(appliedPx, clamped);
      if (!sizesDiffer(appliedPx, liveSize)) {
        return {
          applied: false,
          reason: "unchanged",
          value: liveSize,
          constrained,
        };
      }
      return { applied: true, value: appliedPx, constrained };
    },
    [
      ctx,
      token,
      minPx,
      maxPx,
      group,
      size,
      sizeLabel,
      layoutSetSkipAnim,
      requestedCollapsedRef,
      setSkipAnim,
    ],
  );
  // Peer maximize fallback and PanelApi.getSize: the live basis from the
  // group's peer store (peer size is allocator-owned; the store is fresher
  // than the registered controls snapshot during a cascade).
  const readPanelSize = useCallback(
    () => group.peerSizes.get(token) ?? size,
    [group.peerSizes, size, token],
  );
  const resetSize = useCallback(
    (options?: PanelActionOptions) => {
      const liveSize = group.peerSizes.get(token) ?? size;
      let resultingSize = liveSize;
      let sizeChanged = false;
      if (effectiveDefaultSize === undefined) {
        // Automatic peer: hand the panel back to the allocator, which
        // re-resolves the whole automatic pool (§10).
        const { size: allocated, changed: poolChanged } =
          group.resetAutomaticPeer(token);
        if (allocated !== null) {
          resultingSize = allocated;
          sizeChanged = sizesDiffer(allocated, liveSize);
        }
        // Suppression applies only to an accepted change (§10, R-20). The
        // pool path bypasses setSizeClamped's own gating, so gate on the
        // allocator committing a reallocation — pool-wide, since sibling
        // movement caused by this reset is part of the accepted change.
        // Raising the flags after the commit still lands them before it
        // paints: the store notification and these updates are React state
        // in the same task, so they batch into one commit (React 18+).
        if (poolChanged && options?.transition === "none") {
          setSkipAnim(true);
          layoutSetSkipAnim(true);
        }
      } else {
        const sizeResult = setSizeClamped(defaultPx ?? 0, options);
        if (sizeResult.applied || sizeResult.reason === "unchanged") {
          resultingSize = sizeResult.value;
        }
        sizeChanged = sizeResult.applied;
      }
      return { size: resultingSize, changed: sizeChanged };
    },
    [
      defaultPx,
      effectiveDefaultSize,
      group,
      layoutSetSkipAnim,
      setSizeClamped,
      setSkipAnim,
      size,
      token,
    ],
  );
  const { maximize, reset } = useCompoundSizeActions(
    maxPx,
    setSizeClamped,
    setCollapsed,
    collapsible,
    defaultCollapsed,
    requestedCollapsedRef,
    readPanelSize,
    resetSize,
  );

  // Peer rendered size tracks the basis in steady state; flex absorbs
  // small transient gaps during docked transitions, but the basis is
  // the right value to surface in UI readouts. Subscribed per-token, so
  // seam drags re-render only the peers whose sizes actually changed.
  usePanelCallbacks({
    // Effective state so a width-driven auto-fold emits an edge (R-37).
    collapsed: presentationCollapsed,
    collapsedIsControlled: f.collapsedIsControlled,
    panelId,
    onSizeChange,
    onCollapsedChange,
    getChangeAttribution: group.getChangeAttribution,
    ready: group.containerSize > 0 && resolvedSize !== undefined,
    size,
  });
  const readPanelRenderedSize = useCallback(
    () => group.panelControls.get(token)?.renderedSize ?? renderedSize,
    [group.panelControls, renderedSize, token],
  );
  usePanelWiring({
    apiRef,
    token,
    group,
    readPanelSize,
    readPanelRenderedSize,
    panelId,
    kind: "peer",
    orientation: group.orientation,
    defaultSize: defaultPx ?? 0,
    minSize: minPx,
    maxSize: maxPx,
    containerResizeBehavior,
    collapsible,
    autoCollapsible,
    defaultCollapsed,
    collapsedSize: collapsedSizePx,
    resizableWhenCollapsed,
    disabled,
    collapseBelow: collapseBelowPx,
    collapseBelowHysteresis: collapseBelowHysteresisPx,
    collapseBelowBehavior,
    collapsed,
    autoCollapsed,
    controlledCollapsed: f.controlledCollapsed,
    applyCollapsedState: f.applyCollapsedState,
    notifyCollapsedProposal: f.notifyCollapsedProposal,
    // Peer size is the allocator basis from the group's peer store, and
    // readiness additionally waits for the allocator to commit it.
    size,
    renderedSize,
    isReady: group.containerSize > 0 && resolvedSize !== undefined,
    setCollapsed,
    setSize: setSizeClamped,
    maximize,
    collapse,
    expand,
    toggle,
    reset,
  });

  // The group allocator owns each peer's steady-state basis. Expanded
  // proportional peers may flex only to compensate for a sibling whose
  // collapse/expand geometry is physically between its old and new basis.
  // Once that transition lands the allocated bases sum to the available
  // space, so this compensation becomes inert. Bounding it by the resolved
  // maximum and excluding explicit-zero peers preserves allocator authority
  // when space is deliberately left unallocated.
  const collapsedBasis =
    allocatedSize !== undefined
      ? `${allocatedSize}px`
      : toCssSize(collapsedSize, "0px");
  // Peer spring target: the allocator basis.
  const { thresholdMotion, noTransition } = useThresholdPresentation(
    f,
    collapseBelowBehavior,
    size,
  );
  const presentedSize = thresholdMotion.size ?? renderedSize;
  // An automatic proportional peer has no authoritative basis until its
  // parent allocator commits one. Let CSS fill the provisional gap during
  // that bootstrap frame so nested groups never measure against a transient
  // zero-width ancestor. Explicit defaults (including zero) remain fixed to
  // their declared basis until the allocator takes ownership.
  const isBootstrapAutomaticPeer =
    resolvedSize === undefined &&
    effectiveDefaultSize === undefined &&
    !collapsed &&
    containerResizeBehavior === "proportional";
  const canCompensateFromZero =
    isBootstrapAutomaticPeer || group.canPeerCompensateFromZero(token);
  const canCompensateForMotion =
    !collapsed &&
    !thresholdMotion.active &&
    containerResizeBehavior === "proportional" &&
    (canCompensateFromZero || presentedSize > SIZE_EPSILON);
  const sizeBasis =
    resolvedSize !== undefined || presentedSize > 0
      ? `${presentedSize}px`
      : effectiveDefaultSize === undefined
        ? "0px"
        : toCssSize(effectiveDefaultSize, "0px");
  const outerStyle: CSSProperties = {
    boxSizing: "border-box",
    position: "relative",
    // Weight growth by the allocator basis so several peers preserve their
    // relative allocation while they absorb a transient gap. Shrink already
    // scales by the flex basis, so a common factor preserves the same ratio.
    flexGrow: canCompensateForMotion
      ? presentedSize > SIZE_EPSILON
        ? presentedSize
        : 1
      : 0,
    flexShrink: canCompensateForMotion ? 100 : 0,
    flexBasis:
      thresholdMotion.size === null && collapsed ? collapsedBasis : sizeBasis,
    [isHorizontal ? "height" : "width"]: "100%",
    // Never-squish floor (R-34). Gated off while collapsed or in threshold
    // motion — an unconditional floor would block a collapse from ever
    // reaching its rail.
    [isHorizontal ? "minWidth" : "minHeight"]:
      collapsed || thresholdMotion.active
        ? 0
        : group.containerSize > 0 && !isBootstrapAutomaticPeer
          ? `${minPx}px`
          : toCssSize(minSize, "0px"),
    [isHorizontal ? "maxWidth" : "maxHeight"]:
      group.containerSize > 0 && !isBootstrapAutomaticPeer
        ? `${maxPx}px`
        : toCssSize(maxSize, "100%"),
    [isHorizontal ? "minHeight" : "minWidth"]: 0,
    overflow: "hidden",
    // The floor animates on the same curve as flex-basis — a static floor
    // binds at frame 0 of a manual expand and snaps the peer to minSize.
    transition:
      collapsible && !noTransition
        ? `flex-basis ${group.animation.transition}, ${
            isHorizontal ? "min-width" : "min-height"
          } ${group.animation.transition}`
        : "none",
  };

  return renderPanelShell(
    f,
    elementProps,
    className,
    style,
    outerStyle,
    {
      ...contentSlotStyle,
      position: "absolute",
      inset: 0,
      overflow: "auto",
    },
    children,
  );
}
