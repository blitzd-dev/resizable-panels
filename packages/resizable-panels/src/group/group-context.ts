"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";
import type { BoundaryPanel } from "../core/boundary-resize.js";
import type { ChangeAttribution } from "../core/change-ledger.js";
import type { KeyedStore } from "../core/keyed-store.js";
import type { ResolvedPanelAnimation } from "../core/timing.js";
import type {
  InternalPanelControls,
  PanelChangeDetails,
  PanelCursorBehavior,
  PanelGroupLayout,
  PanelGroupOrientation,
  PanelLayoutMap,
  PanelValueChangeTrigger,
  SizeSpec,
} from "../types.js";

/** Spec a peer registers with its parent group. Resolved px values are
 *  recomputed each render against the live container; the spec strings are
 *  cached so the group can re-resolve on container resize without each
 *  peer needing to re-register. */
export type PeerSlot = {
  defaultSize: SizeSpec | undefined;
  /** True for a prop- or snapshot-provided default, including numeric zero. */
  defaultIsExplicit: boolean;
  /** Resolved px values, current as of the most recent render. */
  boundsReady: boolean;
  minPx: number;
  maxPx: number;
  defaultPx: number | undefined;
};

/** One-shot presentation command emitted when a drag crosses a collapseBelow
 * boundary. The semantic collapsed state changes immediately; this command
 * lets the panel carry its current visual geometry smoothly to the new state.
 * Object identity is the command id. */
export type PanelThresholdMotion = {
  collapsed: boolean;
  fromSize: number;
  targetSize: number;
};

export type PanelGroupContextType = {
  /** Stable private token identifying this mounted group in the provider
   * registry. Panels register under it keyed by `panelId`; the group
   * publishes it under a public `groupId` only when one is declared. */
  registryToken: object;
  orientation: PanelGroupOrientation;
  disabled: boolean;
  /** Whether this group renders with a controlled `value` prop. Read by
   * panels to diagnose the R-33 misconfiguration of combining a controlled
   * group value with a per-panel controlled `collapsed` prop (the panel
   * prop wins for that panel's collapsed bit). */
  hasControlledValue: boolean;
  cursorBehavior: PanelCursorBehavior;
  /** The group's resolved `animation` prop (R-16). Panels read their
   * transition shorthand and the threshold spring's duration from here; a
   * nested group carries its own resolved value (no inheritance). */
  animation: ResolvedPanelAnimation;
  /** Read the group's live CSS direction. This respects an explicit `dir`
   * prop as well as direction inherited from an ancestor. */
  getTextDirection: () => "ltr" | "rtl";
  /** Initial controlled, default, or synchronously persisted panel state.
   * Panels use this to seed state without an animation flash. */
  snapshot: PanelLayoutMap | null;
  /** Panels call this on mount so the group knows which children belong to
   *  it and in what document order. Replaces the older id-only registry —
   *  peers without ids still need to participate in adjacency / seam
   *  rendering, so the group tracks an opaque token for them. */
  registerChild: (entry: ChildEntry) => () => void;
  /** Insertion-ordered snapshot of registered children. Drag clamping and
   *  seam adjacency both read from this. */
  listChildren: () => ChildEntry[];
  /** Peers register their resolved bounds (and optional id/defaultSize) so
   *  the group can hold their sizes centrally and apply seam drags
   *  transactionally. Pass a stable token per `<Panel>` instance. */
  registerPeer: (token: object, slot: PeerSlot) => () => void;
  /** Set a peer's px size through the boundary cascade. Multiple peers
   *  transfer space within their proportional pool; a lone peer transfers
   *  against an adjacent docked boundary so total allocated group space stays
   *  invariant. The caller clamps its own [min, max], and the cascade further
   *  clamps the request to available sibling capacity. */
  setPeerSize: (token: object, nextPx: number) => number | null;
  /** Set a peer's preferred size without cascading. Used while collapsed so
   * imperative resize changes the size that expansion will restore. */
  setPeerPreferredSize: (token: object, nextPx: number) => void;
  /** Whether a zero-width automatic peer may temporarily flex to absorb space
   * released by an animating docked sibling. Explicit and restored zeros stay
   * fixed so application-authored empty space remains authoritative. */
  canPeerCompensateFromZero: (token: object) => boolean;
  registerHandle: (
    token: object,
    getElement: () => HTMLElement | null,
    handleId?: string,
    /** Resolved `gutterSize` in px (0 for overlay handles). The group
     * reserves this space before distributing the container to panels so
     * panels + gutters always sum to the container (R-14). */
    gutterSize?: number,
  ) => () => void;
  beginResize: (
    handleToken: object,
    trigger: Extract<PanelValueChangeTrigger, "pointer" | "keyboard">,
    owner: object,
  ) => PanelResizeSession | null;
  /** Resolve which geometrically coincident handle should own a pointer
   * gesture once its initial direction is known. Non-coincident handles
   * resolve to themselves. */
  resolvePointerResizeHandle: (handleToken: object, deltaPx: number) => object;
  moveResize: (session: PanelResizeSession, deltaPx: number) => boolean;
  /** End a session. `canceled` records a non-release ending (pointer
   * cancel, lost capture, blur, unmount, or an exception path). */
  endResize: (session: PanelResizeSession, canceled?: boolean) => void;
  /** Internal reactive snapshots keyed by private handle token. */
  handleStates: KeyedStore<object, PanelResizeHandleState | null>;
  /** Internal: the live pointer resize session, keyed by its OWNING handle
   * token — at most one entry, absent while no pointer session is active.
   * Coincident seams can transfer session ownership away from the handle
   * holding pointer capture on the first qualifying move, so active/limited
   * presentation must follow this store rather than the pressed handle's
   * local pointer session (R-22). Keyboard sessions are atomic value
   * changes with no lifecycle (§4) and never publish here. */
  handlePointerSessions: KeyedStore<object, HandlePointerSessionState>;
  /** Internal: transient hover/visible-focus facts per handle (R-26).
   * Written from the handle's own interaction handlers (enter/leave,
   * focus/blur, keydown upgrade); the line-visibility observer subscribes
   * so at a shared coordinate the separator line follows session owner >
   * hovered > keyboard-focused > DOM order, and a keyboard-focused handle
   * renders its line even where edge rules hide resting lines (R-23). */
  handleInteractions: KeyedStore<object, HandleInteractionState>;
  /** Internal: per-handle separator-line presentation from the group's
   * visibility observer — whether this handle mounts its line element, and
   * whether the coincident run it fronts is hovered (see
   * `HandleLineState`, R-28). */
  handleLineVisibility: KeyedStore<object, HandleLineState>;
  /** Enter on a handle: toggles an adjacent collapsible panel on a live
   * boundary, or — when the boundary is drag-dead only because an adjacent
   * zero-collapsed collapsible panel exists (R-18) — expands that panel. */
  toggleHandlePanel: (handleToken: object) => boolean;
  resetHandlePanel: (
    handleToken: object,
    target: "before" | "after",
    trigger?: Extract<PanelValueChangeTrigger, "pointer" | "keyboard">,
  ) => boolean;
  getHandleDiagnostic: (handleToken: object) => string | null;
  /** Allocator-owned rendered px for a panel after collapsed and expanded
   *  over-constraint policies have been applied. Call-time read — use
   *  `usePanelRenderedSize` for reactive reads. */
  getPanelRenderedSize: (token: object) => number | undefined;
  /** Attribute an application-driven panel mutation to this group. Public
   * panel controls call this before mutating so pending persistence hydration
   * cannot replace an explicit action with an older stored layout. */
  markLayoutSource: (attribution: ChangeAttribution) => () => void;
  /** Hand an automatic peer back to the allocator, re-resolving the whole
   * automatic pool. Reports the size allocated to this peer (`null` when no
   * reallocation was possible) and whether the re-resolution actually
   * committed a pool change — the §10 acceptance signal a
   * `reset({transition:"none"})` gates its animation suppression on
   * (R-20). */
  resetAutomaticPeer: (token: object) => {
    size: number | null;
    changed: boolean;
  };
  /** Best-effort attribution for per-panel committed callbacks. */
  getChangeAttribution: () => PanelChangeDetails;
  /** Internal registry for every panel in this group, keyed by a private
   * per-instance token. Public ids are deliberately not used as identity:
   * ids are optional and may only be used for imperative lookup/persistence. */
  panelControls: KeyedStore<object, InternalPanelControls>;
  /** Internal: live peer sizes keyed by peer token. Exposed for the
   *  per-token `usePeerSize` subscription; treat as read-only. */
  peerSizes: KeyedStore<object, number>;
  /** Internal: allocator-owned rendered px per panel token. Exposed for the
   *  per-token `usePanelRenderedSize` subscription; treat as read-only. */
  renderedSizes: KeyedStore<object, number>;
  /** Internal one-shot threshold-motion commands, keyed by panel token. */
  thresholdMotions: KeyedStore<object, PanelThresholdMotion>;
  /** Internal responsive auto-collapse fold bit per panel token (R-37).
   * Published by the allocation pass; consumed via `usePanelAutoCollapsed`.
   * Only folded tokens carry `true`; read-only for panels. */
  autoCollapsed: KeyedStore<object, boolean>;
  /** Arm a manual-expand override on an auto-folded panel (R-37): suppresses
   * the fold for that panel until the container re-crosses its threshold. The
   * action's attribution is carried so the resulting release event reports the
   * user's trigger (api/keyboard), not the system allocation pass. */
  armAutoOverride: (token: object, attribution: PanelChangeDetails) => void;
  /** Group content-box size along its axis, in px. Updated via ResizeObserver
   *  so percentage-based panel sizes (e.g. `"50%"`) track the allocatable
   *  container space as it resizes. Zero until the first measurement settles. */
  containerSize: number;
  /** True while THIS group's container is resizing along its main axis
   * (observer-driven, cleared after a short idle). Panels suppress their CSS
   * transitions on this group-local signal — not the provider-wide
   * `isResizing` — so another group's container churn (e.g. a nested
   * same-axis group tracking a docked sibling's animated collapse) cannot
   * cancel this group's transitions mid-flight (R-31). */
  isContainerResizing: boolean;
  /** Call-time predicate: is the group currently over-constrained (its panels'
   *  floors plus gutters exceed the container)? A getter, not a value, so it
   *  never churns the context on resize; a size action reads it to report a
   *  truthful `constrained` flag when the paint is floored (G1). */
  isOverconstrained: () => boolean;
};

/** What `registerChild` sees from each `<Panel>`. `panelId` is the panel's
 *  group-local identity (layout snapshots, persistence, events, lookup);
 *  anonymous panels carry only their stable token and rendered DOM id. */
export type ChildEntry =
  | {
      kind: "docked";
      token: object;
      panelId?: string;
      domId: string;
      getElement: () => HTMLElement | null;
    }
  | {
      kind: "peer";
      token: object;
      panelId?: string;
      domId: string;
      getElement: () => HTMLElement | null;
    };

export type PanelResizeSession = {
  /** Unique gesture owner. Group mutations and completion are accepted only
   * while this exact session remains active. */
  owner: object;
  boundaryIndex: number;
  panels: BoundaryPanel<object>[];
  /** Entries captured with the boundary so threshold transitions can read the
   * live presentation rect without searching or trusting stale React state. */
  entries: Map<object, ChildEntry>;
  fromSizes: Map<object, number>;
  preferredSizes: Map<object, number>;
  /** Panels that were collapsed when this resize session began. Their
   * opening hysteresis is measured from collapsedSize rather than the
   * expanded panel's collapseBelow threshold. */
  initiallyCollapsed: Set<object>;
  /** Synchronous gesture state. React's panel registry commits later, so rapid
   * reversals must not use `controls.collapsed` as their source of truth. */
  interactionCollapsed: Map<object, boolean>;
  lastSizes: Map<object, number>;
  /** Visual px per layout px along the group axis at session start (≠ 1
   * inside a `transform: scale()` ancestor). Rect-based session geometry
   * divides by this so it lands in the same layout unit as configured
   * min/max sizes and the allocation model. */
  axisScale: number;
  moved: boolean;
  /** `cascade="latching"` rebase state (R-25) — present only for pointer
   * sessions in a latching group; absent means reversible transaction
   * semantics. When the pointer reverses beyond the dead-band,
   * `fromSizes` is replaced with the raw cascade sizes at the signed
   * APPLIED-delta extreme of the ending direction, so the retreat regrows
   * panels adjacent-first instead of retracing the cascade. The rebase is
   * internal: `preferredSizes`, `initiallyCollapsed`, and the transaction's
   * event baseline are never rebased. */
  latch?: {
    /** Raw session delta (post-RTL-negation, cumulative from the pointer
     * origin) at which the current `fromSizes` was captured. The epoch's
     * effective delta = raw − baseDelta. */
    baseDelta: number;
    /** Farthest effective delta reached in `direction` this epoch. */
    extremeRaw: number;
    /** `resizeBoundary`'s applied delta at `extremeRaw` — the rebase
     * anchor, so pointer overshoot past capacity never shifts the origin
     * (returning from overshoot stays dead until the seam is reached,
     * exactly as in reversible mode). */
    extremeApplied: number;
    /** 0 until the epoch's first nonzero effective delta picks a
     * direction; flips on every rebase. */
    direction: 0 | 1 | -1;
  };
};

/** INTERNAL: the group's live resize transaction. Held in a ref owned by
 * the composition root so the resize controller, the change ledger, and the
 * allocation pass all consult the same synchronous authority. */
export type ActiveResize = {
  session: PanelResizeSession;
  /** The owning handle's private token — the key under which pointer
   * sessions publish to `handlePointerSessions` (R-22). */
  handleToken: object;
  handleId?: string;
  trigger: Extract<PanelValueChangeTrigger, "pointer" | "keyboard">;
  /** Group value at transaction start: the operation baseline for the
   * first emitted change and for `onResizeEnd.initialValue`. */
  initialLayout: PanelGroupLayout;
};

/** INTERNAL: state the group publishes for the handle that owns the live
 * pointer resize session (see `handlePointerSessions`). Presence of the
 * entry is the ownership signal; the payload carries the per-move facts
 * the owning handle presents. */
export type HandlePointerSessionState = {
  /** Latest `moveResize` range-limit result for the owning boundary,
   * rendered as `data-limited` on the owning handle. */
  limited: boolean;
};

/** INTERNAL: transient per-handle interaction facts each handle publishes
 * for the group's line-visibility observer (see `handleInteractions`,
 * R-26). Entries exist only while at least one flag is true. */
export type HandleInteractionState = {
  /** The pointer is over this handle's hit area. At a coincident seam the
   * split hit areas mean the hovered half can be the handle whose line the
   * DOM-order dedup suppressed — the cursor already signals it, so the
   * line must follow. */
  hovered: boolean;
  /** The handle has VISIBLE (keyboard-modality) focus. Pointer-driven
   * focus deliberately stays false so post-drag steady state keeps the
   * DOM-order line dedup; keyboard focus must never be invisible (R-23).
   * The publishing handle keys its OWN lit presentation (line opacity,
   * `data-active`, z-index bump) off the same modality bit via a local
   * mirror (R-29) — a clicked handle keeps focus but rests visually until
   * the first keydown upgrades it. */
  focusVisible: boolean;
};

/** INTERNAL: separator-line presentation the group's visibility observer
 * publishes per handle (see `handleLineVisibility`). */
export type HandleLineState = {
  /** Whether this handle mounts its separator line element. At a shared
   * coordinate exactly one member of the coincident run — the elected
   * primary: session owner (R-22/R-24) > keyboard-focused (R-23) > DOM
   * order — mounts the run's single line; a keyboard-focused handle
   * additionally mounts its line at the group's content edges where
   * resting lines hide (R-23). */
  visible: boolean;
  /** R-28: a coincident run presents as ONE seam — true on a multi-member
   * run's elected line while ANY run member is hovered and no pointer
   * session is live, so the handle lights its line for `active || runHot`
   * and hover anywhere in the shared hit area lights the elected line
   * without moving it. Always false for ordinary (non-coincident) handles:
   * their hover lights their own line through their element state, and
   * keeping the bit inert there keeps hover flips at ordinary seams
   * zero-notification recomputes. */
  runHot: boolean;
};

export type PanelResizeHandleState = {
  /** DOM ids of the adjacent panels, for `aria-controls`. */
  beforeId: string;
  afterId: string;
  /** Semantic `panelId`s of the adjacent panels (absent for anonymous
   * panels), rendered as `data-before-panel`/`data-after-panel`. */
  beforePanelId?: string;
  afterPanelId?: string;
  adjacentCollapsed: boolean;
  /** Pointer target allocation when expanded zero-sized panels make adjacent
   * handles geometrically coincident. Outer handles split the shared hit area;
   * handles inside a zero-sized run keep keyboard semantics without
   * intercepting pointer input. */
  pointerHitArea: "full" | "before" | "after" | "none";
  valueNow: number;
  valueMin: number;
  valueMax: number;
  valueText: string;
  disabled: boolean;
  /** R-18: the boundary cannot drag, but the handle stays focusable and
   * Enter expands the adjacent zero-collapsed collapsible panel. Mutually
   * exclusive with `disabled`; rendered as `data-toggle-only`. */
  toggleOnly: boolean;
};

export const PanelGroupContext = createContext<PanelGroupContextType | null>(
  null,
);

export function usePanelGroup(componentName = "<Panel>") {
  const ctx = useContext(PanelGroupContext);
  if (!ctx) {
    throw new Error(`${componentName} must be used within a <PanelGroup>`);
  }
  return ctx;
}

/** Internal: reactive read of one peer's resolved size. Undefined means the
 * allocator has not committed this peer yet; numeric zero is a resolved,
 * explicit size. Re-renders only when this token's size changes. */
export function usePeerSize(token: object): number | undefined {
  const sizes = usePanelGroup().peerSizes;
  const subscribe = useCallback(
    (cb: () => void) => sizes.subscribeKey(token, cb),
    [sizes, token],
  );
  const getSnapshot = useCallback(() => sizes.get(token), [sizes, token]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Internal: reactive read of one panel's allocator-owned rendered size.
 * Expanded peers use `usePeerSize`; collapsed peers and every docked panel
 * use this store so reported geometry matches the allocator. */
export function usePanelRenderedSize(token: object): number | undefined {
  const effectives = usePanelGroup().renderedSizes;
  const subscribe = useCallback(
    (cb: () => void) => effectives.subscribeKey(token, cb),
    [effectives, token],
  );
  const getSnapshot = useCallback(
    () => effectives.get(token),
    [effectives, token],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Internal: reactive read of one panel's responsive auto-collapse fold bit
 * (R-37). `true` while the group has folded this panel for width; `false`
 * otherwise. Re-renders only when this token's fold state changes. */
export function usePanelAutoCollapsed(token: object): boolean {
  const store = usePanelGroup().autoCollapsed;
  const subscribe = useCallback(
    (cb: () => void) => store.subscribeKey(token, cb),
    [store, token],
  );
  const getSnapshot = useCallback(
    () => store.get(token) ?? false,
    [store, token],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Internal: subscribe to threshold-triggered motion commands for one panel. */
export function usePanelThresholdMotion(
  token: object,
): PanelThresholdMotion | undefined {
  const motions = usePanelGroup().thresholdMotions;
  const subscribe = useCallback(
    (cb: () => void) => motions.subscribeKey(token, cb),
    [motions, token],
  );
  const getSnapshot = useCallback(() => motions.get(token), [motions, token]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
