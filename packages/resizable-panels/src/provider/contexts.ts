"use client";

import { createContext, useContext } from "react";
import type { PanelStore } from "../core/panel-store.js";
import type { PanelActionDispatcher } from "../types.js";

/** Stable half of the provider: the registry store and the locator-keyed
 * action dispatcher. This context value never changes for the provider's
 * lifetime, so `usePanelActions`/`usePanelControls` consumers do not
 * re-render when drag, container-resize, or viewport flags flip. */
export type PanelRegistryContextType = {
  store: PanelStore;
  actions: PanelActionDispatcher;
};

export const PanelRegistryContext =
  createContext<PanelRegistryContextType | null>(null);

export function usePanelRegistryInternal(
  hookName: string,
): PanelRegistryContextType {
  const ctx = useContext(PanelRegistryContext);
  if (!ctx) {
    throw new Error(
      `${hookName} must be used inside a <PanelGroup> (which provides an implicit boundary) or a <PanelProvider>. To call it from outside the group — e.g. an external toolbar — wrap both the caller and the group in one <PanelProvider>.`,
    );
  }
  return ctx;
}

export type PanelLayoutContextType = {
  /** Registry of panel controls (see panel-store.ts). Components subscribe
   *  to the slice they read; imperative call sites read it directly with no
   *  subscription. Stable for the provider's lifetime. */
  store: PanelStore;
  isDragging: boolean;
  /** Claim the provider-wide interaction lock for one resize session. The
   * opaque owner is unique per gesture; only that owner may release it. */
  claimResizeSession: (owner: object, dragging: boolean) => boolean;
  /** Release the interaction lock only when `owner` still owns it. */
  releaseResizeSession: (owner: object) => void;
  isResizing: boolean;
  /** Shared operating-system motion preference. All library-owned panel
   * transitions and presentation springs consult this provider signal. */
  prefersReducedMotion: boolean;
  /** Add one group's opaque ResizeObserver owner while its container is
   * changing. Owners are independent from pointer resize sessions. */
  beginContainerResize: (owner: object) => void;
  /** Remove only the matching group's active ResizeObserver owner. */
  endContainerResize: (owner: object) => void;
  /** Transiently true when a panel changes collapsed state immediately —
   *  sized siblings and peers read this to suppress their own transitions
   *  for the same paint, so the layout snaps instantly across the whole
   *  group. Cleared two rAFs later. */
  isSkippingAnim: boolean;
  setSkipAnim: (skip: boolean) => void;
};

export const PanelLayoutContext = createContext<PanelLayoutContextType | null>(
  null,
);

/**
 * Internal accessor: context only, no registry subscription. Library
 * components use this so a drag tick in one panel doesn't re-render every
 * handle/seam/panel in the tree — they read live controls via
 * `ctx.store.get(id)` at call time instead. The context value itself only
 * changes when a rare flag flips (drag start/end, container-resize
 * start/idle, window resize).
 */
export function usePanelLayoutInternal(): PanelLayoutContextType {
  const ctx = useContext(PanelLayoutContext);
  if (!ctx) {
    throw new Error(
      "Panel components must be used inside a <PanelGroup> or a <PanelProvider>",
    );
  }
  return ctx;
}
