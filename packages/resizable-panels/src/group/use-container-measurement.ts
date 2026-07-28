"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { ChangeAttribution } from "../core/change-ledger.js";
import { SIZE_EPSILON, sizesDiffer } from "../core/size.js";
import { CONTAINER_RESIZE_IDLE_MS } from "../core/timing.js";
import { readAxisScale } from "../shared/axis-scale.js";
import { IS_DEVELOPMENT, warnDev } from "../shared/diagnostics.js";
import type { PanelGroupOrientation } from "../types.js";
import type { ChildEntry } from "./group-context.js";

/**
 * Content-box measurement of the group's main axis, plus the group-local
 * container-resize activity window (R-31). The synchronous first measure
 * treats zero as "unmeasurable" (SSR, jsdom); only a ResizeObserver entry
 * can confirm a genuinely zero-sized box (R-13).
 */
export function useContainerMeasurement({
  groupElementRef,
  orientation,
  childOrderRef,
  beginContainerResize,
  endContainerResize,
  markLayoutSource,
}: {
  groupElementRef: { readonly current: HTMLDivElement | null };
  orientation: PanelGroupOrientation;
  childOrderRef: { readonly current: ChildEntry[] };
  beginContainerResize: (owner: object) => void;
  endContainerResize: (owner: object) => void;
  markLayoutSource: (
    attribution: ChangeAttribution,
    deferUntilCommit?: boolean,
  ) => () => void;
}) {
  const [containerMeasurement, setContainerMeasurement] = useState({
    measured: false,
    size: 0,
  });

  // Group-LOCAL container-resize activity (R-31). The provider-wide
  // `isResizing` stays raised for the public interaction readout, but
  // transition suppression consults this flag so one group's container
  // churn cannot cancel a sibling group's in-flight animation.
  const [isContainerResizing, setIsContainerResizing] = useState(false);

  // R-13: warn once per mounted group when the browser CONFIRMS a zero
  // main-axis box. Only the ResizeObserver path below can confirm one —
  // the synchronous first measure treats zero as "unmeasurable" (SSR,
  // jsdom), and a `display: none` ancestor never produces an observation
  // entry at all (the element is not rendered) — so neither can
  // false-positive here.
  const zeroSizeWarnedRef = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: composition-root refs are stable for the group's lifetime; reading .current at call time (not render time) is the design.
  useLayoutEffect(() => {
    const el = groupElementRef.current;
    if (!el) return;
    const resizeOwner = {};
    let disposed = false;
    const measure = () => readContentBoxMainSize(el, orientation);
    const commitMeasurement = (size: number) => {
      setContainerMeasurement((current) =>
        current.measured && !sizesDiffer(current.size, size)
          ? current
          : { measured: true, size },
      );
    };
    const initialSize = measure();
    // A synchronous zero is indistinguishable from an unmeasurable SSR/
    // jsdom box. A real zero-sized browser box is confirmed by the first
    // ResizeObserver entry below; non-zero boxes can allocate immediately.
    if (initialSize > SIZE_EPSILON) commitMeasurement(initialSize);
    if (typeof ResizeObserver === "undefined") return;
    let resizeIdleTimer: ReturnType<typeof setTimeout> | undefined;
    // Prefer the observer's content-box geometry: panels are flex children
    // of that box, so consumer padding and borders are not allocatable.
    // Older engines and test shims omit contentBoxSize; the shared fallback
    // subtracts physical padding and borders from the border-box rect.
    const mainFromEntry = (entry: ResizeObserverEntry): number =>
      readContentBoxMainSize(el, orientation, entry);
    // Only flip isResizing when the main-axis size changes. ResizeObserver
    // also fires for cross-axis changes (e.g. an inner vertical group's
    // width fluctuating while its height is stable), and treating those as
    // "user is resizing" spuriously suppresses panel transitions inside.
    let lastMain = measure();
    const ro = new ResizeObserver((entries) => {
      if (disposed) return;
      const main = mainFromEntry(entries[entries.length - 1]);
      if (
        IS_DEVELOPMENT &&
        !zeroSizeWarnedRef.current &&
        main <= SIZE_EPSILON &&
        childOrderRef.current.length > 0
      ) {
        // The group has no room to lay out and the cause is easy to misread
        // as a library bug (R-13): the inline sizing defaults silently defeat
        // class-based sizing on the group itself.
        zeroSizeWarnedRef.current = true;
        const axis = orientation === "horizontal" ? "width" : "height";
        warnDev(
          `<PanelGroup orientation="${orientation}"> measured a ${axis} of 0px, so its panels have no room to lay out — floored panels overflow the clipped box and zero-floor panels render nothing. The group fills its parent (inline width/height: 100%); give the parent a nonzero ${axis}. Note that className-based sizing on the group itself cannot override these inline defaults — size the parent element, or pass an explicit ${axis} via the group's style prop.`,
        );
      }
      const mainChanged = sizesDiffer(main, lastMain);
      if (mainChanged) {
        markLayoutSource(
          { reason: "container-resize", trigger: "system" },
          true,
        );
      }
      commitMeasurement(main);
      if (!mainChanged) return;
      lastMain = main;
      beginContainerResize(resizeOwner);
      setIsContainerResizing(true);
      if (resizeIdleTimer) clearTimeout(resizeIdleTimer);
      resizeIdleTimer = setTimeout(() => {
        resizeIdleTimer = undefined;
        endContainerResize(resizeOwner);
        setIsContainerResizing(false);
      }, CONTAINER_RESIZE_IDLE_MS);
    });
    ro.observe(el);
    return () => {
      disposed = true;
      ro.disconnect();
      if (resizeIdleTimer) clearTimeout(resizeIdleTimer);
      endContainerResize(resizeOwner);
      setIsContainerResizing(false);
    };
  }, [beginContainerResize, endContainerResize, markLayoutSource, orientation]);

  return { containerMeasurement, isContainerResizing };
}

/** Measure the physical main axis that direct flex children can occupy.
 * ResizeObserverSize uses logical axes, so map them through writing-mode;
 * the fallback uses physical computed-style edges to avoid that ambiguity. */
export function readContentBoxMainSize(
  element: HTMLElement,
  orientation: PanelGroupOrientation,
  entry?: ResizeObserverEntry,
): number {
  const contentBoxSize = entry?.contentBoxSize;
  const box = Array.isArray(contentBoxSize)
    ? contentBoxSize[0]
    : (contentBoxSize as ResizeObserverSize | undefined);
  if (box) {
    const writingMode = getComputedStyle(element).writingMode;
    const horizontalInlineAxis =
      !writingMode.startsWith("vertical") &&
      !writingMode.startsWith("sideways");
    const mainSize =
      (orientation === "horizontal") === horizontalInlineAxis
        ? box.inlineSize
        : box.blockSize;
    if (Number.isFinite(mainSize)) return Math.max(0, mainSize);
  }

  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const cssPixels = (value: string): number => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  // The entry path above reports layout px; the rect is visual px. Convert
  // so both paths (and the padding/border subtraction below, which computed
  // style reports in layout px) agree inside a scaled ancestor.
  const outerSize =
    (orientation === "horizontal" ? rect.width : rect.height) /
    readAxisScale(element, orientation);
  const nonContentSize =
    orientation === "horizontal"
      ? cssPixels(style.paddingLeft) +
        cssPixels(style.paddingRight) +
        cssPixels(style.borderLeftWidth) +
        cssPixels(style.borderRightWidth)
      : cssPixels(style.paddingTop) +
        cssPixels(style.paddingBottom) +
        cssPixels(style.borderTopWidth) +
        cssPixels(style.borderBottomWidth);
  return Math.max(0, outerSize - nonContentSize);
}
