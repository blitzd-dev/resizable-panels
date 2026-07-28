"use client";

import {
  type CSSProperties,
  type Ref,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  clamp,
  resolveSizeField,
  SIZE_EPSILON,
  sizesDiffer,
} from "../core/size.js";
import { usePanelRenderedSize } from "../group/group-context.js";
import type {
  PanelActionOptions,
  PanelActionResult,
  PanelSizeActionDetails,
  SizeSpec,
} from "../types.js";
import type { DockedPanelProps } from "./panel.js";
import { renderPanelShell, toCssSize } from "./panel-shell.js";
import { rejected, usePanelFoundation } from "./use-panel-foundation.js";
import {
  useCompoundSizeActions,
  usePanelCallbacks,
  usePanelWiring,
} from "./use-panel-wiring.js";
import { useThresholdPresentation } from "./use-threshold-motion.js";

// ─── side panel (docked) ─────────────────────────────────────────────────────

type SidePanelInternalProps = DockedPanelProps & {
  elementRef?: Ref<HTMLDivElement>;
};

export function SidePanel({
  panelId,
  id,
  apiRef,
  slotProps,
  side,
  defaultSize,
  minSize = 200,
  maxSize = "100%",
  containerResizeBehavior = "fixed",
  disabled = false,
  collapsible: collapsibleProp = true,
  collapsed: controlledCollapsed,
  defaultCollapsed = false,
  collapsedSize = 0,
  resizableWhenCollapsed = false,
  pinned = false,
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
}: SidePanelInternalProps) {
  // Resolve the R-37 auto mode: `"auto"` implies collapsible; the rest of the
  // machinery works with the plain boolean, and the config carries the mode.
  const autoCollapsible = collapsibleProp === "auto";
  const collapsible = collapsibleProp === "auto" ? true : collapsibleProp;
  const f = usePanelFoundation({
    kind: "docked",
    side,
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

  const effectiveDefaultSize = defaultSize;
  // `effectiveDefaultSize` is non-undefined and the docked fallback for an
  // invalid spec is numeric, so the foundation always resolves a number
  // here; coalesce only to satisfy TS.
  const defaultPx = f.defaultPx ?? 0;

  // For first render the container hasn't been measured yet. Pure-px specs
  // resolve correctly with containerSize=0; container-relative specs ("50%",
  // "calc(50% - 100px)") stay UNINITIALIZED: like CSS, a string default
  // keeps tracking its container (R-05, live until interaction) until an
  // explicit path — a drag, setSize/maximize/reset, a layout application,
  // or a persistence restore — commits a pixel preference through
  // `setSizeClamped` (or the restored-snapshot seed above).
  const [size, setSize] = useState<number>(() => {
    if (restored?.size !== undefined) return restored.size;
    if (typeof effectiveDefaultSize === "number") return Math.max(0, defaultPx);
    return 0;
  });
  const sizeInitialized = useRef(
    restored?.size !== undefined || typeof effectiveDefaultSize === "number",
  );
  // While uninitialized, the preference IS the live-resolved default:
  // `defaultPx` re-resolves against the current container on every render,
  // so the group/allocator always sees the current preference and never
  // mistakes the temporary state seed (0) for an explicit docked-panel
  // size. `size` state takes over permanently once pixels are committed.
  // Clamped into [minPx, maxPx] so reported preferences stay in-bounds
  // before any pixels commit (R-34).
  const preferredSize =
    !sizeInitialized.current && group.containerSize > 0
      ? clamp(defaultPx, minPx, maxPx)
      : size;
  const committedSizeRef = useRef(preferredSize);
  const requestedSizeRef = useRef(preferredSize);
  if (committedSizeRef.current !== preferredSize) {
    committedSizeRef.current = preferredSize;
    requestedSizeRef.current = preferredSize;
  }

  // Register as a child of the parent group so persistence write-back
  // and seam adjacency know which panels belong to it. We deliberately
  // depend only on the stable `registerChild` reference, not the whole
  // group context — the context value churns whenever any peer size
  // changes, and we don't want to re-mount the docked entry on every
  // peer drag tick.
  const registerChild = group.registerChild;
  const getOrderElement = f.getOrderElement;
  const domId = f.domId;
  useLayoutEffect(() => {
    return registerChild({
      kind: "docked",
      token,
      panelId,
      domId,
      getElement: getOrderElement,
    });
  }, [domId, getOrderElement, panelId, registerChild, token]);

  // Self-heal: if existing state ever falls outside [minPx, maxPx] —
  // because of a stale persisted snapshot, a container resize that pulled
  // the resolved bounds, or HMR carrying old state across a bounds change —
  // snap back into range on the next render.
  useEffect(() => {
    if (!sizeInitialized.current) return;
    // Bail before the container is measured: minPx/maxPx that depend on
    // container-relative units (e.g. maxSize default "100%") resolve to 0
    // against containerSize=0, which would clamp a perfectly valid `size`
    // down to 0 on first commit — and the `size < 1` guard below would
    // then trap it there forever.
    if (group.containerSize === 0) return;
    // Guard against the commit race: `setSizeClamped` mutates
    // `sizeInitialized.current = true` synchronously and queues a
    // setSize(N). When it is called from another effect in the same commit
    // phase (layout application, restore), this self-heal effect's closure
    // still holds the pre-commit string-default seed `size = 0` and may run
    // *before* the committed render lands. Without this guard, it would
    // observe size=0 < minPx and queue setSize(minPx) AFTER the legitimate
    // value, defeating the commit.
    if (size < 1 && typeof effectiveDefaultSize !== "number") return;
    if (size < minPx) setSize(minPx);
    else if (size > maxPx) setSize(maxPx);
  }, [size, minPx, maxPx, group.containerSize, effectiveDefaultSize]);

  // Read the effective rendered size from the group. When the layout is
  // over-constrained (sum of expanded dockeds' preferred + peer floors >
  // container), this panel has been shrunk to fit; otherwise it equals our
  // preferred `size`. Subscriptions use the private panel token, so panels
  // without public ids participate and only the affected panel re-renders.
  const allocatedSize = usePanelRenderedSize(token);
  const effectiveSize = allocatedSize ?? preferredSize;
  const renderedSize =
    allocatedSize ?? (presentationCollapsed ? collapsedSizePx : effectiveSize);

  // Track the last expanded effective size. While collapsed (including a
  // width-driven auto-fold) it freezes so the content and clip animate from
  // one coherent size source.
  const [expandedEffective, setExpandedEffective] = useState<number>(
    () => effectiveSize,
  );
  useLayoutEffect(() => {
    if (
      !presentationCollapsed &&
      effectiveSize > 0 &&
      expandedEffective !== effectiveSize
    ) {
      setExpandedEffective(effectiveSize);
    }
  }, [presentationCollapsed, effectiveSize, expandedEffective]);

  const layoutSetSkipAnim = layout.setSkipAnim;
  // One-shot skip for the first raw→allocated paint (R-34 review round):
  // a floored/maxed default must snap to its bound, not animate below it.
  // Gated on an actual jump — well-fitted defaults must not skip, or nested
  // first-paint cascades shift a frame early.
  const firstAllocationSkippedRef = useRef(false);
  useLayoutEffect(() => {
    if (firstAllocationSkippedRef.current) return;
    if (sizeInitialized.current || allocatedSize === undefined) return;
    firstAllocationSkippedRef.current = true;
    if (Math.abs(allocatedSize - defaultPx) > SIZE_EPSILON) {
      setSkipAnim(true);
      layoutSetSkipAnim(true);
    }
  }, [allocatedSize, defaultPx, layoutSetSkipAnim, setSkipAnim]);
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
      // Bounds OR group allocation (types.ts): in an over-constrained group
      // the docked paint floors at minSize, so a request above the floor
      // cannot fully render.
      const constrained =
        sizesDiffer(resolved, clamped) ||
        (group.isOverconstrained() && clamped > minPx + SIZE_EPSILON);
      if (!sizesDiffer(clamped, requestedSizeRef.current)) {
        return {
          applied: false,
          reason: "unchanged",
          value: requestedSizeRef.current,
          constrained,
        };
      }
      if (options?.transition === "none") {
        setSkipAnim(true);
        layoutSetSkipAnim(true);
      }
      // An explicit value ends a string default's live-tracking lifetime
      // (R-05): from here on the committed pixel preference is authoritative
      // and the default no longer re-resolves against the container.
      sizeInitialized.current = true;
      requestedSizeRef.current = clamped;
      setSize(clamped);
      if (requestedCollapsedRef.current) {
        setExpandedEffective(clamped);
      }
      return { applied: true, value: clamped, constrained };
    },
    [
      ctx,
      group,
      minPx,
      maxPx,
      sizeLabel,
      layoutSetSkipAnim,
      requestedCollapsedRef,
      setSkipAnim,
    ],
  );
  // Docked maximize/reset size halves: docked size is component state, so
  // the rejection fallback reads this component's requested-size ref, and
  // reset re-resolves the declarative default against the current context —
  // never the pixels it produced at first load, never a restored value.
  const readRequestedSize = useCallback(() => requestedSizeRef.current, []);
  const resetSize = useCallback(
    (options?: PanelActionOptions) => {
      const sizeResult = setSizeClamped(defaultPx, options);
      return {
        size:
          sizeResult.applied || sizeResult.reason === "unchanged"
            ? sizeResult.value
            : requestedSizeRef.current,
        changed: sizeResult.applied,
      };
    },
    [defaultPx, setSizeClamped],
  );
  const { maximize, reset } = useCompoundSizeActions(
    maxPx,
    setSizeClamped,
    setCollapsed,
    collapsible,
    defaultCollapsed,
    requestedCollapsedRef,
    readRequestedSize,
    resetSize,
  );

  usePanelCallbacks({
    // Fire on the EFFECTIVE state so a width-driven auto-fold emits an edge
    // (R-37); attribution carries the group's system trigger for that pass.
    collapsed: presentationCollapsed,
    collapsedIsControlled: f.collapsedIsControlled,
    panelId,
    onSizeChange,
    onCollapsedChange,
    getChangeAttribution: group.getChangeAttribution,
    size: preferredSize,
  });
  // PanelApi getters — docked reads the registered controls and falls back
  // to its local state (see usePanelWiring for the peer contrast). The
  // rendered-size fallback is the local collapsed-aware `renderedSize`,
  // aligned with the peer's (R-21): a registry miss on a collapsed panel
  // must not report the expanded preferred size.
  const readPanelSize = useCallback(
    () => group.panelControls.get(token)?.size ?? preferredSize,
    [group.panelControls, preferredSize, token],
  );
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
    kind: "docked",
    side,
    orientation: group.orientation,
    defaultSize: defaultPx,
    minSize: minPx,
    maxSize: maxPx,
    containerResizeBehavior,
    collapsible,
    autoCollapsible,
    defaultCollapsed,
    collapsedSize: collapsedSizePx,
    resizableWhenCollapsed,
    disabled,
    pinned,
    collapseBelow: collapseBelowPx,
    collapseBelowHysteresis: collapseBelowHysteresisPx,
    collapseBelowBehavior,
    collapsed,
    autoCollapsed,
    controlledCollapsed: f.controlledCollapsed,
    applyCollapsedState: f.applyCollapsedState,
    notifyCollapsedProposal: f.notifyCollapsedProposal,
    // Docked size is local component state: the committed preferred px, or
    // the live-resolved string default while uninitialized (R-05).
    size: preferredSize,
    renderedSize,
    isReady: group.containerSize > 0,
    setCollapsed,
    setSize: setSizeClamped,
    maximize,
    collapse,
    expand,
    toggle,
    reset,
  });

  // ─── render ───────────────────────────────────────────────────────────────

  // Docked spring target: the effective (allocator-clamped preferred) size.
  const { thresholdMotion, noTransition } = useThresholdPresentation(
    f,
    collapseBelowBehavior,
    effectiveSize,
  );
  const sizeAxis = isHorizontal ? "width" : "height";
  // A docked panel's defaultSize is required; when the spec is invalid the
  // bootstrap basis degrades to the min bound, matching the resolved-pixel
  // fallback in useResolvedBounds.
  const unresolvedDefaultSize = toCssSize(
    effectiveDefaultSize,
    toCssSize(minSize, "0px"),
  );
  const renderedEffectiveSize = thresholdMotion.size ?? effectiveSize;
  // One sizing authority (R-34): once measured, the allocator owns the paint;
  // the raw live default renders only pre-measurement (SSR/first frame, R-05).
  const outerSize =
    sizeInitialized.current || allocatedSize !== undefined
      ? `${renderedEffectiveSize}px`
      : unresolvedDefaultSize;
  const renderedContentSize =
    thresholdMotion.size !== null && collapsedSizePx > SIZE_EPSILON
      ? thresholdMotion.size
      : collapsed
        ? collapsedSizePx > SIZE_EPSILON
          ? renderedSize
          : expandedEffective
        : renderedEffectiveSize;
  // The expanded outer already resolves a string default against the group.
  // Its nested absolute content must fill that result: repeating e.g. `33%`
  // here would resolve against the already-33%-wide panel and paint at 10.9%.
  //
  // The same containing-block mismatch is why the raw string may NEVER
  // appear on the content while collapsed or animating (R-32): during a
  // collapse the panel box shrinks, so a re-emitted "30%" would shrink the
  // content with it instead of freezing it at the expanded width the clip
  // reveals. While uninitialized (R-05 live-tracking, no committed pixels)
  // the frozen reference is `expandedEffective`; a panel that mounted
  // `defaultCollapsed` and has never been expanded has nothing to freeze,
  // so its would-be expanded width is the live-resolved default — clamped,
  // as the allocator would clamp it, and current on every render. While
  // expanded, `max(100%, <reference>px)` preserves the CSS-live fill
  // between commits (100% wins whenever the outer is at or beyond the
  // reference) yet holds the full expanded width through the outer's expand
  // transition, where a bare 100% would squish the content to the animating
  // clip. A compact rail mirrors the initialized branch: content shares the
  // outer's collapsed geometry via the allocator's pixels.
  const uninitializedExpandedReference =
    expandedEffective > SIZE_EPSILON
      ? expandedEffective
      : clamp(defaultPx, minPx, maxPx);
  const contentSize = sizeInitialized.current
    ? `${renderedContentSize}px`
    : collapsed
      ? collapsedSizePx > SIZE_EPSILON
        ? `${renderedSize}px`
        : `${uninitializedExpandedReference}px`
      : `max(100%, ${uninitializedExpandedReference}px)`;
  const collapsedOuterSize =
    allocatedSize !== undefined
      ? `${allocatedSize}px`
      : toCssSize(collapsedSize, "0px");

  const outerStyle: CSSProperties = {
    boxSizing: "border-box",
    position: "relative",
    // Over-constraint shrink is handled in JS via allocator-owned rendered
    // sizes; the peer's flex-shrink absorbs only transient sub-pixel overflow.
    flexShrink: 0,
    // The animated clip can carry consumer borders. Clip it to the structural
    // panel so a border cannot paint outside a zero-sized collapsed panel.
    // Because the outer size itself animates, the moving border remains
    // visible for the duration of the transition and disappears only at zero.
    overflow: "hidden",
    [isHorizontal ? "height" : "width"]: "100%",
    // Use JS-computed effective rather than preferred `size`. When over-
    // constrained, this shrinks the outer to fit. Otherwise it equals size.
    [sizeAxis]:
      thresholdMotion.size === null
        ? collapsed
          ? collapsedOuterSize
          : outerSize
        : outerSize,
    transition: noTransition
      ? "none"
      : `${sizeAxis} ${group.animation.transition}`,
  };
  // A zero-size collapse behaves like off-canvas content: keep the inner
  // attached to the moving resize seam so it slides away with that edge.
  const offscreenInnerAnchor: CSSProperties = isHorizontal
    ? { top: 0, [side === "start" ? "right" : "left"]: 0, height: "100%" }
    : { left: 0, [side === "start" ? "bottom" : "top"]: 0, width: "100%" };
  // A non-zero collapsed size is a persistent compact rail. Anchor its
  // expanded content to the *docked* edge instead, so icons stay physically
  // fixed while the resize seam animates toward them. This avoids the rail
  // jumping from the dock edge to the seam at collapse start.
  const textDirection = isHorizontal ? group.getTextDirection() : "ltr";
  const compactHorizontalEdge =
    side === "start"
      ? textDirection === "rtl"
        ? "right"
        : "left"
      : textDirection === "rtl"
        ? "left"
        : "right";
  const compactInnerAnchor: CSSProperties = isHorizontal
    ? { top: 0, [compactHorizontalEdge]: 0, height: "100%" }
    : { left: 0, [side === "start" ? "top" : "bottom"]: 0, width: "100%" };
  const innerAnchor =
    collapsedSizePx > SIZE_EPSILON ? compactInnerAnchor : offscreenInnerAnchor;
  const innerStyle: CSSProperties = {
    ...contentSlotStyle,
    position: "absolute",
    overflow: "auto",
    // Width transitions so over-constraint shifts and compact-rail state
    // changes animate in lockstep with outer.width. Zero-sized off-canvas
    // panels keep their expanded content width and slide it behind the clip;
    // non-zero rails share the outer's collapsed→expanded geometry.
    [sizeAxis]: contentSize,
    transition: noTransition
      ? "none"
      : `${sizeAxis} ${group.animation.transition}`,
    ...innerAnchor,
  };

  return renderPanelShell(
    f,
    elementProps,
    className,
    style,
    outerStyle,
    innerStyle,
    children,
  );
}
