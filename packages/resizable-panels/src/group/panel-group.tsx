"use client";

import {
  type CSSProperties,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createKeyedStore } from "../core/keyed-store.js";
import { panelGroupLayoutsEqual } from "../core/layout-state.js";
import type { PanelGroupCommands } from "../core/panel-store.js";
import { shallowEqualInternalControls } from "../core/panel-store.js";
import { SIZE_EPSILON } from "../core/size.js";
import {
  PANEL_TRANSITION_EASING,
  PANEL_TRANSITION_MS,
  resolvePanelAnimation,
} from "../core/timing.js";
import { usePanelLayoutInternal } from "../provider/contexts.js";
import { EnsurePanelProvider } from "../provider/panel-provider.js";
import {
  IS_DEVELOPMENT,
  NO_WARNINGS,
  useDevWarnings,
  warnDev,
} from "../shared/diagnostics.js";
import { composeRefs } from "../shared/refs.js";
import type {
  InternalPanelControls,
  PanelChangeDetails,
  PanelCursorBehavior,
  PanelGroupAnimation,
  PanelGroupCascade,
  PanelGroupLayout,
  PanelGroupOrientation,
  PanelGroupPersistenceOptions,
  PanelGroupValue,
  PanelGroupValueChangeDetails,
  PanelLayoutMap,
  PanelResizeEndEvent,
  PanelResizeStartEvent,
} from "../types.js";
import {
  duplicatePanelId,
  sameChildOrder,
  sameEntry,
  sortChildrenByDomOrder,
} from "./child-order.js";
import {
  type ActiveResize,
  type ChildEntry,
  type HandleInteractionState,
  type HandleLineState,
  type HandlePointerSessionState,
  PanelGroupContext,
  type PanelResizeHandleState,
  type PeerSlot,
} from "./group-context.js";
import { useContainerMeasurement } from "./use-container-measurement.js";
import { useGroupAllocation } from "./use-group-allocation.js";
import {
  useGroupPersistenceEffects,
  useGroupPersistenceState,
} from "./use-group-persistence.js";
import { useGroupValue } from "./use-group-value.js";
import { handleStatesEqual, useHandleStates } from "./use-handle-states.js";
import { useLineVisibility } from "./use-line-visibility.js";
import { usePeerCommands } from "./use-peer-commands.js";
import { useResizeController } from "./use-resize-controller.js";

type PanelGroupElementProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  // `defaultValue` shadows React's meaningless-on-div form attribute so the
  // group's uncontrolled state prop can own the conventional name.
  "children" | "className" | "defaultValue" | "dir" | "style"
>;

type PanelGroupBaseProps = PanelGroupElementProps & {
  orientation: PanelGroupOrientation;
  children: ReactNode;
  /** Publish this group as a provider lookup namespace. Panels inside become
   * addressable through `usePanelControls({ groupId, panelId })` and the
   * `usePanelActions()` dispatcher. Unnamed groups stay fully functional but
   * private to their subtree. */
  groupId?: string;
  /** Imperative group API. The normal React `ref` points to the group's root
   * HTMLDivElement. */
  apiRef?: Ref<PanelGroupApi>;
  className?: string;
  style?: CSSProperties;
  /** Disable pointer, keyboard, collapse-toggle, and reset interactions for
   * every resize handle in this group. */
  disabled?: boolean;
  /** Cursor styling policy during pointer resize. Defaults to `"global"`. */
  cursorBehavior?: PanelCursorBehavior;
  /**
   * Library-owned animation for this group's panels (R-16).
   *
   * - Omitted — the default 300ms `cubic-bezier(0.4, 0, 0.2, 1)` panel
   *   transition and the collapse-threshold spring derived from it.
   * - `false` — disables all library-owned panel transitions AND the
   *   threshold-motion spring for this group. `prefers-reduced-motion`
   *   continues to disable motion independently; whichever is stricter wins.
   * - `{ durationMs?, easing? }` — partial overrides. Invalid values
   *   (non-positive/non-finite duration, non-string or blank easing) fall
   *   back to the defaults with a dev warning.
   *
   * Scope: this group's own panels only. Nested groups are governed by
   * their own `animation` prop — there is no inheritance across groups.
   */
  animation?: PanelGroupAnimation;
  /**
   * Mid-drag cascade reversal semantics for this group's pointer drags
   * (R-25). Defaults to `"reversible"`.
   *
   * - `"reversible"` — a held drag is one transaction computed from the
   *   session-start snapshot: reversing direction exactly retraces the
   *   cascade, so space taken from a far panel returns to it before the
   *   boundary-adjacent panel regrows. Overshoot is always recoverable.
   * - `"latching"` — cascade pushes are one-way within a held drag: when
   *   the pointer reverses beyond a small dead-band (2px, derived from the
   *   click-vs-drag threshold, so pointer jitter never latches), the
   *   session rebases at the directional extreme and panels regrow starting
   *   from the boundary-adjacent panel — far panels keep their pushed size.
   *   The flip side of the jitter guard: a push of ≤2px is
   *   indistinguishable from jitter and gives back on reversal. Give-back
   *   is bounded at the dead-band — recovering more always latches first.
   *
   * Only pointer drags differ: keyboard steps and imperative actions are
   * atomic single changes, and across sessions the modes are identical
   * (sizes commit on release; a new drag starts from the committed state).
   * `onResizeStart`/`onResizeEnd` still report the original session-start
   * value in both modes. Invalid values fall back to `"reversible"` with a
   * dev warning.
   */
  cascade?: PanelGroupCascade;
  /** Inline direction for horizontal layout. When omitted, the group uses
   * the computed direction inherited from its DOM ancestors. */
  dir?: "ltr" | "rtl";
  /**
   * If set, the group reads/writes a snapshot of all child panel
   * `{collapsed, size}` state to storage under `persistence.key`. Both
   * docked and collapsible peer panels with a `panelId` round-trip their
   * preferred and collapsed state; anonymous panels are excluded.
   * A pointer, keyboard, reset, or imperative change made before an async
   * read finishes takes precedence over that stored snapshot. Mutually
   * exclusive with controlled `value`; `defaultValue` remains the SSR and
   * first-paint fallback while restoration is pending.
   */
  persistence?: PanelGroupPersistenceOptions;
  /** Fires for every actual value change (or controlled proposal), with the
   * operation (`reason`) and input (`trigger`) that produced it. Never fires
   * for pure child reorders, canonicalization, or no-move pointer sessions. */
  onValueChange?: (
    value: PanelGroupValue,
    details: PanelGroupValueChangeDetails,
  ) => void;
  /** Pointer resize transaction start. The lifecycle brackets actual
   * movement: fires when the first pointer move crosses the click-vs-drag
   * threshold, not at pointer-down — a click without movement emits nothing.
   * Keyboard actions are atomic value changes and emit no lifecycle. */
  onResizeStart?: (event: PanelResizeStartEvent) => void;
  /** Pointer resize transaction end — exactly once per session that started
   * (fired `onResizeStart`), including cancel, lost capture, exception, and
   * unmount endings. A press-and-release without qualifying movement never
   * started a session and emits nothing. */
  onResizeEnd?: (event: PanelResizeEndEvent) => void;
};

type ControlledPanelGroupStateProps = {
  /** Controlled group value. Interactions emit proposals through
   * `onValueChange`; the prop remains authoritative until the parent accepts
   * a proposal by providing a new value. */
  value: PanelGroupValue;
  defaultValue?: never;
};

type UncontrolledPanelGroupStateProps = {
  value?: never;
  /** Initial value when uncontrolled. */
  defaultValue?: PanelGroupValue;
};

export type PanelGroupProps = PanelGroupBaseProps &
  (ControlledPanelGroupStateProps | UncontrolledPanelGroupStateProps);

export type PanelGroupApi = {
  /** Canonical current value for mounted identified panels. */
  getValue: () => PanelGroupValue;
  /** Replace the group value. Unknown keys are ignored; omitted mounted keys
   * restore their declarative defaults; sizes reconcile to live bounds. */
  setValue: (value: PanelGroupValue) => void;
  /** Restore `defaultValue` when supplied, otherwise the current declarative
   * child defaults. A restored persisted value is never the baseline. */
  resetValue: () => void;
};

/** Lays out child <Panel>s along an axis. A group standing alone installs
 * its own provider boundary (§14); the nearest surrounding
 * `<PanelProvider>` — explicit, or an outer group's implicit one — wins. */
export const PanelGroup = forwardRef<HTMLDivElement, PanelGroupProps>(
  function PanelGroup(props, ref) {
    return (
      <EnsurePanelProvider>
        <PanelGroupImpl {...props} ref={ref} />
      </EnsurePanelProvider>
    );
  },
);

const PanelGroupImpl = forwardRef<HTMLDivElement, PanelGroupProps>(
  function PanelGroupImpl(
    {
      orientation,
      children,
      groupId,
      className,
      style,
      apiRef: groupApiRef,
      disabled = false,
      cursorBehavior = "global",
      animation,
      cascade = "reversible",
      dir,
      persistence,
      value: controlledValue,
      defaultValue,
      onValueChange,
      onResizeStart,
      onResizeEnd,
      ...elementProps
    },
    elementRef,
  ) {
    // HOOK ORDER IS LOAD-BEARING. React runs layout effects in hook call
    // order, and the extracted group hooks (persistence, value, resize,
    // handle states, line visibility, measurement, allocation) each register
    // effects at the position of their call. The sequence below preserves
    // the registration order the group has always had: publishGroup →
    // child-order sort → line visibility → handle-state publication →
    // measurement → allocation → controlled commit → persistence read;
    // passive: ledger cancel → publisher init → children reconcile →
    // persistence write-back. Do not reorder these calls casually.
    const layout = usePanelLayoutInternal();
    const setSkipAnimation = layout.setSkipAnim;
    // The animation option object is routinely a fresh literal each render;
    // resolve from its primitive fields so the resolved object (and with it
    // the group context value) stays referentially stable (R-16).
    const animationDisabled = animation === false;
    const animationOptionsAreObject =
      animation !== false &&
      typeof animation === "object" &&
      animation !== null;
    // Runtime misuse (e.g. `animation={true}` through untyped code) degrades
    // to the default animation with a dev warning below.
    const animationShapeInvalid =
      animation !== undefined &&
      animation !== false &&
      !animationOptionsAreObject;
    const animationDurationInput = animationOptionsAreObject
      ? animation.durationMs
      : undefined;
    const animationEasingInput = animationOptionsAreObject
      ? animation.easing
      : undefined;
    const resolvedAnimation = useMemo(
      () =>
        resolvePanelAnimation(
          animationDisabled,
          animationDurationInput,
          animationEasingInput,
        ),
      [animationDisabled, animationDurationInput, animationEasingInput],
    );
    // Runtime misuse (a typo through untyped code) degrades to the default
    // reversible transaction semantics with a dev warning below — the
    // default path stays exactly today's behavior (R-25).
    const resolvedCascade: PanelGroupCascade =
      cascade === "latching" ? "latching" : "reversible";
    // Persistence identity, the hydration state machine, and the dirty/
    // write-gate callbacks (§12). The read/write effects register late via
    // useGroupPersistenceEffects so their effect order is unchanged.
    const persistenceState = useGroupPersistenceState({
      persistence,
      hasControlledValue: Boolean(controlledValue),
      orientation,
    });
    const {
      persistenceKey,
      flushPersistenceRef,
      markPersistenceDirty,
      markPersistenceDirtyRevocable,
      reopenPersistenceWriteGate,
    } = persistenceState;
    // Stable private identity of this mounted group in the provider
    // registry. Panels register under it keyed by panelId; a declared
    // groupId publishes it for provider-level locator lookup below.
    const registryToken = useRef<object>({}).current;
    // The dispatcher's group commands resolve through this ref so the
    // publication effect never re-runs when command internals change. The
    // real implementations are assigned below, after the value API exists.
    const groupCommandsRef = useRef<PanelGroupCommands | null>(null);
    const stableGroupCommands = useMemo<PanelGroupCommands>(
      () => ({
        getValue: () => groupCommandsRef.current?.getValue() ?? {},
        setValue: (value) =>
          groupCommandsRef.current?.setValue(value) ?? {
            applied: false,
            reason: "not-found",
          },
        resetValue: () =>
          groupCommandsRef.current?.resetValue() ?? {
            applied: false,
            reason: "not-found",
          },
      }),
      [],
    );
    useLayoutEffect(() => {
      if (!groupId) return;
      layout.store.publishGroup(
        groupId,
        registryToken,
        registryToken,
        stableGroupCommands,
      );
      return () => layout.store.unpublishGroup(groupId, registryToken);
    }, [groupId, layout.store, registryToken, stableGroupCommands]);
    const callbacksRef = useRef({
      onValueChange,
      onResizeStart,
      onResizeEnd,
      onPersistenceError: persistence?.onError,
      onPersistenceStatusChange: persistence?.onStatusChange,
    });
    callbacksRef.current = {
      onValueChange,
      onResizeStart,
      onResizeEnd,
      onPersistenceError: persistence?.onError,
      onPersistenceStatusChange: persistence?.onStatusChange,
    };

    useDevWarnings(
      IS_DEVELOPMENT
        ? [
            orientation !== "horizontal" && orientation !== "vertical"
              ? `<PanelGroup orientation> must be "horizontal" or "vertical"; received "${String(orientation)}".`
              : null,
            controlledValue && defaultValue
              ? "<PanelGroup> cannot receive both value and defaultValue. Choose controlled or uncontrolled state."
              : null,
            controlledValue && persistence
              ? "<PanelGroup> cannot combine value with persistence. A controlled parent owns storage and restoration, so persistence is disabled."
              : null,
            persistence !== undefined && persistenceKey?.trim() === ""
              ? "<PanelGroup persistence.key> must be a non-empty string."
              : null,
            groupId !== undefined && groupId.trim() === ""
              ? "<PanelGroup groupId> must be a non-empty string."
              : null,
            cursorBehavior !== "global" &&
            cursorBehavior !== "handle" &&
            cursorBehavior !== "none"
              ? '<PanelGroup cursorBehavior> must be "global", "handle", or "none".'
              : null,
            cascade !== "reversible" && cascade !== "latching"
              ? '<PanelGroup cascade> must be "reversible" or "latching". Falling back to "reversible".'
              : null,
            animationShapeInvalid
              ? "<PanelGroup animation> must be false or an options object ({ durationMs, easing }). Falling back to the default animation."
              : null,
            animationDurationInput !== undefined &&
            resolvedAnimation.durationMs !== animationDurationInput
              ? `<PanelGroup animation.durationMs> must be a finite number greater than zero. Falling back to ${PANEL_TRANSITION_MS}.`
              : null,
            animationEasingInput !== undefined &&
            resolvedAnimation.easing !== animationEasingInput
              ? `<PanelGroup animation.easing> must be a non-empty string. Falling back to "${PANEL_TRANSITION_EASING}".`
              : null,
          ]
        : NO_WARNINGS,
    );

    const groupElementRef = useRef<HTMLDivElement>(null);
    const getTextDirection = useCallback((): "ltr" | "rtl" => {
      if (dir) return dir;
      const element = groupElementRef.current;
      if (!element || typeof getComputedStyle === "undefined") return "ltr";
      return getComputedStyle(element).direction === "rtl" ? "rtl" : "ltr";
    }, [dir]);

    // ─── child order registry ────────────────────────────────────────────────
    // Insertion-ordered. Stored in state so render-time seam interleaving and
    // auto-distribution effects can react to mounts/unmounts. The cost is one
    // re-render per panel mount, which is fine — they're rare.
    const [childOrder, setChildOrder] = useState<ChildEntry[]>([]);
    // Automatic peers may legitimately receive 0px while a container is
    // temporarily over-constrained. Track only zeros produced by explicit
    // API/layout input so later container growth can resolve an automatic 0.
    // Declared before registerChild so its unmount cleanup can forget marks.
    const explicitZeroPeersRef = useRef(new Set<object>());
    const registerChild = useCallback((entry: ChildEntry) => {
      // Idempotent: if an entry with the same kind+identity already exists
      // (e.g. an effect re-ran without unmount), skip rather than appending
      // a duplicate.
      setChildOrder((prev) => {
        const exists = prev.some((e) => sameEntry(e, entry));
        return exists ? prev : sortChildrenByDomOrder([...prev, entry]);
      });
      return () => {
        // Preserve array identity when the entry is already gone. `filter`
        // always allocates a new array; a fresh reference retriggers the
        // allocation layout effect even when membership did not change —
        // and under React 18 that feedback loop hits max update depth when
        // a parent remounts children from `usePanelGroupState` (responsive
        // drawer pattern).
        setChildOrder((prev) => {
          const next = prev.filter((e) => !sameEntry(e, entry));
          return next.length === prev.length ? prev : next;
        });
        // A real unmount forgets the panel's explicit-zero mark. This lives
        // here rather than in registerPeer's cleanup because slot
        // re-registration (bounds re-resolving when the container resizes)
        // must not wipe interaction state while a ResizeObserver
        // redistribution may still read it — that ordering is racy.
        explicitZeroPeersRef.current.delete(entry.token);
      };
    }, []);

    // React may preserve component instances while moving keyed children. Their
    // mount effects do not re-run, so registration order is not DOM order. Sort
    // after every children commit and update only when the token sequence moved.
    useLayoutEffect(() => {
      void children;
      setChildOrder((prev) => {
        const next = sortChildrenByDomOrder(prev);
        return sameChildOrder(prev, next) ? prev : next;
      });
    }, [children]);
    const childOrderRef = useRef(childOrder);
    childOrderRef.current = childOrder;
    const listChildren = useCallback(() => childOrderRef.current.slice(), []);

    useDevWarnings(
      IS_DEVELOPMENT
        ? [
            persistenceKey &&
            childOrder.length > 0 &&
            childOrder.every((entry) => !entry.panelId)
              ? `<PanelGroup persistence key="${persistenceKey}"> has no panels with a panelId, so there is no layout state to persist.`
              : null,
            duplicatePanelId(childOrder)
              ? `Duplicate panelId "${duplicatePanelId(childOrder)}" within one <PanelGroup>. Each panel in a group must have a unique panelId; rename one of the duplicates.`
              : null,
          ]
        : NO_WARNINGS,
    );

    // ─── peer slot + size stores ─────────────────────────────────────────────
    // Slots hold each peer's resolved bounds (recomputed by the peer on each
    // render and pushed back via registerPeer). Sizes hold the live px the
    // group has assigned the peer. Both live in external stores, not React
    // state: a seam drag mutates `peerSizes` per mousemove, and only the
    // peers subscribed to the changed tokens re-render (via usePeerSize) —
    // not every child of the group.
    const [peerSlots] = useState(() =>
      createKeyedStore<object, PeerSlot>(slotsEqual),
    );
    const [peerSizes] = useState(() => createKeyedStore<object, number>());
    const markExplicitPeerSize = useCallback((token: object, size: number) => {
      if (size <= SIZE_EPSILON) explicitZeroPeersRef.current.add(token);
      else explicitZeroPeersRef.current.delete(token);
    }, []);
    const markGesturePeerSize = useCallback((token: object, size: number) => {
      // A peer reaching zero as the counterparty to a boundary drag is still
      // automatic: collapsing or reopening a sibling may give it space again.
      // A positive drag result does supersede a prior API/layout-authored zero.
      if (size > SIZE_EPSILON) explicitZeroPeersRef.current.delete(token);
    }, []);
    const canPeerCompensateFromZero = useCallback(
      (token: object) =>
        peerSlots.get(token)?.defaultIsExplicit === false &&
        !explicitZeroPeersRef.current.has(token),
      [peerSlots],
    );
    // Every panel participates in group layout under a private instance token.
    // Public ids remain optional and are only for cross-group lookup and
    // persistence; they are not safe structural identity.
    const [panelControls] = useState(() =>
      createKeyedStore<object, InternalPanelControls>(
        shallowEqualInternalControls,
      ),
    );
    const [handleElements] = useState(() =>
      createKeyedStore<object, () => HTMLElement | null>(),
    );
    // Space-occupying handle gutters (R-14). Each handle registers its
    // resolved gutterSize so the allocator can reserve Σ gutters before
    // distributing the container to panels — panels + gutters must sum to
    // the container.
    const [handleGutterSizes] = useState(() =>
      createKeyedStore<object, number>(),
    );
    /** Σ registered gutter widths — space handle slots occupy that can never
     * be allocated to panels (R-14). Every container distribution works from
     * `containerSize - reservedGutterSize()` so the sum invariant becomes
     * Σ panels + Σ gutters = container. */
    const reservedGutterSize = useCallback((): number => {
      let total = 0;
      for (const gutter of handleGutterSizes.getMap().values()) {
        total += gutter;
      }
      return total;
    }, [handleGutterSizes]);
    const [handleLineVisibility] = useState(() =>
      createKeyedStore<object, HandleLineState>(
        (a, b) => a.visible === b.visible && a.runHot === b.runHot,
      ),
    );
    const [handleStates] = useState(() =>
      createKeyedStore<object, PanelResizeHandleState | null>(
        handleStatesEqual,
      ),
    );
    // The live pointer session's OWNING handle token (R-22). At a coincident
    // seam the session can begin on a different handle than the one that
    // captured the pointer, so active/limited presentation subscribes here
    // instead of trusting the local pointer session. At most one entry;
    // set in beginResize, limited-updated per moveResize tick, deleted in
    // endResize (every end path funnels through it). Event-handler-owned —
    // no effect ever writes it, so StrictMode double-effects cannot leak a
    // stale owner. Keyboard sessions are atomic and never publish.
    const [handlePointerSessions] = useState(() =>
      createKeyedStore<object, HandlePointerSessionState>(
        (a, b) => a.limited === b.limited,
      ),
    );
    // Transient hover/visible-focus facts per handle (R-26). Written by the
    // handle's interaction handlers at enter/leave/focus/blur cadence (never
    // per pointer move); entries exist only while a flag is true, so the map
    // stays tiny. The line-visibility observer subscribes so the separator
    // line can follow the hovered half of a coincident seam's split hit
    // area and surface keyboard focus (R-23) — hover flips at ordinary
    // seams recompute to an identical map and notify nobody.
    const [handleInteractions] = useState(() =>
      createKeyedStore<object, HandleInteractionState>(
        (a, b) => a.hovered === b.hovered && a.focusVisible === b.focusVisible,
      ),
    );

    // Declared handle identity, reported in resize lifecycle events.
    // Anonymous handles stay fully functional but report no handleId; the
    // handle's DOM id is never used as event identity.
    const handleIdsRef = useRef(new Map<object, string>());
    const warnedHandleIdsRef = useRef(new Set<string>());
    const registerHandle = useCallback(
      (
        token: object,
        getElement: () => HTMLElement | null,
        handleId?: string,
        gutterSize = 0,
      ) => {
        handleElements.set(token, getElement);
        handleGutterSizes.set(token, gutterSize);
        if (handleId) {
          const declared = handleIdsRef.current;
          if (IS_DEVELOPMENT && !warnedHandleIdsRef.current.has(handleId)) {
            for (const [otherToken, otherId] of declared) {
              if (otherId === handleId && otherToken !== token) {
                warnedHandleIdsRef.current.add(handleId);
                warnDev(
                  `Duplicate handleId "${handleId}" within one <PanelGroup>. Each handle in a group must have a unique handleId; rename one of the duplicates.`,
                );
                break;
              }
            }
          }
          declared.set(token, handleId);
        }
        return () => {
          handleElements.delete(token);
          handleGutterSizes.delete(token);
          // A handle unmounting mid-hover never gets its mouseleave/blur;
          // drop its interaction facts with the rest of its registration.
          // (The handle's registration effect republishes from its local
          // mirror after a re-register, so replays don't lose live hover.)
          handleInteractions.delete(token);
          handleIdsRef.current.delete(token);
        };
      },
      [handleElements, handleGutterSizes, handleInteractions],
    );

    // Separator-line visibility/election for the whole group (one observer
    // set; R-22/R-23/R-24/R-26/R-28). Registered here — its original
    // position — so effect order is unchanged.
    useLineVisibility({
      groupElementRef,
      orientation,
      handleElements,
      handleInteractions,
      handleLineVisibility,
      handlePointerSessions,
    });

    const registerPeer = useCallback(
      (token: object, slot: PeerSlot) => {
        // The store's slotsEqual skips the commit (and notification) when an
        // effect re-ran with identical resolved bounds.
        peerSlots.set(token, slot);
        return () => {
          peerSlots.delete(token);
          // Intentionally keep the peer's size in peerSizes AND its
          // explicit-zero mark so a re-register (this effect re-runs
          // whenever the container size or resolved bounds change) doesn't
          // wipe live interaction state and trigger a fresh redistribution.
          // Stale entries are safe because every public reader (setPeerSize,
          // auto-distribute, container redistribution) starts from
          // childOrder/peerSlots and only looks up tokens that still appear
          // there; real unmounts are forgotten by registerChild's cleanup.
        };
      },
      [peerSlots],
    );

    // Allocator-owned rendered px per panel. This keeps docked over-constraint
    // shrink and collapsed-rail compression out of browser flex heuristics,
    // while peerSizes can continue retaining an expanded peer's preference
    // during collapse. Panels and handles subscribe per private token.
    const [renderedSizes] = useState(() => createKeyedStore<object, number>());
    const [thresholdMotions] = useState(() =>
      createKeyedStore<
        object,
        { collapsed: boolean; fromSize: number; targetSize: number }
      >(),
    );
    const getPanelRenderedSize = useCallback(
      (token: object) => renderedSizes.get(token),
      [renderedSizes],
    );
    // R-37 responsive auto-collapse. `autoCollapsedStore` publishes the folded
    // set per panel token (consumed via `usePanelAutoCollapsed`). The override
    // latch (`autoOverrideRef`) holds tokens a user manually expanded — a
    // "stays-open" latch (owner OQ1): an explicit open holds at ANY narrower
    // width and clears only when space returns (W ≥ Tⱼ). `armAutoOverride`
    // sets it and re-runs allocation via `autoOverrideVersion`.
    const [autoCollapsedStore] = useState(() =>
      createKeyedStore<object, boolean>(),
    );
    const autoOverrideRef = useRef(new Set<object>());
    // Last committed fold set, so the pure rule can apply an asymmetric release
    // band (fold at Tⱼ, release at Tⱼ + band) and never flap on RO jitter.
    const prevAutoFoldRef = useRef<ReadonlySet<object>>(new Set());
    // The user action's attribution, captured at arm time so the allocation
    // pass that releases the fold reports it (not a system pass). R-37/F3.
    const pendingOverrideAttributionRef = useRef<PanelChangeDetails | null>(
      null,
    );
    const [autoOverrideVersion, setAutoOverrideVersion] = useState(0);
    const armAutoOverride = useCallback(
      (token: object, attribution: PanelChangeDetails) => {
        autoOverrideRef.current.add(token);
        pendingOverrideAttributionRef.current = attribution;
        setAutoOverrideVersion((v) => v + 1);
      },
      [],
    );
    // Nudged at pointer-session end so the (then-unfrozen) allocation pass
    // recomputes the fold set at the committed width (X5 authority rule).
    const [autoRecomputeTick, setAutoRecomputeTick] = useState(0);
    const nudgeAutoRecompute = useCallback(
      () => setAutoRecomputeTick((v) => v + 1),
      [],
    );

    const readRenderedSize = useCallback(
      (entry: ChildEntry, controls: InternalPanelControls): number => {
        return renderedSizes.get(entry.token) ?? controls.renderedSize;
      },
      [renderedSizes],
    );

    const activeResizeRef = useRef<ActiveResize | null>(null);
    // Group value machinery: controlled/default layouts, the canonical
    // current-layout reader, the change ledger, and the apply/reset/command
    // API (§2/§4/§10). Owns no effects — the publisher and controlled-commit
    // effects stay registered below at their original positions.
    const {
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
    } = useGroupValue({
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
    });
    const markLayoutSource = ledger.markLayoutSource;
    const markCanonicalChange = ledger.markCanonicalChange;
    const getChangeAttribution = ledger.getChangeAttribution;
    // Initial controlled/default/persisted panel state for the group context;
    // the persistence effects reseed it on identity resets and restores.
    const [snapshot, setSnapshot] = useState<PanelLayoutMap | null>(
      () => propSeedLayout?.panels ?? null,
    );

    // Pointer/keyboard resize transactions: boundary resolution, session
    // begin/move/end, and the live threshold-crossing decisions (§4,
    // R-03/R-09/R-19/R-22/R-25/R-33).
    const {
      resolveInteractiveBoundary,
      getHandleDiagnostic,
      resolvePointerResizeHandle,
      beginResize,
      moveResize,
      endResize,
    } = useResizeController({
      disabled,
      orientation,
      resolvedCascade,
      childOrderRef,
      groupElementRef,
      handleElements,
      handleIdsRef,
      handlePointerSessions,
      handleStates,
      panelControls,
      peerSizes,
      thresholdMotions,
      readRenderedSize,
      markGesturePeerSize,
      getCurrentLayout,
      ledger,
      callbacksRef,
      markPersistenceDirty,
      reopenPersistenceWriteGate,
      flushPersistenceRef,
      controlledLayoutRef,
      activeResizeRef,
      nudgeAutoRecompute,
    });

    // Imperative peer sizing: the seam-cascade setter, the collapsed
    // preference setter, and the automatic-pool reset (§10, R-20).
    const { resetAutomaticPeer, setPeerSize, setPeerPreferredSize } =
      usePeerCommands({
        childOrderRef,
        panelControls,
        peerSlots,
        peerSizes,
        explicitZeroPeersRef,
        markExplicitPeerSize,
        readRenderedSize,
      });
    // Handle snapshots (capacity model + ARIA ranges) and the handle-level
    // toggle/reset commands (R-09/R-18). Publishes via its own coalesced
    // layout effect, registered here — after the line observer, before
    // measurement — exactly where it always was.
    const { toggleHandlePanel, resetHandlePanel } = useHandleStates({
      disabled,
      childOrder,
      childOrderRef,
      groupElementRef,
      handleElements,
      handleIdsRef,
      handleStates,
      panelControls,
      peerSizes,
      peerSlots,
      renderedSizes,
      readRenderedSize,
      resolveInteractiveBoundary,
      markLayoutSource,
      resetAutomaticPeer,
    });

    useEffect(() => () => ledger.cancelScheduledControlledCommit(), [ledger]);

    groupCommandsRef.current = {
      getValue,
      setValue: (value) => runGroupCommand(() => setValue(value)),
      resetValue: () => runGroupCommand(resetLayout),
    };

    useImperativeHandle(
      groupApiRef,
      () => ({
        getValue,
        setValue,
        resetValue: resetLayout,
      }),
      [getValue, setValue, resetLayout],
    );

    // ─── container measurement ───────────────────────────────────────────────
    // Content-box main-axis measurement + the group-local isContainerResizing
    // window (R-13/R-31). Its layout effect registers here — its original
    // position, after handle-state publication, before allocation.
    const { containerMeasurement, isContainerResizing } =
      useContainerMeasurement({
        groupElementRef,
        orientation,
        childOrderRef,
        beginContainerResize: layout.beginContainerResize,
        endContainerResize: layout.endContainerResize,
        markLayoutSource,
      });
    const containerSize = containerMeasurement.size;

    const layoutTokens = useMemo(
      () => childOrder.map((entry) => entry.token),
      [childOrder],
    );

    // ─── auto-distribution / proportional rescale ────────────────────────────
    // The container allocation pass (never-squish floors, R-34), the R-37
    // responsive auto-collapse orchestration, and the published group-state
    // snapshot (R-36). Its layout effects register here — their original
    // position, after measurement, before the controlled-commit effect.
    const { overconstrainedPx, overconstrainedRef } = useGroupAllocation({
      groupId,
      registryToken,
      store: layout.store,
      childOrder,
      layoutTokens,
      groupElementRef,
      containerMeasurement,
      panelControls,
      peerSlots,
      peerSizes,
      renderedSizes,
      handleGutterSizes,
      reservedGutterSize,
      explicitZeroPeersRef,
      activeResizeRef,
      autoCollapsedStore,
      autoOverrideRef,
      prevAutoFoldRef,
      pendingOverrideAttributionRef,
      autoOverrideVersion,
      autoRecomputeTick,
      markLayoutSource,
      markCanonicalChange,
    });

    const lastControlledLayoutRef = useRef<PanelGroupLayout | null>(null);
    useLayoutEffect(() => {
      const nextControlledLayout =
        controlledLayout?.orientation === orientation
          ? controlledLayout
          : undefined;
      if (!nextControlledLayout || childOrder.length === 0) return;
      if (
        panelGroupLayoutsEqual(
          lastControlledLayoutRef.current,
          nextControlledLayout,
        )
      ) {
        return;
      }
      lastControlledLayoutRef.current = nextControlledLayout;
      ledger.commitControlledLayout(nextControlledLayout);
    }, [childOrder.length, controlledLayout, ledger, orientation]);

    useEffect(() => {
      const frame = requestAnimationFrame(() => {
        ledger.initializePublisher(getCurrentLayout());
      });
      return () => cancelAnimationFrame(frame);
    }, [getCurrentLayout, ledger]);
    useEffect(() => {
      // Child membership changes the published value when identified panels
      // enter or leave. Pure reorders keep the value identical and stay
      // silent — React children own visual order (§2).
      void childOrder;
      ledger.reconcileChildren(getCurrentLayout());
      const unsubs = [
        panelControls.subscribeAny(ledger.notifyStoreCommit),
        peerSizes.subscribeAny(ledger.notifyStoreCommit),
      ];
      return () => {
        for (const unsubscribe of unsubs) unsubscribe();
        // R-30: a pass scheduled by a notification during THIS effect
        // instance's window must not drain after it. During full teardown
        // the children unregister first (child cleanups run before the
        // parent's) — without the cancel their store notification's queued
        // microtask would observe the emptied registry and emit `{}` with
        // the fallback set-value/api attribution. On an ordinary re-run
        // the replacing instance re-reports membership deltas from live
        // state via reconcileChildren above, and later store commits
        // schedule fresh passes — so cancelling here never drops a change.
        ledger.cancelScheduledPublish();
      };
    }, [childOrder, getCurrentLayout, ledger, panelControls, peerSizes]);

    // Persistence lifecycle effects (identity reset, restore read, debounced
    // write-back). Registered here — after allocation and the publisher —
    // exactly where these effects always were.
    useGroupPersistenceEffects({
      state: persistenceState,
      callbacksRef,
      childOrderLength: childOrder.length,
      propSeedLayout,
      setSnapshot,
      setSkipAnimation,
      applyLayout,
      getCurrentLayout,
      controlledLayoutRef,
      panelControls,
      peerSizes,
      layoutTokens,
    });

    // The stores and callbacks here are all stable; the context value only
    // changes with direction/containerSize/isContainerResizing — peer drags
    // notify through the stores instead of churning this object.
    const hasControlledValue = Boolean(controlledValue);
    // biome-ignore lint/correctness/useExhaustiveDependencies: composition-root refs are stable for the group's lifetime; reading .current at call time (not render time) is the design.
    const value = useMemo(
      () => ({
        registryToken,
        orientation,
        disabled,
        hasControlledValue,
        cursorBehavior,
        animation: resolvedAnimation,
        getTextDirection,
        snapshot,
        registerChild,
        listChildren,
        registerPeer,
        getPanelRenderedSize,
        markLayoutSource,
        getChangeAttribution,
        setPeerSize,
        setPeerPreferredSize,
        canPeerCompensateFromZero,
        registerHandle,
        beginResize,
        resolvePointerResizeHandle,
        moveResize,
        endResize,
        handleStates,
        handlePointerSessions,
        handleInteractions,
        handleLineVisibility,
        toggleHandlePanel,
        resetHandlePanel,
        resetAutomaticPeer,
        getHandleDiagnostic,
        panelControls,
        peerSizes,
        renderedSizes,
        thresholdMotions,
        autoCollapsed: autoCollapsedStore,
        armAutoOverride,
        containerSize,
        isContainerResizing,
        // Call-time read; the ref keeps resizes from churning this memo.
        isOverconstrained: () => overconstrainedRef.current > SIZE_EPSILON,
      }),
      [
        registryToken,
        orientation,
        disabled,
        hasControlledValue,
        cursorBehavior,
        resolvedAnimation,
        getTextDirection,
        snapshot,
        registerChild,
        listChildren,
        registerPeer,
        getPanelRenderedSize,
        markLayoutSource,
        getChangeAttribution,
        setPeerSize,
        setPeerPreferredSize,
        canPeerCompensateFromZero,
        registerHandle,
        beginResize,
        resolvePointerResizeHandle,
        moveResize,
        endResize,
        handleStates,
        handlePointerSessions,
        handleInteractions,
        handleLineVisibility,
        toggleHandlePanel,
        resetHandlePanel,
        resetAutomaticPeer,
        getHandleDiagnostic,
        panelControls,
        peerSizes,
        renderedSizes,
        thresholdMotions,
        autoCollapsedStore,
        armAutoOverride,
        containerSize,
        isContainerResizing,
      ],
    );

    const setGroupElementRef = useMemo(
      () => composeRefs<HTMLDivElement>(groupElementRef, elementRef),
      [elementRef],
    );

    return (
      <PanelGroupContext.Provider value={value}>
        <div
          {...elementProps}
          ref={setGroupElementRef}
          dir={dir}
          data-resizable-panels-panel-group=""
          data-orientation={orientation}
          data-disabled={disabled ? "" : undefined}
          data-overconstrained={
            overconstrainedPx > SIZE_EPSILON ? "" : undefined
          }
          className={className}
          style={{
            display: "flex",
            flexDirection: orientation === "horizontal" ? "row" : "column",
            width: "100%",
            height: "100%",
            overflow: "hidden",
            ...style,
          }}
        >
          {children}
        </div>
      </PanelGroupContext.Provider>
    );
  },
);

/** Skip a slot re-register when the peer's resolved bounds are unchanged
 *  (e.g. an effect re-ran without unmount). */
function slotsEqual(a: PeerSlot, b: PeerSlot): boolean {
  return (
    a.defaultSize === b.defaultSize &&
    a.defaultIsExplicit === b.defaultIsExplicit &&
    a.boundsReady === b.boundsReady &&
    a.minPx === b.minPx &&
    a.maxPx === b.maxPx &&
    a.defaultPx === b.defaultPx
  );
}
