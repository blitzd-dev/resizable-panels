"use client";

import {
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPanelStore } from "../core/panel-store.js";
import { usePrefersReducedMotion } from "../shared/reduced-motion.js";
import { useSkipAnimation } from "../shared/use-skip-animation.js";
import type {
  PanelActionDispatcher,
  PanelControls,
  PanelLocator,
} from "../types.js";
import { PanelLayoutContext, PanelRegistryContext } from "./contexts.js";

export type PanelProviderProps = { children: ReactNode };

/**
 * Root provider. Holds the registry of mounted groups and their panels and
 * exposes locator-keyed imperative dispatch via usePanelActions(). Also
 * tracks global dragging/container-resizing flags: dragging suppresses
 * panel transitions everywhere, while the resizing flag only feeds the
 * public usePanelInteractionState readout — container-resize transition
 * suppression is group-local (R-31) so one group's churn cannot cancel a
 * sibling group's in-flight collapse animation.
 *
 * The registry lives in an external store (see panel-store.ts), not React
 * state: per-tick drag updates notify only subscribers of the panel that
 * moved. The store and dispatcher live in their own stable context, so
 * dispatch-only and lookup-only consumers never re-render when the
 * interaction flags here flip.
 */
export function PanelProvider({ children }: PanelProviderProps) {
  const [store] = useState(createPanelStore);
  const [isDragging, setIsDragging] = useState(false);
  const resizeOwnerRef = useRef<{ owner: object; dragging: boolean } | null>(
    null,
  );
  const containerResizeOwnersRef = useRef(new Set<object>());
  const [isResizing, setIsResizing] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isSkippingAnim, setSkipAnim] = useSkipAnimation();

  const claimResizeSession = useCallback(
    (owner: object, dragging: boolean): boolean => {
      if (resizeOwnerRef.current) return false;
      resizeOwnerRef.current = { owner, dragging };
      if (dragging) setIsDragging(true);
      return true;
    },
    [],
  );

  const releaseResizeSession = useCallback((owner: object) => {
    const active = resizeOwnerRef.current;
    if (!active || active.owner !== owner) return;
    resizeOwnerRef.current = null;
    if (active.dragging) setIsDragging(false);
  }, []);

  const beginContainerResize = useCallback((owner: object) => {
    const owners = containerResizeOwnersRef.current;
    if (owners.has(owner)) return;
    owners.add(owner);
    if (owners.size === 1) setIsResizing(true);
  }, []);

  const endContainerResize = useCallback((owner: object) => {
    const owners = containerResizeOwnersRef.current;
    if (!owners.delete(owner)) return;
    if (owners.size === 0) setIsResizing(false);
  }, []);

  // The dispatcher resolves its target through the store at call time, so
  // one memo over the stable store yields a provider-lifetime-stable object.
  const actions = useMemo<PanelActionDispatcher>(() => {
    const run = <T extends { applied: boolean }>(
      target: PanelLocator,
      action: (controls: PanelControls) => T,
    ): T | { applied: false; reason: "not-found" } => {
      const controls = store.get(target);
      return controls
        ? action(controls)
        : { applied: false, reason: "not-found" };
    };
    return {
      setSize: (target, size, options) =>
        run(target, (controls) => controls.setSize(size, options)),
      maximize: (target, options) =>
        run(target, (controls) => controls.maximize(options)),
      setCollapsed: (target, collapsed, options) =>
        run(target, (controls) => controls.setCollapsed(collapsed, options)),
      collapse: (target, options) =>
        run(target, (controls) => controls.collapse(options)),
      expand: (target, options) =>
        run(target, (controls) => controls.expand(options)),
      toggle: (target, options) =>
        run(target, (controls) => controls.toggle(options)),
      reset: (target, options) =>
        run(target, (controls) => controls.reset(options)),
      getGroupValue: (groupId) => store.getGroupCommands(groupId)?.getValue(),
      setGroupValue: (groupId, value) =>
        store.getGroupCommands(groupId)?.setValue(value) ?? {
          applied: false,
          reason: "not-found",
        },
      resetGroupValue: (groupId) =>
        store.getGroupCommands(groupId)?.resetValue() ?? {
          applied: false,
          reason: "not-found",
        },
    };
  }, [store]);

  const registryValue = useMemo(() => ({ store, actions }), [store, actions]);

  const value = useMemo(
    () => ({
      store,
      isDragging,
      claimResizeSession,
      releaseResizeSession,
      isResizing,
      prefersReducedMotion,
      beginContainerResize,
      endContainerResize,
      isSkippingAnim,
      setSkipAnim,
    }),
    [
      store,
      isDragging,
      claimResizeSession,
      releaseResizeSession,
      isResizing,
      prefersReducedMotion,
      beginContainerResize,
      endContainerResize,
      isSkippingAnim,
    ],
  );

  return (
    <PanelRegistryContext.Provider value={registryValue}>
      <PanelLayoutContext.Provider value={value}>
        {children}
      </PanelLayoutContext.Provider>
    </PanelRegistryContext.Provider>
  );
}

/**
 * INTERNAL: mount an implicit provider only when none is present (§14).
 *
 * Nearest provider wins: nested groups reuse the outer boundary, standalone
 * sibling groups get independent implicit providers, and an explicit nested
 * provider remains a deliberate isolation boundary. Detection reads React
 * context only — never browser availability — so server and first-client
 * structures always match.
 *
 * Cross-provider safety does not come from here: pointer sessions acquire a
 * document-scoped lease (document-lease.ts) and viewport invalidation is a
 * module-level store (viewport.ts), so multiple implicit providers cannot
 * corrupt body styles or stack window listeners.
 */
export function EnsurePanelProvider({ children }: { children: ReactNode }) {
  const existing = useContext(PanelLayoutContext);
  if (existing) return <>{children}</>;
  return <PanelProvider>{children}</PanelProvider>;
}
