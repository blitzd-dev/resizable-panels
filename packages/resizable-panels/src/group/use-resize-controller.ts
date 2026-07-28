"use client";

import { useCallback } from "react";
import { type BoundaryPanel, resizeBoundary } from "../core/boundary-resize.js";
import type { ChangeLedger } from "../core/change-ledger.js";
import type { KeyedStore } from "../core/keyed-store.js";
import {
  createPanelGroupLayout,
  getPanelLayoutState,
  panelLayoutMapFromEntries,
} from "../core/layout-state.js";
import {
  clamp,
  mapsAlmostEqual,
  SIZE_EPSILON,
  sizesDiffer,
} from "../core/size.js";
import { CASCADE_LATCH_DEAD_BAND_PX } from "../core/timing.js";
import { readAxisScale } from "../shared/axis-scale.js";
import { IS_DEVELOPMENT } from "../shared/diagnostics.js";
import type {
  InternalPanelControls,
  PanelConfig,
  PanelGroupCascade,
  PanelGroupLayout,
  PanelGroupOrientation,
  PanelLayoutState,
  PanelResizeEndEvent,
  PanelResizeStartEvent,
  PanelValueChangeTrigger,
} from "../types.js";
import type {
  ActiveResize,
  ChildEntry,
  HandlePointerSessionState,
  PanelResizeHandleState,
  PanelResizeSession,
} from "./group-context.js";

/**
 * Lowest size a resize interaction may take a panel to — the `minSize` fed
 * to `resizeBoundary`'s cascade math, clamped to ≥ 0. With an armed
 * `collapseBelow` threshold the pointer may travel below `minSize` (down to
 * the smallest configured floor) so the live threshold logic in `moveResize`
 * can decide collapse/reopen from the raw pointer position. Without one, a
 * collapsed panel is bounded by its rail size and an expanded panel by
 * `minSize`.
 *
 * One formula, shared by `beginResize` (session bounds) and
 * `deriveHandleStates` (capacity model): if these disagreed, drag ranges and
 * announced ARIA ranges would silently drift apart (R-09).
 */
export function resizeCollapseFloor(
  config: PanelConfig,
  collapsed: boolean,
): number {
  const floor =
    config.collapsible && config.collapseBelow !== undefined
      ? Math.min(config.minSize, config.collapsedSize, config.collapseBelow)
      : collapsed
        ? config.collapsedSize
        : config.minSize;
  return Math.max(0, floor);
}

/**
 * The group's resize transaction controller: structural/interactive
 * boundary resolution, coincident-handle ownership, and the pointer/
 * keyboard session lifecycle (begin/move/end) with its live
 * collapse-threshold decisions. Pure callbacks over the composition root's
 * stores and refs — no effects.
 */
export function useResizeController({
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
}: {
  disabled: boolean;
  orientation: PanelGroupOrientation;
  resolvedCascade: PanelGroupCascade;
  childOrderRef: { readonly current: ChildEntry[] };
  groupElementRef: { readonly current: HTMLDivElement | null };
  handleElements: KeyedStore<object, () => HTMLElement | null>;
  handleIdsRef: { readonly current: Map<object, string> };
  handlePointerSessions: KeyedStore<object, HandlePointerSessionState>;
  handleStates: KeyedStore<object, PanelResizeHandleState | null>;
  panelControls: KeyedStore<object, InternalPanelControls>;
  peerSizes: KeyedStore<object, number>;
  thresholdMotions: KeyedStore<
    object,
    { collapsed: boolean; fromSize: number; targetSize: number }
  >;
  readRenderedSize: (
    entry: ChildEntry,
    controls: InternalPanelControls,
  ) => number;
  markGesturePeerSize: (token: object, size: number) => void;
  getCurrentLayout: () => PanelGroupLayout;
  ledger: ChangeLedger;
  callbacksRef: {
    readonly current: {
      onResizeStart?: (event: PanelResizeStartEvent) => void;
      onResizeEnd?: (event: PanelResizeEndEvent) => void;
    };
  };
  markPersistenceDirty: (trigger: PanelValueChangeTrigger) => void;
  reopenPersistenceWriteGate: () => void;
  flushPersistenceRef: {
    readonly current: (layout?: PanelGroupLayout) => void;
  };
  controlledLayoutRef: { readonly current: PanelGroupLayout | undefined };
  activeResizeRef: { current: ActiveResize | null };
  nudgeAutoRecompute: () => void;
}) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: composition-root refs are stable for the group's lifetime; reading .current at call time (not render time) is the design.
  const resolveBoundary = useCallback(
    (handleToken: object) => {
      const handleElement = handleElements.get(handleToken)?.();
      if (!handleElement) return null;
      const slot = handleElement.parentElement;
      if (
        !slot?.hasAttribute("data-resizable-panels-resize-handle-slot") ||
        slot.parentElement !== groupElementRef.current
      ) {
        return null;
      }
      // childOrder is normalized after every children commit. Avoid a DOM
      // sort for every handle snapshot in the same publication pass.
      const children = childOrderRef.current;
      const beforeIndex = children.findIndex(
        (child) => child.getElement() === slot.previousElementSibling,
      );
      const afterIndex = children.findIndex(
        (child) => child.getElement() === slot.nextElementSibling,
      );
      if (beforeIndex < 0 || afterIndex !== beforeIndex + 1) return null;
      return { boundaryIndex: afterIndex, children };
    },
    [handleElements],
  );

  /** Resolve the interaction boundary represented by a handle. A run of
   * zero-sized collapsed panels is transparent to resizing: the first
   * handle at that coincident seam controls the nearest visible panels,
   * while the remaining coincident handles stay disabled. This preserves a
   * usable boundary for visible neighbors without allowing a drag to reopen
   * one of the collapsed panels. */
  const resolveInteractiveBoundary = useCallback(
    (handleToken: object) => {
      const structural = resolveBoundary(handleToken);
      if (!structural) return null;

      const { children } = structural;
      const immediateBefore = children[structural.boundaryIndex - 1];
      const immediateAfter = children[structural.boundaryIndex];
      const beforeControls = panelControls.get(immediateBefore.token);
      const afterControls = panelControls.get(immediateAfter.token);
      if (!beforeControls || !afterControls) return null;

      const isZeroCollapsed = (entry: ChildEntry) => {
        const controls = panelControls.get(entry.token);
        return Boolean(
          controls?.collapsed && controls.config.collapsedSize <= SIZE_EPSILON,
        );
      };
      const canResizeCollapsed = (controls: InternalPanelControls) =>
        !controls.collapsed ||
        (controls.config.resizableWhenCollapsed &&
          controls.config.collapsedSize > SIZE_EPSILON);

      let visibleBeforeIndex = structural.boundaryIndex - 1;
      while (
        visibleBeforeIndex >= 0 &&
        isZeroCollapsed(children[visibleBeforeIndex])
      ) {
        visibleBeforeIndex--;
      }
      let visibleAfterIndex = structural.boundaryIndex;
      while (
        visibleAfterIndex < children.length &&
        isZeroCollapsed(children[visibleAfterIndex])
      ) {
        visibleAfterIndex++;
      }

      const skippedCollapsed =
        visibleBeforeIndex !== structural.boundaryIndex - 1 ||
        visibleAfterIndex !== structural.boundaryIndex;
      if (
        !skippedCollapsed ||
        visibleBeforeIndex < 0 ||
        visibleAfterIndex >= children.length
      ) {
        const canResize =
          canResizeCollapsed(beforeControls) &&
          canResizeCollapsed(afterControls);
        const beforeZeroCollapsed = isZeroCollapsed(immediateBefore);
        const afterZeroCollapsed = isZeroCollapsed(immediateAfter);
        // R-18: when this boundary cannot drag ONLY because exactly one
        // adjacent panel is a zero-collapsed collapsible (a run reaching a
        // group edge — there is no visible pair to hand the seam to), the
        // handle stays reachable: Enter expands that panel. The condition
        // is deterministic for a multi-panel run: only the handle whose
        // other side is a resizable visible panel qualifies; handles
        // buried between two zero-collapsed panels stay fully disabled.
        const toggleTarget =
          !canResize &&
          beforeZeroCollapsed !== afterZeroCollapsed &&
          canResizeCollapsed(
            beforeZeroCollapsed ? afterControls : beforeControls,
          )
            ? beforeZeroCollapsed
              ? immediateBefore
              : immediateAfter
            : null;
        return {
          ...structural,
          before: immediateBefore,
          after: immediateAfter,
          immediateBefore,
          immediateAfter,
          adjacentCollapsed:
            beforeControls.collapsed || afterControls.collapsed,
          canResize,
          toggleTarget,
        };
      }

      const before = children[visibleBeforeIndex];
      const after = children[visibleAfterIndex];
      const interactiveChildren = children.filter(
        (entry) => !isZeroCollapsed(entry),
      );
      const boundaryIndex =
        interactiveChildren.findIndex((entry) => entry.token === before.token) +
        1;
      const currentSlot =
        handleElements.get(handleToken)?.()?.parentElement ?? null;
      const afterElement = after.getElement();
      let ownerSlot: Element | null = null;
      for (
        let sibling = before.getElement()?.nextElementSibling ?? null;
        sibling && sibling !== afterElement;
        sibling = sibling.nextElementSibling
      ) {
        if (sibling.hasAttribute("data-resizable-panels-resize-handle-slot")) {
          ownerSlot = sibling;
          break;
        }
      }

      return {
        children: interactiveChildren,
        boundaryIndex,
        before,
        after,
        immediateBefore,
        immediateAfter,
        adjacentCollapsed: true,
        // All handles surrounding a zero-sized run occupy the same visual
        // seam. The first rendered handle after the visible "before" panel
        // owns interaction so a single keyboard/pointer target remains,
        // even when consumers omit one of the optional handles.
        canResize: currentSlot !== null && currentSlot === ownerSlot,
        // An interior zero-collapsed run keeps a live seam between its
        // visible neighbors (the owner handle above); non-owner handles
        // at that seam stay fully disabled rather than becoming Enter
        // targets (R-18 covers only seams with no visible pair left).
        toggleTarget: null,
      };
    },
    [handleElements, panelControls, resolveBoundary],
  );

  const getHandleDiagnostic = useCallback(
    (handleToken: object): string | null => {
      if (!IS_DEVELOPMENT) return null;
      if (resolveBoundary(handleToken)) return null;
      return "<PanelResizeHandle> must be a direct DOM sibling between two adjacent <Panel> components in the same <PanelGroup>. React fragments are supported, but wrapper elements and consecutive handles are not.";
    },
    [resolveBoundary],
  );

  /** Coincident expanded-zero handles share one visual seam. Once pointer
   * movement reveals intent, prefer the boundary whose growing side is a
   * peer (the layout model's main-content region), then prefer an expanded
   * zero-sized panel. The returned token is fixed for the ensuing session. */
  const resolvePointerResizeHandle = useCallback(
    (handleToken: object, deltaPx: number): object => {
      const state = handleStates.get(handleToken);
      if (
        !state ||
        state.pointerHitArea === "full" ||
        state.pointerHitArea === "none" ||
        Math.abs(deltaPx) <= SIZE_EPSILON
      ) {
        return handleToken;
      }

      const sourceSlot =
        handleElements.get(handleToken)?.()?.parentElement ?? null;
      if (!sourceSlot) return handleToken;
      const sourceRect = sourceSlot.getBoundingClientRect();
      const sourceCoordinate =
        orientation === "horizontal" ? sourceRect.left : sourceRect.top;

      let selectedToken = handleToken;
      let selectedScore = Number.NEGATIVE_INFINITY;
      for (const [candidateToken, getElement] of handleElements.getMap()) {
        const candidateState = handleStates.get(candidateToken);
        if (
          !candidateState ||
          candidateState.pointerHitArea === "full" ||
          candidateState.pointerHitArea === "none"
        ) {
          continue;
        }
        const slot = getElement()?.parentElement;
        if (!slot) continue;
        const rect = slot.getBoundingClientRect();
        const coordinate = orientation === "horizontal" ? rect.left : rect.top;
        if (Math.abs(coordinate - sourceCoordinate) > 0.5) continue;

        const boundary = resolveInteractiveBoundary(candidateToken);
        if (!boundary?.canResize) continue;
        const growingEntry =
          deltaPx < 0
            ? boundary.children[boundary.boundaryIndex]
            : boundary.children[boundary.boundaryIndex - 1];
        const controls = growingEntry
          ? panelControls.get(growingEntry.token)
          : undefined;
        if (!growingEntry || !controls) continue;
        const rendered = readRenderedSize(growingEntry, controls);
        const expandedZero = !controls.collapsed && rendered <= SIZE_EPSILON;
        const score =
          (growingEntry.kind === "peer" ? 100 : 0) +
          (expandedZero ? 10 : 0) +
          // Preserve the pointer-down side as the stable final tie-breaker.
          (candidateToken === handleToken ? 1 : 0);
        if (score > selectedScore) {
          selectedScore = score;
          selectedToken = candidateToken;
        }
      }
      return selectedToken;
    },
    [
      handleElements,
      handleStates,
      orientation,
      panelControls,
      readRenderedSize,
      resolveInteractiveBoundary,
    ],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: composition-root refs are stable for the group's lifetime; reading .current at call time (not render time) is the design.
  const getResizeProposal = useCallback(
    (
      session: PanelResizeSession,
      committedLayout: PanelGroupLayout,
    ): PanelGroupLayout => {
      const panels = new Map<string, PanelLayoutState>(
        Object.entries(committedLayout.panels).map(([id, state]) => [
          id,
          { ...state },
        ]),
      );
      for (const [token, finalSize] of session.lastSizes) {
        const entry = session.entries.get(token);
        const key = entry?.panelId;
        if (
          !entry ||
          !key ||
          childOrderRef.current.find((candidate) => candidate.panelId === key)
            ?.token !== token
        )
          continue;
        const controls = panelControls.get(token);
        if (!controls) continue;
        const presentedCollapsed =
          session.interactionCollapsed.get(token) ?? controls.collapsed;
        // The size branch follows the PRESENTED state — it decides what
        // `finalSize` means (a collapsed rail's preserved preference vs a
        // live expanded size). The reported collapsed bit pins to the
        // effective state (R-33): a controlled panel's bit belongs to its
        // prop even inside a controlled-group proposal.
        panels.set(key, {
          size: presentedCollapsed
            ? (session.preferredSizes.get(token) ??
              getPanelLayoutState(committedLayout.panels, key)?.size ??
              controls.size)
            : clamp(
                finalSize,
                controls.config.minSize,
                controls.config.maxSize,
              ),
          ...(controls.config.collapsible
            ? {
                collapsed: controls.controlledCollapsed ?? presentedCollapsed,
              }
            : {}),
        });
      }
      return createPanelGroupLayout(
        orientation,
        committedLayout.order,
        panelLayoutMapFromEntries(panels),
      );
    },
    [orientation, panelControls],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: composition-root refs are stable for the group's lifetime; reading .current at call time (not render time) is the design.
  const beginResize = useCallback(
    (
      handleToken: object,
      trigger: Extract<PanelValueChangeTrigger, "pointer" | "keyboard">,
      owner: object,
    ): PanelResizeSession | null => {
      if (disabled || activeResizeRef.current) return null;
      const boundary = resolveInteractiveBoundary(handleToken);
      if (!boundary?.canResize) return null;
      const { before, after } = boundary;
      const beforeControls = panelControls.get(before.token);
      const afterControls = panelControls.get(after.token);
      if (!beforeControls || !afterControls) {
        return null;
      }
      const panels: BoundaryPanel<object>[] = [];
      const entries = new Map<object, ChildEntry>();
      const fromSizes = new Map<object, number>();
      const preferredSizes = new Map<object, number>();
      const initiallyCollapsed = new Set<object>();
      const interactionCollapsed = new Map<object, boolean>();
      // Rects below are visual px; the session's math (min/max clamps,
      // deltas, the allocation model) is layout px. One divisor for the
      // whole gesture — an ancestor transform cannot change mid-drag
      // without ending the session's geometry anyway.
      const axisScale = readAxisScale(groupElementRef.current, orientation);

      for (const entry of boundary.children) {
        const controls = panelControls.get(entry.token);
        if (!controls) return null;
        const element = entry.getElement();
        const rect = element?.getBoundingClientRect();
        const measured = rect
          ? (orientation === "horizontal" ? rect.width : rect.height) /
            axisScale
          : 0;
        const rendered = measured || readRenderedSize(entry, controls);
        // Session start is side-effect-free for preferences (§4: a no-move
        // pointer session emits nothing — pointer handles call this only
        // once the first move crosses the drag threshold, R-03). Never sync
        // preferred ← rendered here: in an over-constrained layout that
        // would silently destroy the user's preferred size and emit a
        // spurious value change (R-02). Drag math never needs the sync —
        // deltas apply to `fromSizes` (captured rendered geometry) and
        // `moveResize` rebases docked preferences per tick as movement
        // continues. Capturing `preferredSizes` untouched also lets a
        // mid-drag collapse→expand restore the genuine pre-drag preference.
        fromSizes.set(entry.token, rendered);
        entries.set(entry.token, entry);
        preferredSizes.set(entry.token, controls.size);
        if (controls.collapsed) initiallyCollapsed.add(entry.token);
        interactionCollapsed.set(entry.token, controls.collapsed);
        panels.push({
          token: entry.token,
          minSize: resizeCollapseFloor(controls.config, controls.collapsed),
          maxSize: controls.config.maxSize,
          disabled: controls.config.disabled,
          pinned:
            controls.config.pinned ||
            (controls.collapsed && !controls.config.resizableWhenCollapsed),
        });
      }

      const session: PanelResizeSession = {
        owner,
        boundaryIndex: boundary.boundaryIndex,
        panels,
        entries,
        fromSizes,
        preferredSizes,
        initiallyCollapsed,
        interactionCollapsed,
        lastSizes: new Map(fromSizes),
        axisScale,
        moved: false,
        // Latching applies to pointer transactions only (R-25): keyboard
        // sessions are atomic single deltas (§4) that cannot reverse
        // mid-session, so they stay on the snapshot math in both modes.
        latch:
          trigger === "pointer" && resolvedCascade === "latching"
            ? { baseDelta: 0, extremeRaw: 0, extremeApplied: 0, direction: 0 }
            : undefined,
      };
      const handleId = handleIdsRef.current.get(handleToken);
      markPersistenceDirty(trigger);
      const current = getCurrentLayout();
      activeResizeRef.current = {
        session,
        handleToken,
        handleId,
        trigger,
        initialLayout: current,
      };
      // The transaction baseline: the first emitted change chains its
      // previousValue from here rather than from an older emitted event.
      ledger.setEventBaseline(current);
      // Resize lifecycle exists only for pointer transactions; keyboard
      // actions are atomic value changes with no lifecycle (§4).
      if (trigger === "pointer") {
        try {
          callbacksRef.current.onResizeStart?.({
            handleId,
            value: current.panels,
          });
        } catch (error) {
          if (activeResizeRef.current?.session === session) {
            activeResizeRef.current = null;
          }
          throw error;
        }
        // Publish session ownership for presentation (R-22) only once the
        // session survived onResizeStart — a thrown start never owned the
        // seam. Keyboard sessions are atomic (begin/move/end in one task)
        // and stay unpublished so they can neither flash a highlight nor
        // wedge a stale owner.
        handlePointerSessions.set(handleToken, { limited: false });
      }
      return session;
    },
    [
      disabled,
      getCurrentLayout,
      handlePointerSessions,
      ledger,
      markPersistenceDirty,
      orientation,
      panelControls,
      readRenderedSize,
      resolvedCascade,
      resolveInteractiveBoundary,
    ],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: composition-root refs are stable for the group's lifetime; reading .current at call time (not render time) is the design.
  const moveResize = useCallback(
    (session: PanelResizeSession, deltaPx: number): boolean => {
      const active = activeResizeRef.current;
      if (active?.session !== session) return true;
      session.moved = true;
      const runBoundary = (delta: number) =>
        resizeBoundary({
          panels: session.panels,
          boundaryIndex: session.boundaryIndex,
          delta,
          fromSizes: session.fromSizes,
        });
      // `cascade="latching"` (R-25): make cascade pushes one-way within
      // the held drag by rebasing the session origin at directional
      // extremes. `deltaPx` is already RTL-negated by the handle, so the
      // latch works in the same logical delta space in both directions.
      const latch = session.latch;
      let effectiveDelta = deltaPx;
      if (latch) {
        effectiveDelta = deltaPx - latch.baseDelta;
        if (latch.direction !== 0) {
          const retreat =
            latch.direction > 0
              ? latch.extremeRaw - effectiveDelta
              : effectiveDelta - latch.extremeRaw;
          if (retreat > CASCADE_LATCH_DEAD_BAND_PX) {
            // A genuine reversal (jitter inside the dead-band keeps the
            // current origin and unwinds reversibly): rebase `fromSizes`
            // to the raw cascade sizes at the APPLIED extreme — not at
            // the dead-band crossing, so no space is lost to the band,
            // and not at the raw pointer extreme, so overshoot past
            // capacity never shifts the origin. From the rebased origin
            // the standard capacity order grows the boundary-adjacent
            // panel first — which is the latch. `preferredSizes`,
            // `initiallyCollapsed`, and the transaction baseline stay
            // untouched: the rebase is invisible to events, persistence,
            // and the collapse-restore basis.
            session.fromSizes = runBoundary(latch.extremeApplied).sizes;
            latch.baseDelta += latch.extremeApplied;
            latch.direction = latch.direction > 0 ? -1 : 1;
            effectiveDelta = deltaPx - latch.baseDelta;
            latch.extremeRaw = effectiveDelta;
            latch.extremeApplied = 0;
          }
        }
      }
      const result = runBoundary(effectiveDelta);
      if (latch) {
        // Track the epoch's directional extreme (>= so the tick that
        // establishes a new extreme — including the rebase tick itself —
        // records the applied delta the next rebase will anchor to).
        if (latch.direction === 0) {
          if (effectiveDelta !== 0) {
            latch.direction = effectiveDelta > 0 ? 1 : -1;
            latch.extremeRaw = effectiveDelta;
            latch.extremeApplied = result.appliedDelta;
          }
        } else if (
          latch.direction > 0
            ? effectiveDelta >= latch.extremeRaw
            : effectiveDelta <= latch.extremeRaw
        ) {
          latch.extremeRaw = effectiveDelta;
          latch.extremeApplied = result.appliedDelta;
        }
      }
      const nextPeers = new Map(peerSizes.getMap());

      const snapToCollapsedSize = (
        panelIndex: number,
        token: object,
        collapsedSize: number,
      ) => {
        const rawSize = result.sizes.get(token);
        if (rawSize === undefined) return;
        const released = Math.max(0, rawSize - collapsedSize);
        result.sizes.set(token, collapsedSize);
        if (released <= SIZE_EPSILON) return;

        // resizeBoundary describes the raw pointer position. Crossing a
        // collapse threshold then snaps one semantic panel from that raw
        // size to collapsedSize, so transfer the newly released space to
        // the opposite side using the same outward cascade order. Without
        // this reconciliation the sibling allocation remains short by the
        // raw-to-collapsed delta after the presentation motion has ended.
        const growsTowardEnd = panelIndex < session.boundaryIndex;
        const directIndex = growsTowardEnd
          ? session.boundaryIndex
          : session.boundaryIndex - 1;
        const step = growsTowardEnd ? 1 : -1;
        let remaining = released;
        for (
          let index = directIndex;
          index >= 0 && index < session.panels.length && remaining > 0;
          index += step
        ) {
          const candidate = session.panels[index];
          if (candidate.disabled) break;
          if (candidate.pinned && index !== directIndex) continue;
          if (session.interactionCollapsed.get(candidate.token)) continue;
          const current = result.sizes.get(candidate.token) ?? 0;
          const applied = Math.min(
            remaining,
            Math.max(0, candidate.maxSize - current),
          );
          if (applied <= 0) continue;
          result.sizes.set(candidate.token, current + applied);
          remaining -= applied;
        }
      };

      for (
        let panelIndex = 0;
        panelIndex < session.panels.length;
        panelIndex++
      ) {
        const panel = session.panels[panelIndex];
        const nextSize = result.sizes.get(panel.token);
        if (nextSize === undefined) continue;
        const controls = panelControls.get(panel.token);
        if (!controls) continue;
        const collapseBelow = controls.config.collapseBelow;
        const startedCollapsed = session.initiallyCollapsed.has(panel.token);
        const interactionCollapsed =
          session.interactionCollapsed.get(panel.token) ?? controls.collapsed;
        const closeBoundary =
          collapseBelow === undefined
            ? undefined
            : startedCollapsed
              ? Math.max(
                  controls.config.collapsedSize,
                  collapseBelow - controls.config.collapseBelowHysteresis,
                )
              : collapseBelow;
        if (
          controls.config.collapsible &&
          closeBoundary !== undefined &&
          nextSize <= closeBoundary + SIZE_EPSILON &&
          !interactionCollapsed
        ) {
          session.interactionCollapsed.set(panel.token, true);
          snapToCollapsedSize(
            panelIndex,
            panel.token,
            controls.config.collapsedSize,
          );
          // Crossing the threshold is live, not a release-time decision.
          // Preserve the pre-drag preferred size so expanding restores a
          // usable panel instead of the transient below-minimum drag size.
          const preferred = session.preferredSizes.get(panel.token);
          if (preferred !== undefined) {
            controls.setSize(
              clamp(
                preferred,
                controls.config.minSize,
                controls.config.maxSize,
              ),
            );
          }
          // `applyCollapsedState` is the raw local commit — identical to
          // `setCollapsed` for uncontrolled panels, and the PRESENTATION
          // channel for controlled ones (R-33): the gesture plays the
          // threshold motion live while the crossing emits a proposal the
          // parent may still decline (endResize re-commits the prop).
          if (controls.config.collapseBelowBehavior === "instant") {
            controls.applyCollapsedState(true, { transition: "none" });
          } else {
            thresholdMotions.set(panel.token, {
              collapsed: true,
              fromSize: readLiveSessionSize(
                session,
                panel.token,
                controls.renderedSize,
                orientation,
              ),
              targetSize: controls.config.collapsedSize,
            });
            controls.applyCollapsedState(true);
          }
          controls.notifyCollapsedProposal(true);
          continue;
        }
        const reopenBoundary =
          collapseBelow === undefined
            ? controls.config.collapsedSize
            : Math.min(
                controls.config.maxSize,
                startedCollapsed
                  ? controls.config.minSize
                  : Math.max(
                      controls.config.minSize,
                      collapseBelow + controls.config.collapseBelowHysteresis,
                    ),
              );
        if (
          interactionCollapsed &&
          (collapseBelow === undefined
            ? nextSize <= reopenBoundary + SIZE_EPSILON
            : nextSize < reopenBoundary - SIZE_EPSILON)
        ) {
          snapToCollapsedSize(
            panelIndex,
            panel.token,
            controls.config.collapsedSize,
          );
          continue;
        }
        if (interactionCollapsed) {
          session.interactionCollapsed.set(panel.token, false);
          if (
            collapseBelow !== undefined &&
            controls.config.collapseBelowBehavior === "animated"
          ) {
            thresholdMotions.set(panel.token, {
              collapsed: false,
              fromSize: readLiveSessionSize(
                session,
                panel.token,
                controls.renderedSize,
                orientation,
              ),
              targetSize: clamp(
                nextSize,
                controls.config.minSize,
                controls.config.maxSize,
              ),
            });
          }
          // Presentation channel + reopen proposal (R-33); identical to
          // setCollapsed for uncontrolled panels.
          controls.applyCollapsedState(false);
          controls.notifyCollapsedProposal(false);
        }
      }
      session.lastSizes = result.sizes;
      for (const panel of session.panels) {
        const controls = panelControls.get(panel.token);
        const nextSize = result.sizes.get(panel.token);
        if (!controls || nextSize === undefined) continue;
        if (session.interactionCollapsed.get(panel.token)) continue;
        if (controls.config.kind === "peer") {
          markGesturePeerSize(panel.token, nextSize);
          nextPeers.set(
            panel.token,
            clamp(nextSize, controls.config.minSize, controls.config.maxSize),
          );
        } else if (sizesDiffer(controls.size, nextSize)) {
          controls.setSize(nextSize);
        }
      }
      if (!mapsAlmostEqual(peerSizes.getMap(), nextPeers)) {
        peerSizes.replaceAll(nextPeers);
      }
      const controlled = controlledLayoutRef.current;
      if (controlled) {
        ledger.recordControlledProposal(getResizeProposal(session, controlled));
      }
      // Surface the range-limit result on the OWNING handle (R-22): at a
      // coincident seam the pressed handle relays moves for a session it
      // does not own, so `data-limited` must route through the published
      // session, not the caller's local state. The store's equality gate
      // makes unchanged ticks free.
      if (active.trigger === "pointer") {
        handlePointerSessions.set(active.handleToken, {
          limited: result.limited,
        });
      }
      return result.limited;
    },
    [
      getResizeProposal,
      handlePointerSessions,
      ledger,
      markGesturePeerSize,
      orientation,
      panelControls,
      peerSizes,
      thresholdMotions,
    ],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: composition-root refs are stable for the group's lifetime; reading .current at call time (not render time) is the design.
  const endResize = useCallback(
    (session: PanelResizeSession, canceled = false) => {
      const active = activeResizeRef.current;
      if (!active || active.session !== session) return;
      // Clear published ownership the moment the interaction ends (R-22):
      // release, cancel, lost capture, blur, and unmount all funnel
      // through here exactly once (`useResizeSession.finish` guards
      // re-entry), and the ref guard above blocks a second clear for a
      // stale session. Synchronous — the highlight must drop with the
      // release, not with the end-of-transaction microtask below. A
      // keyboard session never published, so the delete is a no-op.
      handlePointerSessions.delete(active.handleToken);
      if (session.moved) {
        for (const panel of session.panels) {
          const controls = panelControls.get(panel.token);
          if (!controls) continue;
          const finalSize = session.lastSizes.get(panel.token);
          if (finalSize === undefined) continue;
          const interactionCollapsed =
            session.interactionCollapsed.get(panel.token) ?? controls.collapsed;
          // Controlled collapsed (R-33): the session presented freely; the
          // PROP decides the committed state. Re-committing it here is
          // both halves of the contract at once — the declined-proposal
          // snap-back (prop unchanged since the crossing proposal) and
          // the acceptance echo (prop already flipped; the re-commit is a
          // no-op against the synced local state). The analog of the
          // group's controlled re-commit in this method's finally block.
          if (controls.controlledCollapsed !== undefined) {
            controls.applyCollapsedState(controls.controlledCollapsed);
            // The min-size floor below repairs sub-minimum EXPANDED
            // geometry. Apply it only when the presentation agrees with
            // the prop: a snapped-back crossing keeps the preserved
            // pre-drag preference instead (its finalSize is the collapsed
            // rail, not a real expanded size).
            if (
              !controls.controlledCollapsed &&
              !interactionCollapsed &&
              finalSize < controls.config.minSize
            ) {
              controls.setSize(controls.config.minSize);
            }
            continue;
          }
          // `finish()` flushes the last coalesced pointer move before this
          // method runs, so the session state has already applied the exact
          // hysteresis boundary. Recomputing against collapseBelow here
          // would undo that decision on pointer-up.
          if (interactionCollapsed) {
            controls.setCollapsed(true);
            continue;
          }
          controls.setCollapsed(false);
          if (finalSize < controls.config.minSize) {
            controls.setSize(controls.config.minSize);
          }
        }
      }
      queueMicrotask(() => {
        if (activeResizeRef.current?.session !== session) return;
        try {
          const controlled = controlledLayoutRef.current;
          const proposal = controlled
            ? getResizeProposal(session, controlled)
            : getCurrentLayout();
          // Causal ordering (§4 / R-04): the transaction's final value must
          // be EMITTED before the end event reports it — and before the
          // finally block's controlled re-commit reopens the echo
          // suppression window. The publisher's final pass can lose this
          // race (under jank it lands inside a still-open window from the
          // parent's previous acceptance; in the docked shape its microtask
          // queues after this one), so the end path emits the settled value
          // itself. The ledger dedups against the last emitted value, so
          // the common case where the publisher already emitted it stays a
          // single emission, and `onResizeEnd.value` always equals the last
          // emitted proposal.
          if (session.moved) {
            ledger.emitFinalResizeValue(proposal);
          }
          if (active.trigger === "pointer") {
            callbacksRef.current.onResizeEnd?.({
              handleId: active.handleId,
              initialValue: active.initialLayout.panels,
              value: proposal.panels,
              canceled,
            });
          }
          if (session.moved) {
            reopenPersistenceWriteGate();
            flushPersistenceRef.current(controlled ?? proposal);
          }
        } finally {
          activeResizeRef.current = null;
          ledger.clearControlledProposal();
          if (controlledLayoutRef.current) {
            ledger.commitControlledLayout(controlledLayoutRef.current);
          }
          // Session over: recompute the (was-frozen) auto fold set at the
          // committed width and apply it (X5). A drag that reopened an auto-
          // folded panel already armed the override via applyCollapsedState.
          nudgeAutoRecompute();
        }
      });
    },
    [
      getCurrentLayout,
      getResizeProposal,
      handlePointerSessions,
      ledger,
      nudgeAutoRecompute,
      panelControls,
      reopenPersistenceWriteGate,
    ],
  );

  return {
    resolveInteractiveBoundary,
    getHandleDiagnostic,
    resolvePointerResizeHandle,
    beginResize,
    moveResize,
    endResize,
  };
}

/** Read the geometry the user is actually looking at. Semantic panel state
 * deliberately stays clamped, so it cannot describe a transition that is
 * currently between its two valid endpoints. */
function readLiveSessionSize(
  session: PanelResizeSession,
  token: object,
  fallback: number,
  orientation: PanelGroupOrientation,
): number {
  const rect = session.entries
    .get(token)
    ?.getElement()
    ?.getBoundingClientRect();
  const measured = rect
    ? (orientation === "horizontal" ? rect.width : rect.height) /
      session.axisScale
    : 0;
  return measured > SIZE_EPSILON ? measured : fallback;
}
