"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  type AutoPanel,
  computeAutoFoldSet,
  computeAutoThresholds,
} from "../core/auto-collapse.js";
import type { ChangeAttribution } from "../core/change-ledger.js";
import { distributeContainerLayout } from "../core/container-layout.js";
import type { KeyedStore } from "../core/keyed-store.js";
import type { PanelStore } from "../core/panel-store.js";
import { mapsAlmostEqual, SIZE_EPSILON, sizesDiffer } from "../core/size.js";
import { IS_DEVELOPMENT, warnDev } from "../shared/diagnostics.js";
import type { InternalPanelControls, PanelChangeDetails } from "../types.js";
import type { ActiveResize, ChildEntry, PeerSlot } from "./group-context.js";

// Stable dedupe keys: these warnings embed per-width px amounts, so a
// message-string dedupe would re-warn at every width in a sweep.
const OVERCONSTRAINED_WARNING_KEY = "\0overconstrained";
const UNALLOCATED_WARNING_KEY = "\0unallocated";
const FALLBACK_WARNING_KEY = "\0fallback";

function automaticCurrentSize(
  current: number | undefined,
  slot: PeerSlot | undefined,
  explicitZero: boolean,
): number | undefined {
  if (
    current !== undefined &&
    current <= SIZE_EPSILON &&
    !slot?.defaultIsExplicit &&
    !explicitZero
  ) {
    return undefined;
  }
  return current;
}

// ─── auto-distribution / proportional rescale ────────────────────────────
// Maintains the invariant: Σ renderedDocked + Σ renderedPeers = container.
//
// Re-runs when:
//   - container size changes (window resize, parent group resize)
//   - peer slots change (peer mounted/unmounted, bounds re-resolved)
//   - any panel in this group collapses/expands
//
// The summary includes docked preferred sizes and every collapsed flag.
// Peer resize ticks notify their store entry but produce the same summary,
// so the group itself still avoids per-frame re-renders.
export function useGroupAllocation({
  groupId,
  registryToken,
  store,
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
}: {
  groupId: string | undefined;
  registryToken: object;
  store: PanelStore;
  childOrder: ChildEntry[];
  layoutTokens: readonly object[];
  groupElementRef: { readonly current: HTMLDivElement | null };
  containerMeasurement: { measured: boolean; size: number };
  panelControls: KeyedStore<object, InternalPanelControls>;
  peerSlots: KeyedStore<object, PeerSlot>;
  peerSizes: KeyedStore<object, number>;
  renderedSizes: KeyedStore<object, number>;
  handleGutterSizes: KeyedStore<object, number>;
  reservedGutterSize: () => number;
  explicitZeroPeersRef: { current: Set<object> };
  activeResizeRef: { readonly current: ActiveResize | null };
  autoCollapsedStore: KeyedStore<object, boolean>;
  autoOverrideRef: { current: Set<object> };
  prevAutoFoldRef: { current: ReadonlySet<object> };
  pendingOverrideAttributionRef: { current: PanelChangeDetails | null };
  autoOverrideVersion: number;
  autoRecomputeTick: number;
  markLayoutSource: (
    attribution: ChangeAttribution,
    deferUntilCommit?: boolean,
  ) => () => void;
  markCanonicalChange: () => void;
}) {
  const containerSize = containerMeasurement.size;
  // Px by which the floors exceed the container; drives
  // `data-overconstrained` (never-squish, R-34).
  const [overconstrainedPx, setOverconstrainedPx] = useState(0);
  // Call-time mirror for the docked `constrained` flag — kept out of the
  // context value so resizes don't churn it.
  const overconstrainedRef = useRef(0);

  const subscribePanelSummary = useCallback(
    (cb: () => void) => {
      const unsubs = layoutTokens.map((token) =>
        panelControls.subscribeKey(token, cb),
      );
      return () => {
        for (const u of unsubs) u();
      };
    },
    [layoutTokens, panelControls],
  );
  const getPanelSummary = useCallback(() => {
    let s = "";
    for (const entry of childOrder) {
      const controls = panelControls.get(entry.token);
      s += controls?.collapsed ? "c" : "e";
      if (entry.kind === "docked") s += `:${controls?.size ?? 0}`;
      s += ";";
    }
    return s;
  }, [childOrder, panelControls]);
  const panelSummary = useSyncExternalStore(
    subscribePanelSummary,
    getPanelSummary,
    getPanelSummary,
  );

  // Re-render (and re-run the effect below) when peer slots change. The
  // version snapshot is a number, so unchanged slots cost nothing.
  const subscribeSlots = useCallback(
    (cb: () => void) => peerSlots.subscribeAny(cb),
    [peerSlots],
  );
  const slotsVersion = useSyncExternalStore(
    subscribeSlots,
    peerSlots.version,
    peerSlots.version,
  );
  // Re-run allocation when a handle's gutterSize registers or changes:
  // gutters occupy layout space, so the allocatable container shrinks by
  // their sum (R-14).
  const subscribeGutters = useCallback(
    (cb: () => void) => handleGutterSizes.subscribeAny(cb),
    [handleGutterSizes],
  );
  const guttersVersion = useSyncExternalStore(
    subscribeGutters,
    handleGutterSizes.version,
    handleGutterSizes.version,
  );
  const allocationWarningsRef = useRef(new Set<string>());
  const collapsedPanelTokensRef = useRef(new Set<object>());
  const allocationOrderRef = useRef<object[]>([]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: slotsVersion, panelSummary, and guttersVersion are deliberate invalidation tokens — the effect reads external-store contents that mutate without an identity change, and these counters force the re-run.
  useLayoutEffect(() => {
    if (!containerMeasurement.measured) return;
    const renderedPanelCount = Array.from(
      groupElementRef.current?.children ?? [],
    ).filter((element) =>
      element.hasAttribute("data-resizable-panels-panel"),
    ).length;
    const peerChildCount = childOrder.reduce(
      (count, entry) => count + (entry.kind === "peer" ? 1 : 0),
      0,
    );
    if (
      childOrder.length !== renderedPanelCount ||
      peerSlots.size() !== peerChildCount ||
      childOrder.some((entry) => !panelControls.get(entry.token))
    ) {
      return;
    }

    const previousPeerSizes = peerSizes.getMap();
    const allocationOrder = childOrder.map((entry) => entry.token);
    const structureChanged =
      allocationOrder.length !== allocationOrderRef.current.length ||
      allocationOrder.some(
        (token, index) => allocationOrderRef.current[index] !== token,
      );
    allocationOrderRef.current = allocationOrder;
    const previouslyCollapsed = collapsedPanelTokensRef.current;
    const currentlyCollapsed = new Set<object>();
    const newlyExpanded = new Set<object>();
    let hasConfiguredProportionalPanel = false;
    for (const entry of childOrder) {
      const controls = panelControls.get(entry.token);
      if (!controls) continue;
      if (controls.collapsed) currentlyCollapsed.add(entry.token);
      else {
        if (previouslyCollapsed.has(entry.token)) {
          newlyExpanded.add(entry.token);
        }
        if (controls.config.containerResizeBehavior === "proportional") {
          hasConfiguredProportionalPanel = true;
        }
      }
    }
    collapsedPanelTokensRef.current = currentlyCollapsed;

    // R-37 responsive auto-collapse. AUTHORITY RULE (X5): while a pointer
    // resize session is live in this group the fold set is FROZEN — the
    // session owns presentation (the R-33 gesture precedent), so an external
    // container resize cannot fold/unfold mid-drag. `endResize` nudges a
    // recompute at the committed width via `autoRecomputeTick`.
    let autoFold: ReadonlySet<object>;
    if (activeResizeRef.current) {
      autoFold = prevAutoFoldRef.current;
    } else {
      // Compute the fold set from declared floors (never from committed sizes
      // — that would be circular). The floor of a manually/controlled-
      // collapsed panel is its collapsedSize; an eligible auto panel's floor
      // is its minSize and folding frees the difference. Overridden panels
      // and `collapseBelow` pairings (G1) are held out; thresholds ignore the
      // override so the latch can clear on a re-cross.
      const gutters = reservedGutterSize();
      const autoBase: AutoPanel<object>[] = [];
      for (let i = 0; i < childOrder.length; i++) {
        const controls = panelControls.get(childOrder[i].token);
        if (!controls) continue;
        const cfg = controls.config;
        const autoMode =
          cfg.autoCollapsible &&
          controls.controlledCollapsed === undefined &&
          !controls.collapsed &&
          cfg.collapseBelow === undefined;
        autoBase.push({
          token: childOrder[i].token,
          order: i,
          minSize: controls.collapsed ? cfg.collapsedSize : cfg.minSize,
          collapsedSize: cfg.collapsedSize,
          auto: autoMode,
          releaseBand: cfg.collapseBelowHysteresis,
        });
      }
      // Stays-open latch (owner OQ1): an explicit open holds at ANY narrower
      // width and clears ONLY when space returns and the panel fits again
      // (W ≥ Tⱼ) — the fold machinery then resets fresh. No re-fold band.
      if (autoOverrideRef.current.size > 0) {
        const thresholds = new Map(
          computeAutoThresholds(autoBase, gutters).map((t) => [
            t.token,
            t.threshold,
          ]),
        );
        for (const token of autoOverrideRef.current) {
          const Tj = thresholds.get(token);
          if (Tj === undefined || containerSize >= Tj) {
            autoOverrideRef.current.delete(token);
          }
        }
      }
      autoFold = computeAutoFoldSet(
        autoBase.map((p) =>
          autoOverrideRef.current.has(p.token) ? { ...p, auto: false } : p,
        ),
        gutters,
        containerSize,
        prevAutoFoldRef.current,
      ).folded;
      prevAutoFoldRef.current = autoFold;
    }
    // The active pointer session owns the GEOMETRY of the panels it drives
    // (X5): a folded panel being dragged yields its rail so the gesture can
    // reopen it. The published fold bit (autoFold) is unchanged, so the panel
    // still arms the override at session end when the drag reopened it.
    const sessionEntries = activeResizeRef.current?.session.entries;
    const isFolded = (token: object): boolean => {
      if (panelControls.get(token)?.collapsed) return true;
      if (sessionEntries?.has(token)) return false;
      return autoFold.has(token);
    };

    const result = distributeContainerLayout(
      Math.max(0, containerSize - reservedGutterSize()),
      childOrder.flatMap((entry) => {
        const controls = panelControls.get(entry.token);
        if (!controls) return [];
        const slot =
          entry.kind === "peer" ? peerSlots.get(entry.token) : undefined;
        return [
          {
            token: entry.token,
            behavior: newlyExpanded.has(entry.token)
              ? "fixed"
              : controls.config.containerResizeBehavior,
            collapsed: isFolded(entry.token),
            collapsedSize: controls.config.collapsedSize,
            currentSize:
              entry.kind === "peer"
                ? automaticCurrentSize(
                    previousPeerSizes.get(entry.token),
                    slot,
                    explicitZeroPeersRef.current.has(entry.token),
                  )
                : controls.size,
            // Peer slots preserve the difference between an automatic
            // default (undefined) and an explicit numeric zero. Do not
            // fall back to the public control's pre-allocation size.
            defaultSize:
              entry.kind === "peer"
                ? slot?.defaultPx
                : controls.config.defaultSize,
            // Peer slots and group controls are updated in separate layout
            // effects. Use the slot's same-render bounds so an automatic
            // peer cannot be allocated against the controls' temporary
            // pre-measurement maxSize of zero.
            minSize:
              entry.kind === "peer"
                ? (slot?.minPx ?? controls.config.minSize)
                : controls.config.minSize,
            maxSize:
              entry.kind === "peer"
                ? (slot?.maxPx ?? controls.config.maxSize)
                : controls.config.maxSize,
          },
        ];
      }),
    );

    // Add back the gutter shortfall the allocator's max(0, container −
    // gutters) clamp discards when gutters alone exceed the container.
    const overconstrainedTotal =
      result.overconstrained +
      Math.max(0, reservedGutterSize() - containerSize);
    overconstrainedRef.current = overconstrainedTotal;
    setOverconstrainedPx((previous) =>
      Math.abs(previous - overconstrainedTotal) > SIZE_EPSILON
        ? overconstrainedTotal
        : previous,
    );
    // Publish the measured snapshot from THIS pass, so containerSize and its
    // derived shortfalls are always internally consistent — never a fresh
    // size paired with one-commit-stale oc/un (P1). Equality-gated in-store.
    if (groupId) {
      store.publishGroupState(registryToken, {
        containerSize,
        measured: true,
        overconstrainedBy: overconstrainedTotal,
        unallocatedPx: result.unallocated,
      });
    }

    // Publish the responsive fold set (equality-gated): only folded tokens
    // carry `true`, so a panel reads its own bit through `usePanelAutoCollapsed`.
    const nextAutoCollapsed = new Map<object, boolean>();
    for (const token of autoFold) nextAutoCollapsed.set(token, true);
    const prevAutoCollapsed = autoCollapsedStore.getMap();
    let autoCollapsedChanged =
      prevAutoCollapsed.size !== nextAutoCollapsed.size;
    if (!autoCollapsedChanged) {
      for (const token of nextAutoCollapsed.keys()) {
        if (!prevAutoCollapsed.has(token)) {
          autoCollapsedChanged = true;
          break;
        }
      }
    }
    if (autoCollapsedChanged) autoCollapsedStore.replaceAll(nextAutoCollapsed);

    if (IS_DEVELOPMENT) {
      let warning: string | null = null;
      let warningKey: string | null = null;
      if (result.usedFallback && !hasConfiguredProportionalPanel) {
        warning =
          '<PanelGroup> requires at least one expanded panel with containerResizeBehavior="proportional". The last expanded panel is being used as a deterministic fallback.';
        warningKey = FALLBACK_WARNING_KEY;
      } else if (result.unallocated > SIZE_EPSILON) {
        warning = `<PanelGroup> has ${Math.round(result.unallocated)}px that cannot be allocated without exceeding panel maxSize constraints.`;
        warningKey = UNALLOCATED_WARNING_KEY;
      }
      if (
        warning &&
        warningKey &&
        !allocationWarningsRef.current.has(warningKey)
      ) {
        allocationWarningsRef.current.add(warningKey);
        warnDev(warning);
      }
      if (
        overconstrainedTotal > SIZE_EPSILON &&
        !allocationWarningsRef.current.has(OVERCONSTRAINED_WARNING_KEY)
      ) {
        allocationWarningsRef.current.add(OVERCONSTRAINED_WARNING_KEY);
        warnDev(
          `<PanelGroup> is ${Math.round(
            overconstrainedTotal,
          )}px too small for its panels' minimum sizes. The layout overflows and is clipped. Reduce a minSize, collapse a panel, or let the group scroll with style={{ overflow: "auto" }}.`,
        );
      }
    }

    const nextRenderedSizes = new Map<object, number>();
    const nextPeerSizes = new Map<object, number>();
    const proportionalDockedUpdates: Array<{
      controls: InternalPanelControls;
      size: number;
    }> = [];
    for (const entry of childOrder) {
      const controls = panelControls.get(entry.token);
      const allocated = result.sizes.get(entry.token);
      if (!controls || allocated === undefined) continue;
      // Expanded peers already have an authoritative live peerSizes entry,
      // which updates on every drag tick without re-running this effect.
      // Keep only docked allocations and collapsed peer reservations here.
      if (entry.kind === "docked" || isFolded(entry.token)) {
        nextRenderedSizes.set(entry.token, allocated);
      }
      if (entry.kind === "docked") {
        if (
          !isFolded(entry.token) &&
          controls.config.containerResizeBehavior === "proportional" &&
          allocated >= controls.config.minSize - SIZE_EPSILON &&
          allocated <= controls.config.maxSize + SIZE_EPSILON &&
          sizesDiffer(controls.size, allocated)
        ) {
          proportionalDockedUpdates.push({ controls, size: allocated });
        }
      } else {
        // peerSizes stores the preferred expanded size while a peer is
        // collapsed; its collapsed allocation is render-only.
        if (isFolded(entry.token)) {
          // Keep an expanded preference while collapsed when one is known.
          // Leaving an automatic peer absent is intentional: on expansion,
          // undefined tells the allocator to resolve it instead of treating
          // a numeric zero as the automatic sentinel.
          const preferred =
            previousPeerSizes.get(entry.token) ??
            peerSlots.get(entry.token)?.defaultPx;
          if (preferred !== undefined) {
            nextPeerSizes.set(entry.token, preferred);
          }
        } else {
          const wasResolved = previousPeerSizes.has(entry.token);
          const slot = peerSlots.get(entry.token);
          // A container-relative peer can register once against the
          // pre-measurement 0px container. Do not commit that provisional
          // allocation into the numeric store: after F-03, a stored zero is
          // deliberately explicit and would prevent the ready bounds from
          // ever resolving this automatic peer.
          if (wasResolved || slot?.boundsReady !== false) {
            nextPeerSizes.set(entry.token, allocated);
          }
        }
      }
    }

    const renderedChanged = !mapsAlmostEqual(
      renderedSizes.getMap(),
      nextRenderedSizes,
    );
    const peersChanged = !mapsAlmostEqual(previousPeerSizes, nextPeerSizes);
    if (
      renderedChanged ||
      peersChanged ||
      proportionalDockedUpdates.length > 0
    ) {
      // A peer pool receiving its very first allocation is measurement
      // canonicalization, not a semantic change (§2). Later redistribution
      // and membership changes attribute normally.
      if (structureChanged) {
        markLayoutSource({ reason: "children", trigger: "system" });
      } else if (
        pendingOverrideAttributionRef.current &&
        !activeResizeRef.current
      ) {
        // This (post-session) pass releases a fold a user just override-
        // expanded: attribute it to their action, not the system, so the
        // release event reports the real trigger (R-37/F3). A frozen pass
        // mid-session must NOT consume it — the release happens at end.
        markLayoutSource(pendingOverrideAttributionRef.current);
        pendingOverrideAttributionRef.current = null;
      } else if (previousPeerSizes.size === 0 && nextPeerSizes.size > 0) {
        markCanonicalChange();
      } else {
        markLayoutSource({ reason: "container-resize", trigger: "system" });
      }
    } else if (!activeResizeRef.current) {
      // No visible change consumed the pending arm (and no session is live to
      // release it later); do not leak it onto a later system pass.
      pendingOverrideAttributionRef.current = null;
    }
    for (const update of proportionalDockedUpdates) {
      update.controls.setSize(update.size);
    }
    if (renderedChanged) renderedSizes.replaceAll(nextRenderedSizes);
    if (peersChanged) peerSizes.replaceAll(nextPeerSizes);
  }, [
    containerSize,
    containerMeasurement.measured,
    slotsVersion,
    panelSummary,
    guttersVersion,
    childOrder,
    panelControls,
    peerSlots,
    peerSizes,
    renderedSizes,
    reservedGutterSize,
    markLayoutSource,
    groupId,
    store,
    registryToken,
    autoCollapsedStore,
    autoOverrideVersion,
    autoRecomputeTick,
  ]);

  // Pre-measurement publication for usePanelGroupState (R-36): the allocation
  // effect above early-returns before measurement, so publish the
  // measured:false snapshot here. Once measured, that effect owns publication
  // (atomic, P1); the store's equality gate dedupes the overlap.
  useLayoutEffect(() => {
    if (!groupId || containerMeasurement.measured) return;
    store.publishGroupState(registryToken, {
      containerSize,
      measured: false,
      overconstrainedBy: 0,
      unallocatedPx: 0,
    });
  }, [
    groupId,
    store,
    registryToken,
    containerSize,
    containerMeasurement.measured,
  ]);

  return { overconstrainedPx, overconstrainedRef };
}
