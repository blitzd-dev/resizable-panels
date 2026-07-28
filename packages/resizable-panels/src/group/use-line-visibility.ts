"use client";

import { useLayoutEffect } from "react";
import type { KeyedStore } from "../core/keyed-store.js";
import type { PanelGroupOrientation } from "../types.js";
import type {
  HandleInteractionState,
  HandleLineState,
  HandlePointerSessionState,
} from "./group-context.js";

/**
 * Separator-line visibility and election for one group (R-22/R-23/R-24/
 * R-26/R-28): one observer set watches the group and its panels, dedupes
 * coincident runs to a single elected line (session owner > keyboard focus
 * > DOM order), and publishes per-handle line state.
 */
export function useLineVisibility({
  groupElementRef,
  orientation,
  handleElements,
  handleInteractions,
  handleLineVisibility,
  handlePointerSessions,
}: {
  groupElementRef: { readonly current: HTMLDivElement | null };
  orientation: PanelGroupOrientation;
  handleElements: KeyedStore<object, () => HTMLElement | null>;
  handleInteractions: KeyedStore<object, HandleInteractionState>;
  handleLineVisibility: KeyedStore<object, HandleLineState>;
  handlePointerSessions: KeyedStore<object, HandlePointerSessionState>;
}) {
  // One observer set owns separator-line visibility for the whole group.
  // The previous per-handle observers each watched the group plus every
  // panel, multiplying mount and topology work by handles × panels.
  // biome-ignore lint/correctness/useExhaustiveDependencies: composition-root refs are stable for the group's lifetime; reading .current at call time (not render time) is the design.
  useLayoutEffect(() => {
    const groupElement = groupElementRef.current;
    if (!groupElement) return;

    let observedPanels = new Set<Element>();
    let scheduled = false;
    let active = true;

    const update = () => {
      if (!active) return;
      scheduled = false;
      const tokenByHandle = new Map<HTMLElement, object>();
      for (const [token, getElement] of handleElements.getMap()) {
        const element = getElement();
        if (element) tokenByHandle.set(element, token);
      }

      let contentStart = Number.POSITIVE_INFINITY;
      let contentEnd = Number.NEGATIVE_INFINITY;
      const slots: Array<{ token: object; coordinate: number }> = [];
      for (const child of groupElement.children) {
        if (!(child instanceof HTMLElement)) continue;
        if (child.hasAttribute("data-resizable-panels-panel")) {
          const rect = child.getBoundingClientRect();
          const size = orientation === "horizontal" ? rect.width : rect.height;
          if (size <= 0.5) continue;
          contentStart = Math.min(
            contentStart,
            orientation === "horizontal" ? rect.left : rect.top,
          );
          contentEnd = Math.max(
            contentEnd,
            orientation === "horizontal" ? rect.right : rect.bottom,
          );
          continue;
        }
        if (!child.hasAttribute("data-resizable-panels-resize-handle-slot")) {
          continue;
        }
        const handle = child.querySelector<HTMLElement>(
          "[data-resizable-panels-resize-handle]",
        );
        const token = handle ? tokenByHandle.get(handle) : undefined;
        if (!token) continue;
        const rect = child.getBoundingClientRect();
        slots.push({
          token,
          coordinate: orientation === "horizontal" ? rect.left : rect.top,
        });
      }

      // The live pointer session's owning handle, if any (at most one
      // entry, R-22). At a shared coordinate the separator line must
      // follow the seam the user is actually holding — DOM-order dedup
      // alone would unmount the owning handle's line the moment a drag
      // converges onto another handle's coordinate (R-24).
      let sessionOwner: object | null = null;
      for (const token of handlePointerSessions.getMap().keys()) {
        sessionOwner = token;
        break;
      }
      const interactions = handleInteractions.getMap();

      const next = new Map<object, HandleLineState>();
      for (let start = 0; start < slots.length; ) {
        // One coincident run: every following slot within 0.5px of the
        // run's first coordinate shares the seam.
        const runCoordinate = slots[start].coordinate;
        let end = start + 1;
        while (
          end < slots.length &&
          Math.abs(slots[end].coordinate - runCoordinate) <= 0.5
        ) {
          end++;
        }
        // A coincident run occupies one visual seam, so it must PRESENT
        // as one seam (R-28): the run elects one stable line — the
        // session-owning handle when it sits in this run (R-22/R-24),
        // then a keyboard-focused member (R-23), then DOM order (the
        // run's first slot) — and hover decides WHETHER that elected
        // line lights (`runHot` below), never WHICH line shows. Hover
        // previously joined the election (R-26), which swapped the
        // mounted line between the two flush-adjacent 1px positions as
        // the pointer crossed the split hit area's midline; run-level
        // lighting supersedes that while keeping R-26's guarantee that
        // hovering EITHER half lights the seam. Hover/focus get no say
        // while a session is live, matching the handles' own hover/focus
        // suppression during sibling drags.
        let primaryIndex = start;
        if (sessionOwner !== null) {
          for (let index = start; index < end; index++) {
            if (slots[index].token === sessionOwner) {
              primaryIndex = index;
              break;
            }
          }
        } else {
          for (let index = start; index < end; index++) {
            if (interactions.get(slots[index].token)?.focusVisible) {
              primaryIndex = index;
              break;
            }
          }
        }
        // R-28: light the elected line while ANY run member is hovered.
        // Only multi-member runs publish the bit — an ordinary handle's
        // hover already lights its own line through its element state,
        // so hover flips at ordinary seams keep recomputing to an
        // identical map and notify nobody.
        let runHovered = false;
        if (sessionOwner === null && end - start > 1) {
          for (let index = start; index < end; index++) {
            if (interactions.get(slots[index].token)?.hovered) {
              runHovered = true;
              break;
            }
          }
        }
        for (let index = start; index < end; index++) {
          const { token, coordinate } = slots[index];
          const visible =
            (index === primaryIndex &&
              contentStart < coordinate - 0.5 &&
              contentEnd > coordinate + 0.5) ||
            // A keyboard-focused handle always renders its line, even
            // at the group's content edges where resting lines hide —
            // focus must never be invisible (R-23). Yields to a live
            // pointer session like every other interaction state.
            (sessionOwner === null &&
              interactions.get(token)?.focusVisible === true);
          next.set(token, {
            visible,
            // Hover deliberately does not override the content-edge
            // rule: a run whose elected line is edge-suppressed stays
            // unlit, exactly as resting behavior at edges always was.
            runHot: runHovered && index === primaryIndex && visible,
          });
        }
        start = end;
      }
      handleLineVisibility.replaceAll(next);
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(update);
    };
    if (typeof ResizeObserver === "undefined") {
      update();
      const unsubscribeHandles = handleElements.subscribeAny(schedule);
      const unsubscribeSessions = handlePointerSessions.subscribeAny(schedule);
      const unsubscribeInteractions = handleInteractions.subscribeAny(schedule);
      return () => {
        active = false;
        unsubscribeHandles();
        unsubscribeSessions();
        unsubscribeInteractions();
      };
    }
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(groupElement);
    const syncObservedPanels = () => {
      const next = new Set<Element>();
      for (const child of groupElement.children) {
        if (
          child instanceof HTMLElement &&
          child.hasAttribute("data-resizable-panels-panel")
        ) {
          next.add(child);
          if (!observedPanels.has(child)) resizeObserver.observe(child);
        }
      }
      for (const panel of observedPanels) {
        if (!next.has(panel)) resizeObserver.unobserve(panel);
      }
      observedPanels = next;
    };
    syncObservedPanels();
    update();

    const mutationObserver = new MutationObserver(() => {
      syncObservedPanels();
      schedule();
    });
    mutationObserver.observe(groupElement, { childList: true });
    const unsubscribeHandles = handleElements.subscribeAny(schedule);
    // Session ownership changes must recompute primaries even when no
    // panel geometry moves — e.g. releasing a drag at a converged
    // coordinate hands the line back to the DOM-order primary without any
    // resize observation (R-24). At most a handful of notifications per
    // session (begin, limited flips behind the store's equality gate, end).
    const unsubscribeSessions = handlePointerSessions.subscribeAny(schedule);
    // Hover/focus flips must recompute primaries too (R-26): entering the
    // other half of a coincident seam's split hit area moves the line to
    // the hovered handle even though no panel geometry changed. Enter/
    // leave cadence (never per pointer move), microtask-coalesced, and
    // `replaceAll`'s equality gate makes a flip at an ordinary seam a
    // zero-notification no-op — render locality (C8) holds.
    const unsubscribeInteractions = handleInteractions.subscribeAny(schedule);

    return () => {
      active = false;
      unsubscribeHandles();
      unsubscribeSessions();
      unsubscribeInteractions();
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, [
    handleElements,
    handleInteractions,
    handleLineVisibility,
    handlePointerSessions,
    orientation,
  ]);
}
