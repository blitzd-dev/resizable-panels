"use client";

import { useCallback } from "react";
import { type BoundaryPanel, resizeBoundary } from "../core/boundary-resize.js";
import { distributeContainerLayout } from "../core/container-layout.js";
import type { KeyedStore } from "../core/keyed-store.js";
import { mapsAlmostEqual, sizesDiffer } from "../core/size.js";
import type { InternalPanelControls } from "../types.js";
import type { ChildEntry, PeerSlot } from "./group-context.js";

/**
 * Imperative peer sizing commands. Peer space is allocator-owned, so every
 * explicit change routes through either the seam cascade (expanded peers),
 * the preference store (collapsed peers), or a re-resolution of the whole
 * automatic pool (§10).
 */
export function usePeerCommands({
  childOrderRef,
  panelControls,
  peerSlots,
  peerSizes,
  explicitZeroPeersRef,
  markExplicitPeerSize,
  readRenderedSize,
}: {
  childOrderRef: { readonly current: ChildEntry[] };
  panelControls: KeyedStore<object, InternalPanelControls>;
  peerSlots: KeyedStore<object, PeerSlot>;
  peerSizes: KeyedStore<object, number>;
  explicitZeroPeersRef: { current: Set<object> };
  markExplicitPeerSize: (token: object, size: number) => void;
  readRenderedSize: (
    entry: ChildEntry,
    controls: InternalPanelControls,
  ) => number;
}) {
  /** Hand an automatic peer back to the allocator, re-resolving every
   * automatic peer in the same pool. Their resolved numbers are current
   * state, not configured defaults; feeding those numbers back would make
   * the reset a no-op and lose the automatic/fixed distinction. Returns
   * the size allocated to `token`, or null when nothing reallocated. */
  // biome-ignore lint/correctness/useExhaustiveDependencies: composition-root refs are stable for the group's lifetime; reading .current at call time (not render time) is the design.
  const resetAutomaticPeer = useCallback(
    (token: object): { size: number | null; changed: boolean } => {
      const peers = childOrderRef.current.filter(
        (child): child is Extract<ChildEntry, { kind: "peer" }> =>
          child.kind === "peer",
      );
      const peerSpace = peers.reduce((sum, peer) => {
        const peerControls = panelControls.get(peer.token);
        return peerControls ? sum + readRenderedSize(peer, peerControls) : sum;
      }, 0);
      const result = distributeContainerLayout(
        peerSpace,
        peers.flatMap((peer) => {
          const peerControls = panelControls.get(peer.token);
          if (!peerControls) return [];
          const slot = peerSlots.get(peer.token);
          const configuredDefault =
            slot?.defaultSize === undefined ? undefined : slot.defaultPx;
          return [
            {
              token: peer.token,
              behavior: peerControls.config.containerResizeBehavior,
              collapsed: peerControls.collapsed,
              collapsedSize: peerControls.config.collapsedSize,
              currentSize:
                configuredDefault === undefined
                  ? undefined
                  : peerSizes.get(peer.token),
              defaultSize: configuredDefault,
              minSize: peerControls.config.minSize,
              maxSize: peerControls.config.maxSize,
            },
          ];
        }),
      );
      const nextPeerSizes = new Map(peerSizes.getMap());
      for (const peer of peers) {
        const peerControls = panelControls.get(peer.token);
        const allocated = result.sizes.get(peer.token);
        if (!peerControls || allocated === undefined) continue;
        if (!peerControls.collapsed) {
          if (peerSlots.get(peer.token)?.defaultSize === undefined) {
            explicitZeroPeersRef.current.delete(peer.token);
          }
          nextPeerSizes.set(peer.token, allocated);
        }
      }
      // `changed` reports whether this re-resolution committed anything —
      // for any peer in the pool, not just the caller. It is the §10
      // acceptance signal the peer reset gates its `transition:"none"`
      // suppression on (R-20): sibling movement caused by the reset is
      // part of the accepted change.
      let changed = false;
      if (!mapsAlmostEqual(peerSizes.getMap(), nextPeerSizes)) {
        peerSizes.replaceAll(nextPeerSizes);
        changed = true;
      }
      return { size: result.sizes.get(token) ?? null, changed };
    },
    [panelControls, peerSizes, peerSlots, readRenderedSize],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: composition-root refs are stable for the group's lifetime; reading .current at call time (not render time) is the design.
  const setPeerSize = useCallback(
    (token: object, nextPx: number): number | null => {
      const current = peerSizes.get(token) ?? 0;
      const delta = nextPx - current;
      if (delta === 0) return current;
      const peerEntries: ChildEntry[] = [];
      for (const entry of childOrderRef.current) {
        if (entry.kind === "peer") peerEntries.push(entry);
      }
      const peerIndex = peerEntries.findIndex((entry) => entry.token === token);
      if (peerIndex < 0) return null;

      // Multiple peers transfer space within the proportional pool, as they
      // always have. With only one peer, that pool has no counterparty, so
      // use the adjacent group boundary instead. This keeps the allocator's
      // total-space invariant while allowing the imperative peer API to use
      // the same mixed docked/peer cascade as a resize handle.
      const resizeEntries =
        peerEntries.length === 1 ? childOrderRef.current : peerEntries;
      const resizeIndex =
        peerEntries.length === 1
          ? resizeEntries.findIndex((entry) => entry.token === token)
          : peerIndex;
      if (resizeIndex < 0 || resizeEntries.length < 2) return null;

      const fromSizes = new Map<object, number>();
      const panels: BoundaryPanel<object>[] = resizeEntries.flatMap((entry) => {
        const controls = panelControls.get(entry.token);
        if (!controls) return [];
        const rendered = readRenderedSize(entry, controls);
        fromSizes.set(entry.token, rendered);
        if (entry.kind === "docked") {
          // Imperative peer resizing never changes collapse state. A
          // collapsed rail keeps its rendered reservation while the
          // cascade may continue to a compatible docked panel beyond it.
          const frozen = controls.collapsed;
          return [
            {
              token: entry.token,
              minSize: frozen ? rendered : controls.config.minSize,
              maxSize: frozen ? rendered : controls.config.maxSize,
              disabled: controls.config.disabled,
              pinned: controls.config.pinned,
            },
          ];
        }
        const slot = peerSlots.get(entry.token);
        if (!slot) return [];
        return [
          {
            token: entry.token,
            minSize: slot.minPx,
            maxSize: slot.maxPx,
            disabled: controls.config.disabled,
          },
        ];
      });
      if (panels.length !== resizeEntries.length) return null;
      const hasNext = resizeIndex + 1 < panels.length;
      const result = resizeBoundary({
        panels,
        boundaryIndex: hasNext ? resizeIndex + 1 : resizeIndex,
        delta: hasNext ? delta : -delta,
        fromSizes,
      });
      if (result.appliedDelta === 0) return current;
      const appliedTargetSize = result.sizes.get(token);
      if (appliedTargetSize !== undefined) {
        markExplicitPeerSize(token, appliedTargetSize);
      }

      const nextPeerSizes = new Map(peerSizes.getMap());
      for (const entry of resizeEntries) {
        const nextSize = result.sizes.get(entry.token);
        if (nextSize === undefined) continue;
        if (entry.kind === "peer") {
          nextPeerSizes.set(entry.token, nextSize);
          continue;
        }
        const controls = panelControls.get(entry.token);
        if (
          controls &&
          !controls.collapsed &&
          sizesDiffer(fromSizes.get(entry.token) ?? controls.size, nextSize)
        ) {
          controls.setSize(nextSize);
        }
      }
      if (!mapsAlmostEqual(peerSizes.getMap(), nextPeerSizes)) {
        peerSizes.replaceAll(nextPeerSizes);
      }
      // The cascade may apply less than requested when neighbor capacity
      // runs out; report the size it actually applied (§10).
      return appliedTargetSize ?? current;
    },
    [
      markExplicitPeerSize,
      panelControls,
      peerSizes,
      peerSlots,
      readRenderedSize,
    ],
  );

  const setPeerPreferredSize = useCallback(
    (token: object, nextPx: number) => {
      markExplicitPeerSize(token, nextPx);
      peerSizes.set(token, nextPx);
    },
    [markExplicitPeerSize, peerSizes],
  );

  return { resetAutomaticPeer, setPeerSize, setPeerPreferredSize };
}
