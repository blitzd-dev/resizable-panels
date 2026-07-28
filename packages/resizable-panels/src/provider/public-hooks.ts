"use client";

import { useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type {
  PanelActionDispatcher,
  PanelControls,
  PanelGroupState,
  PanelLocator,
} from "../types.js";
import { PanelLayoutContext, usePanelRegistryInternal } from "./contexts.js";

/** Subscribe to one panel's controls by exact locator. Returns undefined
 * until the target group publishes its `groupId` and the panel mounts.
 * Re-renders only when that panel's controls materially change (the
 * registry shallow-compares on commit). */
export function usePanelControls(
  target: PanelLocator,
): PanelControls | undefined {
  const { store } = usePanelRegistryInternal("usePanelControls");
  const { groupId, panelId } = target;
  const subscribe = useCallback(
    (cb: () => void) => store.subscribe({ groupId, panelId }, cb),
    [store, groupId, panelId],
  );
  const getSnapshot = useCallback(
    () => store.get({ groupId, panelId }),
    [store, groupId, panelId],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Subscribe to only a panel's collapsed flag. Size-only drag updates still
 * notify the underlying store, but the primitive snapshot stays equal so
 * React does not re-render consumers that only coordinate compact content. */
export function usePanelCollapsed(target: PanelLocator): boolean | undefined {
  const { store } = usePanelRegistryInternal("usePanelCollapsed");
  const { groupId, panelId } = target;
  const subscribe = useCallback(
    (cb: () => void) => store.subscribe({ groupId, panelId }, cb),
    [store, groupId, panelId],
  );
  const getSnapshot = useCallback(
    () => store.get({ groupId, panelId })?.collapsed,
    [store, groupId, panelId],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Locator-keyed action dispatch with call-time target resolution and no
 * reactive subscription: dispatch-only callers never re-render for drag,
 * container, or registry updates. */
export function usePanelActions(): PanelActionDispatcher {
  return usePanelRegistryInternal("usePanelActions").actions;
}

/** Reactive snapshot of one published group's panels keyed by `panelId`.
 * Ignores changes in other groups; returns a stable empty record while the
 * `groupId` is unpublished. */
export function usePanelRegistry(
  groupId: string,
): Readonly<Record<string, PanelControls>> {
  const { store } = usePanelRegistryInternal("usePanelRegistry");
  const subscribe = useCallback(
    (cb: () => void) => store.subscribeGroup(groupId, cb),
    [store, groupId],
  );
  const getSnapshot = useCallback(
    () => store.getGroupSnapshot(groupId),
    [store, groupId],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Reactive snapshot of one published group's layout condition — its measured
 * `containerSize`, whether it has `measured`, and its `overconstrainedBy` /
 * `unallocatedPx` shortfalls. Provider-level and groupId-keyed like
 * `usePanelControls`: exact match or `undefined`, no mount-order fallback.
 * Equality-gated on the numeric fields, so a seam drag that leaves the
 * snapshot unchanged re-renders no consumer. SSR snapshot is `undefined`. */
export function usePanelGroupState(
  groupId: string,
): PanelGroupState | undefined {
  const { store } = usePanelRegistryInternal("usePanelGroupState");
  const subscribe = useCallback(
    (cb: () => void) => store.subscribeGroupState(groupId, cb),
    [store, groupId],
  );
  const getSnapshot = useCallback(
    () => store.getGroupState(groupId),
    [store, groupId],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Provider-wide interaction activity: whether a pointer resize session is
 * active and whether any group container is currently resizing. */
export function usePanelInteractionState(): {
  isPointerDragging: boolean;
  isContainerResizing: boolean;
} {
  const ctx = useContext(PanelLayoutContext);
  if (!ctx) {
    throw new Error(
      "usePanelInteractionState must be used inside a <PanelGroup> (which provides an implicit boundary) or a <PanelProvider>. To call it from outside the group, wrap both the caller and the group in one <PanelProvider>.",
    );
  }
  const { isDragging, isResizing } = ctx;
  return useMemo(
    () => ({
      isPointerDragging: isDragging,
      isContainerResizing: isResizing,
    }),
    [isDragging, isResizing],
  );
}
