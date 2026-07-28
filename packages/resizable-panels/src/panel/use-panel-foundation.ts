"use client";

import {
  type CSSProperties,
  type Ref,
  version as reactVersion,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { getPanelLayoutState } from "../core/layout-state.js";
import {
  clamp,
  resolveSizeField,
  SIZE_EPSILON,
  sizesDiffer,
} from "../core/size.js";
import {
  usePanelAutoCollapsed,
  usePanelGroup,
} from "../group/group-context.js";
import { usePanelLayoutInternal } from "../provider/contexts.js";
import {
  IS_DEVELOPMENT,
  NO_WARNINGS,
  useDevWarnings,
} from "../shared/diagnostics.js";
import { composeRefs } from "../shared/refs.js";
import { useSkipAnimation } from "../shared/use-skip-animation.js";
import type {
  PanelActionOptions,
  PanelActionRejectionReason,
  PanelActionResult,
  PanelChangeDetails,
  PanelKind,
  PanelSide,
  SizeSpec,
} from "../types.js";
import type { PanelSlots } from "./panel.js";
import { panelSizeLabel, useResolvedBounds } from "./use-resolved-bounds.js";

/**
 * Logic shared verbatim between the two `<Panel>` kinds (`SidePanel` /
 * `PeerPanel` in panel.tsx). The kinds keep genuinely different size
 * models — docked size is local React state with restore/self-heal/
 * live-string-default semantics (R-05), peer size lives in group stores
 * behind the seam cascade — so anything size-model-specific stays in
 * panel.tsx and enters these helpers only through explicitly named
 * parameters or `kind`-guarded blocks. Each such divergence documents WHY
 * the kinds differ, so it cannot be mistaken for accidental drift (R-10).
 */

export const rejected = (
  reason: PanelActionRejectionReason,
): { applied: false; reason: PanelActionRejectionReason } => ({
  applied: false,
  reason,
});

// ─── reserved slotProps style keys (R-15) ────────────────────────────────────
// The library spreads its own styles AFTER `slotProps.*.style` on the
// viewport and content elements, so these keys silently override consumer
// values. The spread order is deliberate (the keys are structural); the dev
// warning below makes the override visible instead of silent. Only keys the
// library sets unconditionally are listed — conditional keys (e.g. a docked
// content's side-dependent left/right anchor) are omitted so the warning
// never fires for a key that might survive.

/** Both panel kinds: viewport is the absolutely-filling clip box. */
const VIEWPORT_RESERVED_STYLE_KEYS = ["position", "inset", "overflow"] as const;
/** Peer content fills its viewport absolutely. */
const PEER_CONTENT_RESERVED_STYLE_KEYS = [
  "position",
  "inset",
  "overflow",
] as const;
/** Docked content: anchored, sized, and transitioned per axis. `top`/
 * `height` (horizontal groups) and `left`/`width` (vertical groups) are the
 * anchor keys every docked anchor variant sets; the opposite-edge keys vary
 * with `side` and text direction and are deliberately not warned about. */
const DOCKED_CONTENT_RESERVED_STYLE_KEYS_HORIZONTAL = [
  "position",
  "overflow",
  "transition",
  "width",
  "height",
  "top",
] as const;
const DOCKED_CONTENT_RESERVED_STYLE_KEYS_VERTICAL = [
  "position",
  "overflow",
  "transition",
  "height",
  "width",
  "left",
] as const;

function reservedSlotStyleWarning(
  panelId: string | undefined,
  slot: "viewport" | "content",
  style: CSSProperties | undefined,
  reservedKeys: readonly string[],
): string | null {
  if (!style) return null;
  const offending = reservedKeys.filter(
    (key) => (style as Record<string, unknown>)[key] !== undefined,
  );
  if (offending.length === 0) return null;
  const label = panelId ? `<Panel panelId="${panelId}">` : "<Panel>";
  return `${label} slotProps.${slot}.style sets ${offending.join(", ")} — the library owns ${offending.length === 1 ? "this key" : "these keys"} on the ${slot} slot and overrides the provided value${offending.length === 1 ? "" : "s"}. Style a nested element or the panel root instead.`;
}

function useCollapseConstraintWarnings({
  panelId,
  collapsible,
  autoCollapsible,
  collapsedIsControlled,
  collapsedSize,
  resizableWhenCollapsed,
  collapseBelow,
  minSize,
  canValidate,
}: {
  panelId?: string;
  collapsible: boolean;
  autoCollapsible: boolean;
  collapsedIsControlled: boolean;
  collapsedSize: number;
  resizableWhenCollapsed: boolean;
  collapseBelow?: number;
  minSize: number;
  canValidate: boolean;
}) {
  const label = panelId ? `<Panel panelId="${panelId}">` : "<Panel>";
  const collapsedSizeValid =
    Number.isFinite(collapsedSize) && collapsedSize >= 0;
  const collapseBelowValid =
    collapseBelow === undefined ||
    (Number.isFinite(collapseBelow) && collapseBelow >= 0);

  useDevWarnings(
    IS_DEVELOPMENT
      ? [
          canValidate && !collapsedSizeValid
            ? `${label} collapsedSize must resolve to a finite, non-negative pixel value.`
            : null,
          canValidate && collapsedSizeValid && collapsedSize > minSize
            ? `${label} collapsedSize (${collapsedSize}px) cannot exceed minSize (${minSize}px).`
            : null,
          canValidate &&
          resizableWhenCollapsed &&
          collapsedSizeValid &&
          collapsedSize <= SIZE_EPSILON
            ? `${label} resizableWhenCollapsed requires a non-zero collapsedSize so the resize handle remains discoverable.`
            : null,
          canValidate && collapsible && !collapseBelowValid
            ? `${label} collapseBelow must resolve to a finite, non-negative pixel value.`
            : null,
          canValidate &&
          collapsible &&
          collapseBelow !== undefined &&
          collapseBelowValid &&
          collapsedSizeValid &&
          (collapseBelow < collapsedSize || collapseBelow > minSize)
            ? `${label} collapseBelow (${collapseBelow}px) must resolve between collapsedSize (${collapsedSize}px) and minSize (${minSize}px).`
            : null,
          // R-37 arm-refusal (C3): auto needs a non-zero rail or it would fold
          // a panel to nothing on resize; fall back to collapsible={true}.
          canValidate &&
          autoCollapsible &&
          collapsedSizeValid &&
          collapsedSize <= SIZE_EPSILON
            ? `${label} collapsible="auto" needs a non-zero collapsedSize to fold to a visible rail. Auto-collapse is disabled; the panel behaves as collapsible={true}.`
            : null,
          // R-37 controlled-inert (C2): a controlled collapsed prop wins.
          autoCollapsible && collapsedIsControlled
            ? `${label} collapsible="auto" is inert on a controlled (collapsed) panel; the collapsed prop wins. Drive width folding from usePanelGroupState instead.`
            : null,
          // R-37 forbid-pair (G1): two collapse authorities on one panel.
          autoCollapsible && collapseBelow !== undefined
            ? `${label} collapsible="auto" cannot combine with collapseBelow on the same panel. Auto-collapse is disabled; collapseBelow takes precedence.`
            : null,
        ]
      : NO_WARNINGS,
  );
}

/** React 19 models `inert` as a boolean attribute, while React 18 treats it
 * as an unknown string attribute. Select the representation React itself
 * expects so both versions serialize and hydrate the same effective HTML
 * without warnings. */
function getInertProp(inert: boolean): boolean | undefined {
  if (!inert) return undefined;
  return reactVersion.startsWith("18.") ? ("true" as unknown as boolean) : true;
}

export type PanelFoundation = ReturnType<typeof usePanelFoundation>;

/**
 * Everything the two panel kinds set up identically before their size
 * models diverge: context reads, per-instance identity (token / DOM id /
 * composed root ref), slotProps splitting, resolved bounds, resolved
 * collapse fields plus their §13 clamps and dev warnings (constraint +
 * reserved-slotProps R-15), the persisted-snapshot seed, collapsed state
 * with its committed/requested ref pair, hidden/inert derivation, the
 * skip-animation flag, and the whole `setCollapsed` action family.
 */
export function usePanelFoundation({
  kind,
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
  controlledCollapsed: controlledCollapsedProp,
  onCollapsedChange,
  collapsedSize,
  collapseBelow,
  collapseBelowHysteresis,
  resizableWhenCollapsed,
  consumerInert,
}: {
  kind: PanelKind;
  /** Docked-only; peers render no `data-side` attribute. */
  side?: PanelSide;
  panelId: string | undefined;
  id: string | undefined;
  elementRef: Ref<HTMLDivElement> | undefined;
  slotProps: PanelSlots | undefined;
  minSize: SizeSpec;
  maxSize: SizeSpec;
  defaultSize: SizeSpec | undefined;
  collapsible: boolean;
  /** Resolved `collapsible="auto"` (R-37); `collapsible` is already true. */
  autoCollapsible: boolean;
  defaultCollapsed: boolean;
  /** The controlled `collapsed` prop (R-33); undefined = uncontrolled. */
  controlledCollapsed: boolean | undefined;
  /** The panel's `onCollapsedChange`. Uncontrolled panels report committed
   * transitions through `usePanelCallbacks`; a controlled panel routes
   * every emission through the foundation's proposal channel instead. */
  onCollapsedChange:
    | ((collapsed: boolean, details: PanelChangeDetails) => void)
    | undefined;
  collapsedSize: SizeSpec;
  collapseBelow: SizeSpec | undefined;
  collapseBelowHysteresis: SizeSpec;
  resizableWhenCollapsed: boolean;
  consumerInert: boolean;
}) {
  const layout = usePanelLayoutInternal();
  const group = usePanelGroup();
  const { viewport: viewportSlotProps = {}, content: contentSlotProps = {} } =
    slotProps ?? {};
  const {
    className: viewportClassName,
    style: viewportStyle,
    ...viewportProps
  } = viewportSlotProps;
  const {
    className: contentClassName,
    style: contentSlotStyle,
    ...contentProps
  } = contentSlotProps;
  const tokenRef = useRef<object>({});
  const token = tokenRef.current;
  const reactId = useId();
  const domId =
    id ?? `resizable-panels-panel-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const orderElementRef = useRef<HTMLDivElement>(null);
  const getOrderElement = useCallback(() => orderElementRef.current, []);
  const setRootRef = useMemo(
    () => composeRefs<HTMLDivElement>(orderElementRef, elementRef),
    [elementRef],
  );
  const isHorizontal = group.orientation === "horizontal";

  const { contentRef, minPx, maxPx, defaultPx, ctx } = useResolvedBounds({
    minSize,
    maxSize,
    defaultSize,
    containerSize: group.containerSize,
    panelId,
    kind,
  });
  const sizeLabel = panelSizeLabel(panelId);
  // Invalid collapse-related specs fall back to their defaults (§13):
  // collapsedSize to 0, collapseBelow to absent (no threshold collapse),
  // hysteresis to its declared default.
  const resolvedCollapsedSize = resolveSizeField(collapsedSize, ctx, {
    label: sizeLabel,
    property: "collapsedSize",
    fallback: 0,
  });
  const resolvedCollapseBelow =
    collapseBelow === undefined
      ? undefined
      : resolveSizeField(collapseBelow, ctx, {
          label: sizeLabel,
          property: "collapseBelow",
          fallback: undefined,
        });
  const resolvedCollapseBelowHysteresis = resolveSizeField(
    collapseBelowHysteresis,
    ctx,
    { label: sizeLabel, property: "collapseBelowHysteresis", fallback: 12 },
  );
  useCollapseConstraintWarnings({
    panelId,
    collapsible,
    autoCollapsible,
    collapsedIsControlled: collapsible && controlledCollapsedProp !== undefined,
    collapsedSize: resolvedCollapsedSize,
    resizableWhenCollapsed,
    collapseBelow: resolvedCollapseBelow,
    minSize: minPx,
    canValidate: group.containerSize > 0,
  });
  useDevWarnings(
    IS_DEVELOPMENT
      ? [
          reservedSlotStyleWarning(
            panelId,
            "viewport",
            viewportStyle,
            VIEWPORT_RESERVED_STYLE_KEYS,
          ),
          reservedSlotStyleWarning(
            panelId,
            "content",
            contentSlotStyle,
            kind === "docked"
              ? isHorizontal
                ? DOCKED_CONTENT_RESERVED_STYLE_KEYS_HORIZONTAL
                : DOCKED_CONTENT_RESERVED_STYLE_KEYS_VERTICAL
              : PEER_CONTENT_RESERVED_STYLE_KEYS,
          ),
        ]
      : NO_WARNINGS,
  );
  const collapsedSizePx = clamp(resolvedCollapsedSize, 0, minPx);
  const collapseBelowPx =
    resolvedCollapseBelow === undefined
      ? undefined
      : clamp(resolvedCollapseBelow, collapsedSizePx, minPx);
  const collapseBelowHysteresisPx = clamp(
    resolvedCollapseBelowHysteresis,
    0,
    maxPx,
  );

  // Controlled collapsed (R-33): the prop is authoritative only for a
  // collapsible panel — a non-collapsible panel can never collapse, so the
  // prop is inert there (diagnosed below) and the panel stays uncontrolled.
  const collapsedIsControlled =
    collapsible && controlledCollapsedProp !== undefined;
  const controlledCollapsed = collapsedIsControlled
    ? controlledCollapsedProp
    : undefined;
  const controlledCollapsedRef = useRef(controlledCollapsed);
  controlledCollapsedRef.current = controlledCollapsed;
  useDevWarnings(
    IS_DEVELOPMENT
      ? [
          controlledCollapsedProp !== undefined && !collapsible
            ? `${panelId ? `<Panel panelId="${panelId}">` : "<Panel>"} collapsed requires collapsible. The controlled collapsed prop is ignored on a non-collapsible panel.`
            : null,
          collapsedIsControlled && group.hasControlledValue
            ? `${panelId ? `<Panel panelId="${panelId}">` : "<Panel>"} has a controlled collapsed prop inside a <PanelGroup> with a controlled value. The panel prop wins for this panel's collapsed bit; remove one of the two to avoid conflicting sources of truth.`
            : null,
        ]
      : NO_WARNINGS,
  );

  // Seed from the group's persisted snapshot if this panel has an id and
  // the group has persisted data for it. Restore is instant — no animation
  // because there's no value to transition from. A controlled collapsed
  // prop beats the snapshot: restores SKIP the collapsed field for a
  // controlled panel (size still restores — R-33).
  const restored =
    panelId && group.snapshot
      ? getPanelLayoutState(group.snapshot, panelId)
      : undefined;
  const [collapsed, setCollapsedState] = useState(
    collapsible &&
      (controlledCollapsed ?? restored?.collapsed ?? defaultCollapsed),
  );
  // Controlled prop sync: a prop change is the parent accepting a proposal
  // (or steering directly), so the local presentation state re-derives from
  // it during render — the sanctioned derived-state pattern, mirroring the
  // group's controlled commit. This is deliberately NOT an emission: the
  // acceptance re-render is not a change event (no double-fire — R-33), and
  // `usePanelCallbacks` suppresses the committed observer in controlled mode.
  // The previous prop is tracked in STATE, not a ref: under React 18 Strict
  // Mode's double-invoked render, a ref written in the first invocation
  // consumes the prop change while that invocation's render-phase update is
  // discarded — the replay then skips the sync and the accepted value never
  // lands. State-tracked comparison re-derives correctly in every replay.
  const [prevControlledCollapsed, setPrevControlledCollapsed] =
    useState(controlledCollapsed);
  if (prevControlledCollapsed !== controlledCollapsed) {
    setPrevControlledCollapsed(controlledCollapsed);
    if (collapsedIsControlled && collapsed !== controlledCollapsed) {
      setCollapsedState(controlledCollapsed === true);
    }
  }
  // `requested` leads the committed React state so several actions inside
  // one event see each other's outcome; whenever a new committed value
  // lands, both refs re-align to it.
  const committedCollapsedRef = useRef(collapsed);
  const requestedCollapsedRef = useRef(collapsed);
  if (committedCollapsedRef.current !== collapsed) {
    committedCollapsedRef.current = collapsed;
    requestedCollapsedRef.current = collapsed;
  }
  // R-37 responsive auto-collapse. The group publishes this token's fold bit;
  // it never enters the panel's stored `collapsed` state (which stays the
  // user/controlled truth the group reads for geometry and the fold math).
  // Presentation ORs it in at the stored arm: every readout, data-state, and
  // event reports `controlledCollapsed ?? (collapsed || autoCollapsed)`.
  const publishedAutoCollapsed = usePanelAutoCollapsed(token);
  const autoCollapsed =
    autoCollapsible && !collapsedIsControlled && publishedAutoCollapsed;
  // Local presentation truth (data-state, geometry, events): the stored/live
  // collapsed bit OR the width-driven fold. Controlled panels keep R-33's live
  // gesture presentation (auto is inert there). The public EFFECTIVE readout
  // additionally layers the controlled prop (see useRegisterPanel).
  const presentationCollapsed = collapsed || autoCollapsed;
  const autoCollapsedRef = useRef(autoCollapsed);
  autoCollapsedRef.current = autoCollapsed;
  // A collapsed panel with a zero rail is presented as fully hidden:
  // removed from the a11y tree and made inert. Consumer inert is honored
  // either way.
  const collapsedIsHidden =
    presentationCollapsed && collapsedSizePx <= SIZE_EPSILON;
  const inert = getInertProp(collapsedIsHidden || consumerInert);
  const [skipAnim, setSkipAnim] = useSkipAnimation();

  const layoutSetSkipAnim = layout.setSkipAnim;
  // Read live panel controls + group children at call time, not from the
  // closure: setCollapsed's callback identity matters (it lands in
  // PanelControls and feeds shallow equality), so we don't want to
  // invalidate it on every render. The registry store gives call-time reads
  // for free — no subscription, no stale-closure risk when panels mount or
  // sizes change between renders.
  const groupPanelControls = group.panelControls;
  const listGroupChildren = group.listChildren;
  // Docked-only divergence: before an instant (`transition: "none"`) close
  // commits, pin surviving sibling dockeds (same group) to the size they're
  // currently rendered at. Without this, removing this panel from
  // `reservedDocked` can relieve an over-constraint, snapping siblings from
  // their constrained effective size back to their preferred — a visible
  // jump that has nothing to do with the close the user asked for. By
  // writing preferred ← rendered first, the post-close auto-distribute pass
  // has no constraint to relieve and survivors hold their position; the
  // freed space flows entirely to peers. (Expanding needs no pinning: it
  // adds constraint pressure, which the over-constraint shrink path
  // resolves without touching siblings' preferred sizes. Peers need no
  // pinning at all: peer space is allocator-owned and redistributes through
  // the seam cascade without touching sibling preferences.)
  const pinSiblingsForInstantClose = useCallback(() => {
    for (const child of listGroupChildren()) {
      if (child.kind !== "docked") continue;
      if (child.token === token) continue;
      const ctrl = groupPanelControls.get(child.token);
      if (!ctrl || ctrl.collapsed) continue;
      if (sizesDiffer(ctrl.renderedSize, ctrl.size)) {
        ctrl.setSize(ctrl.renderedSize);
      }
    }
  }, [groupPanelControls, listGroupChildren, token]);
  const applyCollapsedState = useCallback(
    (
      next: boolean,
      options?: PanelActionOptions,
    ): PanelActionResult<boolean> => {
      if (next && !collapsible) return rejected("not-collapsible");
      // R-37 override: a manual expand of an auto-folded panel arms the group's
      // per-panel latch so the fold releases. The stored bit is already
      // expanded, so this would otherwise be a silent no-op.
      if (!next && autoCollapsedRef.current) {
        group.armAutoOverride(token, group.getChangeAttribution());
        if (next === requestedCollapsedRef.current) {
          return { applied: true, value: next };
        }
      }
      if (next === requestedCollapsedRef.current) {
        return { applied: false, reason: "unchanged", value: next };
      }
      // Suppression applies only to an accepted change (§10).
      if (options?.transition === "none") {
        if (next && kind === "docked") pinSiblingsForInstantClose();
        setSkipAnim(true);
        // Broadcast so peers and surviving dockeds suppress transitions for
        // the same paint.
        layoutSetSkipAnim(true);
      }
      requestedCollapsedRef.current = next;
      setCollapsedState(next);
      return { applied: true, value: next };
    },
    [
      collapsible,
      kind,
      layoutSetSkipAnim,
      pinSiblingsForInstantClose,
      group,
      token,
    ],
  );
  // Controlled proposal channel (R-33). Details derive from the group's
  // live attribution: explicit operations keep their operation reason
  // (set-value, reset, collapse/expand from the imperative wrappers), while
  // resize-attributed emissions — a live threshold crossing, or maximize's
  // expand half marked as "resize" — report the direction with the
  // attribution's trigger, matching what the change MEANS for the collapsed
  // bit rather than for sizes.
  const onCollapsedChangeRef = useRef(onCollapsedChange);
  onCollapsedChangeRef.current = onCollapsedChange;
  const getChangeAttribution = group.getChangeAttribution;
  const notifyCollapsedProposal = useCallback(
    (next: boolean) => {
      if (controlledCollapsedRef.current === undefined) return;
      const attribution = getChangeAttribution();
      onCollapsedChangeRef.current?.(
        next,
        attribution.reason === "resize"
          ? {
              reason: next ? "collapse" : "expand",
              trigger: attribution.trigger,
            }
          : { reason: attribution.reason, trigger: attribution.trigger },
      );
    },
    [getChangeAttribution],
  );
  // Controlled `setCollapsed`: the prop stays authoritative — every accepted
  // shape EMITS a proposal and applies nothing; `applied: true` means
  // "proposed" (the PanelActionResult contract). Proposing the current prop
  // value is `unchanged` and emits nothing, mirroring the group's unchanged
  // applies. The parent accepts by re-rendering with the new prop value.
  const proposeCollapsed = useCallback(
    (
      next: boolean,
      options?: PanelActionOptions,
    ): PanelActionResult<boolean> => {
      if (next && !collapsible) return rejected("not-collapsible");
      // `transition` hints describe an application this call does not
      // perform; the acceptance re-render animates per the group's
      // animation settings.
      void options;
      if (next === controlledCollapsedRef.current) {
        return { applied: false, reason: "unchanged", value: next };
      }
      notifyCollapsedProposal(next);
      return { applied: true, value: next };
    },
    [collapsible, notifyCollapsedProposal],
  );
  const setCollapsed = collapsedIsControlled
    ? proposeCollapsed
    : applyCollapsedState;
  const collapse = useCallback(
    (options?: PanelActionOptions): PanelActionResult<true> => {
      const result = setCollapsed(true, options);
      if (result.applied) return { applied: true, value: true };
      if (result.reason === "unchanged") {
        return { applied: false, reason: "unchanged", value: true };
      }
      return result;
    },
    [setCollapsed],
  );
  const expand = useCallback(
    (options?: PanelActionOptions): PanelActionResult<false> => {
      const result = setCollapsed(false, options);
      if (result.applied) return { applied: true, value: false };
      if (result.reason === "unchanged") {
        return { applied: false, reason: "unchanged", value: false };
      }
      return result;
    },
    [setCollapsed],
  );
  const toggle = useCallback(
    (options?: PanelActionOptions): PanelActionResult<boolean> =>
      collapsible
        ? // Controlled panels toggle the inverse of the EFFECTIVE (prop)
          // state — the proposal target must chain from the authoritative
          // value, not from a transient gesture presentation. Uncontrolled
          // panels keep the requested ref (undefined prop falls through).
          setCollapsed(
            // Uncontrolled: toggle the inverse of what is SHOWN (stored bit OR
            // auto-fold), so a visually auto-folded panel expands (R-37).
            !(
              controlledCollapsedRef.current ??
              (requestedCollapsedRef.current || autoCollapsedRef.current)
            ),
            options,
          )
        : rejected("not-collapsible"),
    [collapsible, setCollapsed],
  );

  return {
    kind,
    side,
    panelId,
    layout,
    group,
    token,
    domId,
    getOrderElement,
    setRootRef,
    isHorizontal,
    viewportClassName,
    viewportStyle,
    viewportProps,
    contentClassName,
    contentSlotStyle,
    contentProps,
    contentRef,
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
    collapsedIsControlled,
    controlledCollapsed,
    applyCollapsedState,
    notifyCollapsedProposal,
    requestedCollapsedRef,
    collapsedIsHidden,
    inert,
    skipAnim,
    setSkipAnim,
    setCollapsed,
    collapse,
    expand,
    toggle,
  };
}
