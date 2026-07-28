"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clamp, SIZE_EPSILON } from "../core/size.js";
import { usePanelThresholdMotion } from "../group/group-context.js";
import type { PanelCollapseBelowBehavior } from "../types.js";
import type { PanelFoundation } from "./use-panel-foundation.js";

// ─── threshold-collapse presentation ─────────────────────────────────────────

export type ThresholdMotionSize = {
  active: boolean;
  size: number | null;
};

/** Dimensionless spring stiffness. Divided by the group's resolved
 * transition duration (R-16) to produce the spring's angular frequency, so
 * the JS-driven threshold motion and the CSS transitions stay in step for
 * whatever duration the group configured. */
const THRESHOLD_SPRING_STIFFNESS = 6.5;
const THRESHOLD_SPRING_INITIAL_VELOCITY = 5;

/** Threshold-collapse presentation plus the shared transition-suppression
 * policy: any active drag (unless the drag itself is driving an animated
 * threshold collapse), live threshold motion, the panel's OWN group's
 * container resize (group-local, not the provider-wide flag — R-31), reduced
 * motion, the group-wide or local skip flags, and `animation={false}`
 * (R-16) each force `transition: none`. */
export function useThresholdPresentation(
  f: PanelFoundation,
  collapseBelowBehavior: PanelCollapseBelowBehavior,
  /** Named divergence between the kinds' size models: the expanded size
   * the spring settles toward. Docked passes its effective (allocator-
   * clamped preferred) size; peers pass their allocator basis. */
  targetSize: number,
): { thresholdMotion: ThresholdMotionSize; noTransition: boolean } {
  const thresholdCollapseIsAnimating =
    f.collapsed &&
    f.collapseBelowPx !== undefined &&
    collapseBelowBehavior === "animated";
  const thresholdMotionCommand = usePanelThresholdMotion(f.token);
  const thresholdMotion = useThresholdMotionSize({
    command: thresholdMotionCommand,
    collapsed: f.collapsed,
    collapsedSize: f.collapsedSizePx,
    // `animation={false}` disables the threshold spring alongside the CSS
    // transitions; prefers-reduced-motion independently disables both —
    // whichever is stricter wins (R-16).
    enabled:
      f.collapseBelowPx !== undefined &&
      collapseBelowBehavior === "animated" &&
      f.group.animation.enabled &&
      !f.layout.prefersReducedMotion,
    maxSize: f.maxPx,
    targetSize,
    durationMs: f.group.animation.durationMs,
  });
  const noTransition =
    (f.layout.isDragging && !thresholdCollapseIsAnimating) ||
    thresholdMotion.active ||
    f.group.isContainerResizing ||
    f.layout.prefersReducedMotion ||
    f.layout.isSkippingAnim ||
    !f.group.animation.enabled ||
    f.skipAnim;
  return { thresholdMotion, noTransition };
}

/** One interruptible presentation timeline for both threshold directions.
 * Semantic geometry remains either collapsed or validly expanded; this
 * critically damped spring owns only the pixels shown between those states.
 * Live pointer deltas move the seam 1:1 without restarting the animation;
 * semantic reversals rebase from the current visible seam. */
function useThresholdMotionSize({
  command,
  collapsed,
  collapsedSize,
  enabled,
  maxSize,
  targetSize,
  durationMs,
}: {
  command:
    | { collapsed: boolean; fromSize: number; targetSize: number }
    | undefined;
  collapsed: boolean;
  collapsedSize: number;
  enabled: boolean;
  maxSize: number;
  targetSize: number;
  /** The group's resolved animation duration — spring stiffness and the
   * settle cutoff both derive from it. */
  durationMs: number;
}): ThresholdMotionSize {
  const springOmega = THRESHOLD_SPRING_STIFFNESS / (durationMs / 1_000);
  const consumedCommandRef = useRef(command);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const motionStartTimeRef = useRef(0);
  // `gap = target - presentation`. Animating the gap independently means a
  // live target delta moves the presentation by that exact delta, while the
  // one-time threshold-release distance continues settling in parallel.
  const gapRef = useRef(0);
  const gapVelocityRef = useRef(0);
  const motionTargetRef = useRef(collapsed ? collapsedSize : targetSize);
  const collapsedSizeRef = useRef(collapsedSize);
  const maxSizeRef = useRef(maxSize);
  const motionCollapsedRef = useRef(collapsed);
  const previousCollapsedRef = useRef(collapsed);
  const expandedTargetRef = useRef(targetSize);
  const [animatedGap, setAnimatedGap] = useState<number | null>(null);
  const hasPendingCommand =
    enabled && command !== undefined && command !== consumedCommandRef.current;
  const collapsedChanged = collapsed !== previousCollapsedRef.current;
  if (hasPendingCommand) {
    motionCollapsedRef.current = command.collapsed;
  } else if (collapsedChanged || animatedGap === null) {
    motionCollapsedRef.current = collapsed;
  }
  previousCollapsedRef.current = collapsed;
  const intendedCollapsed = motionCollapsedRef.current;

  collapsedSizeRef.current = collapsedSize;
  maxSizeRef.current = maxSize;
  if (hasPendingCommand && !command.collapsed) {
    expandedTargetRef.current = command.targetSize;
  } else if (!intendedCollapsed && targetSize > collapsedSize + SIZE_EPSILON) {
    expandedTargetRef.current = targetSize;
  }
  const motionTarget = clamp(
    intendedCollapsed ? collapsedSize : expandedTargetRef.current,
    collapsedSize,
    maxSize,
  );

  let presentedGap = gapRef.current;
  if (hasPendingCommand) {
    motionTargetRef.current = clamp(command.targetSize, collapsedSize, maxSize);
  } else if (animatedGap !== null) {
    const previousTarget = motionTargetRef.current;
    const previousPosition = clamp(
      previousTarget - gapRef.current,
      collapsedSize,
      maxSize,
    );
    const directPosition = motionTarget - gapRef.current;
    if (directPosition < collapsedSize) {
      // The pointer reversed farther than the remaining opening gap. Cancel
      // only the excess gap: stay continuous while still behind the cursor,
      // or follow it immediately if it has already crossed the presentation.
      const nextPosition = Math.min(previousPosition, motionTarget);
      gapRef.current = motionTarget - nextPosition;
      gapVelocityRef.current = clampGapVelocity(
        gapRef.current,
        gapVelocityRef.current,
        springOmega,
      );
    } else if (directPosition > maxSize) {
      const nextPosition = Math.max(previousPosition, motionTarget);
      gapRef.current = motionTarget - nextPosition;
      gapVelocityRef.current = clampGapVelocity(
        gapRef.current,
        gapVelocityRef.current,
        springOmega,
      );
    }
    motionTargetRef.current = motionTarget;
    presentedGap = gapRef.current;
  } else {
    motionTargetRef.current = motionTarget;
  }

  useLayoutEffect(() => {
    if (!enabled) {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      gapVelocityRef.current = 0;
      setAnimatedGap(null);
      return;
    }
    if (!command || command === consumedCommandRef.current) return;

    const wasActive = frameRef.current !== null;
    consumedCommandRef.current = command;
    const fromSize = clamp(
      command.fromSize,
      collapsedSizeRef.current,
      maxSizeRef.current,
    );
    const commandTarget = clamp(
      command.targetSize,
      collapsedSizeRef.current,
      maxSizeRef.current,
    );
    const gap = commandTarget - fromSize;
    gapRef.current = gap;
    motionTargetRef.current = commandTarget;
    // A semantic reversal is a new physical impulse. Keep the current
    // position, but point velocity toward the newly selected state at once;
    // preserving wrong-way momentum is what makes reversals feel mushy.
    gapVelocityRef.current = -gap * THRESHOLD_SPRING_INITIAL_VELOCITY;
    if (!command.collapsed) expandedTargetRef.current = commandTarget;
    const startTime = performance.now();
    lastTimeRef.current = startTime;
    motionStartTimeRef.current = startTime;
    setAnimatedGap(gap);

    const update = () => {
      const time = performance.now();
      if (time - motionStartTimeRef.current >= durationMs) {
        frameRef.current = null;
        gapRef.current = 0;
        gapVelocityRef.current = 0;
        setAnimatedGap(null);
        return;
      }
      const elapsed = Math.min(
        1 / 30,
        Math.max(0, (time - lastTimeRef.current) / 1_000),
      );
      lastTimeRef.current = time;
      const target = clamp(
        motionTargetRef.current,
        collapsedSizeRef.current,
        maxSizeRef.current,
      );
      const gap = gapRef.current;
      const velocity = gapVelocityRef.current;
      const springTerm = velocity + springOmega * gap;
      const decay = Math.exp(-springOmega * elapsed);
      let nextGap = (gap + springTerm * elapsed) * decay;
      let nextVelocity =
        (velocity - springOmega * springTerm * elapsed) * decay;
      const unclampedPosition = target - nextGap;
      const nextPosition = clamp(
        unclampedPosition,
        collapsedSizeRef.current,
        maxSizeRef.current,
      );
      if (nextPosition !== unclampedPosition) {
        nextGap = target - nextPosition;
      }
      if (
        (nextPosition <= collapsedSizeRef.current && nextVelocity > 0) ||
        (nextPosition >= maxSizeRef.current && nextVelocity < 0)
      ) {
        nextVelocity = 0;
      }
      gapRef.current = nextGap;
      gapVelocityRef.current = nextVelocity;

      if (Math.abs(nextGap) <= 0.1 && Math.abs(nextVelocity) <= 1) {
        frameRef.current = null;
        gapRef.current = 0;
        gapVelocityRef.current = 0;
        setAnimatedGap(null);
        return;
      }

      setAnimatedGap(nextGap);
      frameRef.current = requestAnimationFrame(update);
    };

    if (!wasActive) frameRef.current = requestAnimationFrame(update);
  }, [command, enabled, durationMs, springOmega]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  return {
    active: hasPendingCommand || animatedGap !== null,
    size: hasPendingCommand
      ? clamp(command.fromSize, collapsedSize, maxSize)
      : animatedGap === null
        ? null
        : clamp(motionTarget - presentedGap, collapsedSize, maxSize),
  };
}

function clampGapVelocity(
  gap: number,
  velocity: number,
  springOmega: number,
): number {
  if (gap > 0) {
    return Math.min(0, Math.max(velocity, -springOmega * gap));
  }
  if (gap < 0) {
    return Math.max(0, Math.min(velocity, -springOmega * gap));
  }
  return 0;
}
