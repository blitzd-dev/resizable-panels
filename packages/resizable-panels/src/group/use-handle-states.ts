"use client";

import { useCallback, useLayoutEffect } from "react";
import type { ChangeAttribution } from "../core/change-ledger.js";
import type { KeyedStore } from "../core/keyed-store.js";
import { SIZE_EPSILON } from "../core/size.js";
import { IS_DEVELOPMENT } from "../shared/diagnostics.js";
import type {
  InternalPanelControls,
  PanelConfig,
  PanelValueChangeTrigger,
} from "../types.js";
import { shownCollapsed } from "./collapsed-state.js";
import type {
  ChildEntry,
  PanelResizeHandleState,
  PeerSlot,
} from "./group-context.js";
import { resizeCollapseFloor } from "./use-resize-controller.js";

export function handleStatesEqual(
  a: PanelResizeHandleState | null,
  b: PanelResizeHandleState | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.beforeId === b.beforeId &&
    a.afterId === b.afterId &&
    a.beforePanelId === b.beforePanelId &&
    a.afterPanelId === b.afterPanelId &&
    a.adjacentCollapsed === b.adjacentCollapsed &&
    a.pointerHitArea === b.pointerHitArea &&
    a.valueNow === b.valueNow &&
    a.valueMin === b.valueMin &&
    a.valueMax === b.valueMax &&
    a.valueText === b.valueText &&
    a.disabled === b.disabled &&
    a.toggleOnly === b.toggleOnly
  );
}

function getPointerHitArea(
  beforeSize: number,
  beforeCollapsed: boolean,
  afterSize: number,
  afterCollapsed: boolean,
): PanelResizeHandleState["pointerHitArea"] {
  const zeroBefore = !beforeCollapsed && beforeSize <= SIZE_EPSILON;
  const zeroAfter = !afterCollapsed && afterSize <= SIZE_EPSILON;
  if (zeroBefore && zeroAfter) return "none";
  if (zeroAfter) return "before";
  if (zeroBefore) return "after";
  return "full";
}

/**
 * Floor announced to assistive technology for a handle's "before" panel
 * (the `aria-valuemin` clamp). Deliberately distinct from
 * `resizeCollapseFloor`: a currently collapsed panel always announces its
 * collapsed rail size — the rail is what the separator controls right now —
 * and only an expanded panel with an armed `collapseBelow` announces the
 * deeper threshold floor.
 */
function announcedCollapseFloor(
  config: PanelConfig,
  collapsed: boolean,
): number {
  if (collapsed) return config.collapsedSize;
  return config.collapsible && config.collapseBelow !== undefined
    ? Math.min(config.minSize, config.collapsedSize, config.collapseBelow)
    : config.minSize;
}

type HandleStateWorkMetrics = {
  publications: number;
  childScans: number;
  handleComputations: number;
  boundaryTraversals: number;
};

function recordHandleStateWork(metrics: HandleStateWorkMetrics) {
  if (!IS_DEVELOPMENT || typeof globalThis === "undefined") return;
  const target = (
    globalThis as typeof globalThis & {
      __resizablePanelsHandleStateMetrics?: HandleStateWorkMetrics;
    }
  ).__resizablePanelsHandleStateMetrics;
  if (!target) return;
  target.publications += metrics.publications;
  target.childScans += metrics.childScans;
  target.handleComputations += metrics.handleComputations;
  target.boundaryTraversals += metrics.boundaryTraversals;
}

/**
 * Derives and publishes each handle's boundary snapshot — the capacity
 * model behind drag ranges and announced ARIA ranges (R-09), coincident-
 * seam ownership, and the toggle-only Enter affordance (R-18) — plus the
 * handle-level toggle and double-click-reset commands.
 */
export function useHandleStates({
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
}: {
  disabled: boolean;
  childOrder: ChildEntry[];
  childOrderRef: { readonly current: ChildEntry[] };
  groupElementRef: { readonly current: HTMLDivElement | null };
  handleElements: KeyedStore<object, () => HTMLElement | null>;
  handleIdsRef: { readonly current: Map<object, string> };
  handleStates: KeyedStore<object, PanelResizeHandleState | null>;
  panelControls: KeyedStore<object, InternalPanelControls>;
  peerSizes: KeyedStore<object, number>;
  peerSlots: KeyedStore<object, PeerSlot>;
  renderedSizes: KeyedStore<object, number>;
  readRenderedSize: (
    entry: ChildEntry,
    controls: InternalPanelControls,
  ) => number;
  resolveInteractiveBoundary: (handleToken: object) => {
    children: ChildEntry[];
    boundaryIndex: number;
    before: ChildEntry;
    after: ChildEntry;
    canResize: boolean;
    toggleTarget: ChildEntry | null;
  } | null;
  markLayoutSource: (attribution: ChangeAttribution) => () => void;
  resetAutomaticPeer: (token: object) => {
    size: number | null;
    changed: boolean;
  };
}) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: composition-root refs are stable for the group's lifetime; reading .current at call time (not render time) is the design.
  const deriveHandleStates = useCallback(() => {
    type SnapshotPanel = {
      entry: ChildEntry;
      controls: InternalPanelControls;
      size: number;
      minSize: number;
      grow: number;
      shrink: number;
      disabled: boolean;
      pinned: boolean;
    };
    type CapacityModel = {
      panels: SnapshotPanel[];
      indexByToken: Map<object, number>;
      towardStart: (boundaryIndex: number) => number;
      towardEnd: (boundaryIndex: number) => number;
    };

    const work: HandleStateWorkMetrics = {
      publications: 1,
      childScans: 0,
      handleComputations: 0,
      boundaryTraversals: 0,
    };
    // Registration commits keep this ref in DOM order. Re-sorting here would
    // reintroduce O(P log P) work on every resize publication.
    const entries = childOrderRef.current;
    work.childScans += entries.length;
    const panels: SnapshotPanel[] = [];
    for (const entry of entries) {
      const controls = panelControls.get(entry.token);
      if (!controls) continue;
      const size = readRenderedSize(entry, controls);
      const minSize = resizeCollapseFloor(controls.config, controls.collapsed);
      panels.push({
        entry,
        controls,
        size,
        minSize,
        grow: Math.max(0, controls.config.maxSize - size),
        shrink: Math.max(0, size - minSize),
        disabled: Boolean(controls.config.disabled),
        pinned:
          controls.config.pinned ||
          (controls.collapsed && !controls.config.resizableWhenCollapsed),
      });
    }

    const buildCapacityModel = (
      modelPanels: SnapshotPanel[],
    ): CapacityModel => {
      const length = modelPanels.length;
      const leftGrow = Array<number>(length).fill(0);
      const leftShrink = Array<number>(length).fill(0);
      const rightGrow = Array<number>(length).fill(0);
      const rightShrink = Array<number>(length).fill(0);
      const directLeftGrow = Array<number>(length).fill(0);
      const directLeftShrink = Array<number>(length).fill(0);
      const directRightGrow = Array<number>(length).fill(0);
      const directRightShrink = Array<number>(length).fill(0);

      for (let index = 0; index < length; index++) {
        work.boundaryTraversals += 1;
        const panel = modelPanels[index];
        const previousGrow = index > 0 ? leftGrow[index - 1] : 0;
        const previousShrink = index > 0 ? leftShrink[index - 1] : 0;
        if (panel.disabled) continue;
        directLeftGrow[index] = panel.grow + previousGrow;
        directLeftShrink[index] = panel.shrink + previousShrink;
        leftGrow[index] = (panel.pinned ? 0 : panel.grow) + previousGrow;
        leftShrink[index] = (panel.pinned ? 0 : panel.shrink) + previousShrink;
      }
      for (let index = length - 1; index >= 0; index--) {
        work.boundaryTraversals += 1;
        const panel = modelPanels[index];
        const nextGrow = index + 1 < length ? rightGrow[index + 1] : 0;
        const nextShrink = index + 1 < length ? rightShrink[index + 1] : 0;
        if (panel.disabled) continue;
        directRightGrow[index] = panel.grow + nextGrow;
        directRightShrink[index] = panel.shrink + nextShrink;
        rightGrow[index] = (panel.pinned ? 0 : panel.grow) + nextGrow;
        rightShrink[index] = (panel.pinned ? 0 : panel.shrink) + nextShrink;
      }

      return {
        panels: modelPanels,
        indexByToken: new Map(
          modelPanels.map((panel, index) => [panel.entry.token, index]),
        ),
        towardStart(boundaryIndex) {
          if (boundaryIndex <= 0 || boundaryIndex >= length) return 0;
          return -Math.min(
            directRightGrow[boundaryIndex],
            directLeftShrink[boundaryIndex - 1],
          );
        },
        towardEnd(boundaryIndex) {
          if (boundaryIndex <= 0 || boundaryIndex >= length) return 0;
          return Math.min(
            directLeftGrow[boundaryIndex - 1],
            directRightShrink[boundaryIndex],
          );
        },
      };
    };

    const fullModel = buildCapacityModel(panels);
    const visiblePanels = panels.filter(
      ({ controls }) =>
        !(controls.collapsed && controls.config.collapsedSize <= SIZE_EPSILON),
    );
    const visibleModel = buildCapacityModel(visiblePanels);
    const fullIndexByElement = new Map<Element, number>();
    for (let index = 0; index < panels.length; index++) {
      const element = panels[index].entry.getElement();
      if (element) fullIndexByElement.set(element, index);
    }
    const tokenByHandle = new Map<HTMLElement, object>();
    for (const [token, getElement] of handleElements.getMap()) {
      const element = getElement();
      if (element) tokenByHandle.set(element, token);
    }
    const handles: Array<{
      token: object;
      beforeIndex: number;
      afterIndex: number;
    }> = [];
    const groupElement = groupElementRef.current;
    if (groupElement) {
      for (const child of groupElement.children) {
        if (
          !(child instanceof HTMLElement) ||
          !child.hasAttribute("data-resizable-panels-resize-handle-slot")
        ) {
          continue;
        }
        const handle = child.querySelector<HTMLElement>(
          "[data-resizable-panels-resize-handle]",
        );
        const token = handle ? tokenByHandle.get(handle) : undefined;
        const beforeIndex = fullIndexByElement.get(
          child.previousElementSibling as Element,
        );
        const afterIndex = fullIndexByElement.get(
          child.nextElementSibling as Element,
        );
        if (
          token &&
          beforeIndex !== undefined &&
          afterIndex === beforeIndex + 1
        ) {
          handles.push({ token, beforeIndex, afterIndex });
        }
      }
    }
    work.handleComputations += handles.length;

    const previousVisible = Array<number>(panels.length).fill(-1);
    const nextVisible = Array<number>(panels.length).fill(-1);
    let nearest = -1;
    for (let index = 0; index < panels.length; index++) {
      if (visibleModel.indexByToken.has(panels[index].entry.token)) {
        nearest = index;
      }
      previousVisible[index] = nearest;
    }
    nearest = -1;
    for (let index = panels.length - 1; index >= 0; index--) {
      if (visibleModel.indexByToken.has(panels[index].entry.token)) {
        nearest = index;
      }
      nextVisible[index] = nearest;
    }

    const ownerByVisiblePair = new Map<object, Map<object, object>>();
    for (const handle of handles) {
      const before = previousVisible[handle.beforeIndex];
      const after = nextVisible[handle.afterIndex];
      if (
        before < 0 ||
        after < 0 ||
        (before === handle.beforeIndex && after === handle.afterIndex)
      ) {
        continue;
      }
      const beforeToken = panels[before].entry.token;
      const afterToken = panels[after].entry.token;
      let byAfter = ownerByVisiblePair.get(beforeToken);
      if (!byAfter) {
        byAfter = new Map();
        ownerByVisiblePair.set(beforeToken, byAfter);
      }
      if (!byAfter.has(afterToken)) byAfter.set(afterToken, handle.token);
    }

    const nextStates = new Map<object, PanelResizeHandleState | null>();
    for (const token of handleElements.getMap().keys())
      nextStates.set(token, null);
    for (const handle of handles) {
      const immediateBefore = panels[handle.beforeIndex];
      const immediateAfter = panels[handle.afterIndex];
      const visibleBeforeIndex = previousVisible[handle.beforeIndex];
      const visibleAfterIndex = nextVisible[handle.afterIndex];
      const skippedCollapsed =
        visibleBeforeIndex !== handle.beforeIndex ||
        visibleAfterIndex !== handle.afterIndex;
      const hasVisibleBoundary =
        visibleBeforeIndex >= 0 && visibleAfterIndex >= 0;
      const useVisible = skippedCollapsed && hasVisibleBoundary;
      const before = useVisible ? panels[visibleBeforeIndex] : immediateBefore;
      const after = useVisible ? panels[visibleAfterIndex] : immediateAfter;
      const model = useVisible ? visibleModel : fullModel;
      const boundaryIndex = model.indexByToken.get(after.entry.token) ?? -1;
      const owner = ownerByVisiblePair
        .get(before.entry.token)
        ?.get(after.entry.token);
      const canResizeCollapsed = (panel: SnapshotPanel) =>
        !panel.controls.collapsed ||
        (panel.controls.config.resizableWhenCollapsed &&
          panel.controls.config.collapsedSize > SIZE_EPSILON);
      const canResize = useVisible
        ? owner === handle.token
        : canResizeCollapsed(immediateBefore) &&
          canResizeCollapsed(immediateAfter);
      const isZeroCollapsedSnapshot = (panel: SnapshotPanel) =>
        panel.controls.collapsed &&
        panel.controls.config.collapsedSize <= SIZE_EPSILON;
      const beforeZeroCollapsed = isZeroCollapsedSnapshot(immediateBefore);
      const afterZeroCollapsed = isZeroCollapsedSnapshot(immediateAfter);
      // R-18 — mirrors resolveInteractiveBoundary's `toggleTarget`: a
      // handle that cannot drag ONLY because exactly one adjacent panel is
      // a zero-collapsed collapsible (and no visible pair claims the seam
      // — `!useVisible`) stays focusable so Enter can expand that panel.
      // Group `disabled` and per-panel `disabled` still win; interior
      // non-owner handles at a coincident seam stay fully disabled.
      const toggleOnly =
        !disabled &&
        !canResize &&
        !useVisible &&
        beforeZeroCollapsed !== afterZeroCollapsed &&
        canResizeCollapsed(
          beforeZeroCollapsed ? immediateAfter : immediateBefore,
        ) &&
        !immediateBefore.disabled &&
        !immediateAfter.disabled;
      const announcedBefore = canResize ? before : immediateBefore;
      const announcedAfter = canResize ? after : immediateAfter;
      const towardStart = model.towardStart(boundaryIndex);
      const towardEnd = model.towardEnd(boundaryIndex);
      const beforeFloor = announcedCollapseFloor(
        announcedBefore.controls.config,
        announcedBefore.controls.collapsed,
      );
      nextStates.set(handle.token, {
        beforeId: announcedBefore.entry.domId,
        afterId: announcedAfter.entry.domId,
        beforePanelId: announcedBefore.entry.panelId,
        afterPanelId: announcedAfter.entry.panelId,
        adjacentCollapsed:
          immediateBefore.controls.collapsed ||
          immediateAfter.controls.collapsed,
        pointerHitArea: getPointerHitArea(
          immediateBefore.size,
          immediateBefore.controls.collapsed,
          immediateAfter.size,
          immediateAfter.controls.collapsed,
        ),
        valueNow: Math.round(announcedBefore.size),
        // A toggle-only separator cannot move by drag or arrow keys, so it
        // announces a zero-width range (min = now = max) instead of the
        // capacity model's hypothetical travel (R-18).
        valueMin: toggleOnly
          ? Math.round(announcedBefore.size)
          : Math.round(
              Math.min(
                announcedBefore.size,
                Math.max(beforeFloor, announcedBefore.size + towardStart),
              ),
            ),
        valueMax: toggleOnly
          ? Math.round(announcedBefore.size)
          : Math.round(
              Math.max(
                announcedBefore.size,
                Math.min(
                  announcedBefore.controls.config.maxSize,
                  announcedBefore.size + towardEnd,
                ),
              ),
            ),
        valueText: toggleOnly
          ? `${Math.round(announcedBefore.size)} pixels before, ${Math.round(announcedAfter.size)} pixels after, ${beforeZeroCollapsed ? "before" : "after"} panel collapsed`
          : `${Math.round(announcedBefore.size)} pixels before, ${Math.round(announcedAfter.size)} pixels after`,
        disabled:
          !toggleOnly &&
          (disabled ||
            !canResize ||
            announcedBefore.disabled ||
            announcedAfter.disabled),
        toggleOnly,
      });
    }
    recordHandleStateWork(work);
    return nextStates;
  }, [disabled, handleElements, panelControls, readRenderedSize]);

  // Store notifications may arrive several times for one logical resize
  // (controls, peer preferences, and rendered allocations). Coalesce them
  // into one snapshot pass, then notify only handles whose effective
  // boundary metadata actually changed.
  useLayoutEffect(() => {
    // Re-publish when mounted tokens retain identity but change DOM order.
    void childOrder;
    let scheduled = false;
    let active = true;
    const publish = () => {
      if (!active) return;
      scheduled = false;
      handleStates.replaceAll(deriveHandleStates());
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(publish);
    };
    const unsubs = [
      handleElements.subscribeAny(schedule),
      panelControls.subscribeAny(schedule),
      peerSizes.subscribeAny(schedule),
      renderedSizes.subscribeAny(schedule),
    ];
    publish();
    return () => {
      active = false;
      for (const unsubscribe of unsubs) unsubscribe();
    };
  }, [
    childOrder,
    deriveHandleStates,
    handleElements,
    handleStates,
    panelControls,
    peerSizes,
    renderedSizes,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: composition-root refs are stable for the group's lifetime; reading .current at call time (not render time) is the design.
  const toggleHandlePanel = useCallback(
    (handleToken: object): boolean => {
      if (disabled) return false;
      const boundary = resolveInteractiveBoundary(handleToken);
      if (!boundary) return false;
      if (!boundary.canResize) {
        // R-18: the boundary cannot drag, but when that is only because an
        // adjacent zero-collapsed collapsible panel exists, Enter expands
        // that panel. Drag stays disabled by design — expansion is the
        // sole interaction, so the handle is published as toggle-only.
        const target = boundary.toggleTarget;
        if (!target) return false;
        const controls = panelControls.get(target.token);
        if (
          !controls ||
          !shownCollapsed(controls) ||
          controls.config.disabled
        ) {
          return false;
        }
        markLayoutSource({
          reason: "expand",
          trigger: "keyboard",
          handleId: handleIdsRef.current.get(handleToken),
        });
        controls.expand();
        return true;
      }
      const { before, after } = boundary;
      const controls = [before, after]
        .map((entry) => panelControls.get(entry.token))
        .find((value) => value?.config.collapsible);
      if (!controls) return false;
      markLayoutSource({
        // Effective state (R-33): a controlled panel's toggle proposes the
        // inverse of its PROP; a width-driven auto-fold reads as shown-
        // collapsed so Enter expands it (R-37) — the mark must agree.
        reason: shownCollapsed(controls) ? "expand" : "collapse",
        trigger: "keyboard",
        handleId: handleIdsRef.current.get(handleToken),
      });
      controls.toggle();
      return true;
    },
    [disabled, markLayoutSource, panelControls, resolveInteractiveBoundary],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: composition-root refs are stable for the group's lifetime; reading .current at call time (not render time) is the design.
  const resetHandlePanel = useCallback(
    (
      handleToken: object,
      target: "before" | "after",
      trigger: Extract<
        PanelValueChangeTrigger,
        "pointer" | "keyboard"
      > = "pointer",
    ): boolean => {
      if (disabled) return false;
      const boundary = resolveInteractiveBoundary(handleToken);
      if (!boundary?.canResize) return false;
      const entry = target === "before" ? boundary.before : boundary.after;
      const controls = panelControls.get(entry.token);
      if (!controls || controls.config.disabled) return false;
      markLayoutSource({
        reason: "reset",
        trigger,
        handleId: handleIdsRef.current.get(handleToken),
      });
      const peerSlot =
        entry.kind === "peer" ? peerSlots.get(entry.token) : undefined;
      const peerIsAutomatic = peerSlot?.defaultSize === undefined;
      if (entry.kind === "peer" && peerIsAutomatic) {
        resetAutomaticPeer(entry.token);
      } else {
        controls.setSize(
          entry.kind === "peer"
            ? (peerSlot?.defaultPx ?? 0)
            : controls.config.defaultSize,
        );
      }
      if (controls.config.collapsible) {
        controls.setCollapsed(controls.config.defaultCollapsed);
      }
      return true;
    },
    [
      disabled,
      markLayoutSource,
      panelControls,
      peerSlots,
      resolveInteractiveBoundary,
      resetAutomaticPeer,
    ],
  );

  return { toggleHandlePanel, resetHandlePanel };
}
