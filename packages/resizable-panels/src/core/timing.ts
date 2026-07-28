/**
 * Central home for the library's timing constants (R-11). Every deliberate
 * time window lives here under a name that says what it does, so the values
 * can be audited in one place and the test arena can stretch them
 * deliberately. Values are load-bearing: changing one changes observable
 * behavior — each constant documents what depends on it.
 */

/** Default duration of the panel size transition. Also drives the spring
 * stiffness and settle cutoff of the collapse-threshold presentation motion
 * in `panel.tsx`, so the JS-driven motion and the CSS transition stay in
 * step. Overridable per group via `<PanelGroup animation>` (R-16); the
 * resolved per-group value flows through `resolvePanelAnimation` below.
 * e2e specs do not hardcode this value (they wait via `getAnimations()`),
 * but they do assume transitions finish in well under their poll timeouts. */
export const PANEL_TRANSITION_MS = 300;

/** Default easing of the panel size transition. Overridable per group via
 * `<PanelGroup animation.easing>`. */
export const PANEL_TRANSITION_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

/** Default CSS transition shorthand (duration + easing) applied to panel
 * size and flex-basis changes. Derived from `PANEL_TRANSITION_MS`. */
export const PANEL_TRANSITION = `${PANEL_TRANSITION_MS}ms ${PANEL_TRANSITION_EASING}`;

/** One group's resolved animation settings (R-16). Derived once per
 * `<PanelGroup>` from its `animation` prop; every library-owned panel
 * transition and the threshold-motion spring in that group read from it. */
export type ResolvedPanelAnimation = {
  /** False when the group passed `animation={false}`: all library-owned
   * panel transitions and the threshold spring are disabled. */
  enabled: boolean;
  /** Transition duration in milliseconds; also the threshold spring's
   * stiffness/settle basis. */
  durationMs: number;
  /** CSS easing keyword or function. */
  easing: string;
  /** `"<durationMs>ms <easing>"` — the shorthand panels append to their
   * transitioned property. */
  transition: string;
};

/**
 * Resolve a group's `animation` prop into effective settings. Pure so the
 * fallback behavior is unit-testable: an invalid duration (non-finite or
 * ≤ 0) or easing (non-string or blank) falls back to the library default —
 * the caller compares resolved values against its inputs to emit the
 * matching dev warnings. `disabled` reflects `animation={false}`; the
 * default duration/easing are still resolved so dependent math (spring
 * omega) stays well-defined.
 */
export function resolvePanelAnimation(
  disabled: boolean,
  durationMs: number | undefined,
  easing: string | undefined,
): ResolvedPanelAnimation {
  const validDuration =
    typeof durationMs === "number" &&
    Number.isFinite(durationMs) &&
    durationMs > 0;
  const validEasing = typeof easing === "string" && easing.trim().length > 0;
  const resolvedDurationMs = validDuration ? durationMs : PANEL_TRANSITION_MS;
  const resolvedEasing = validEasing ? easing : PANEL_TRANSITION_EASING;
  return {
    enabled: !disabled,
    durationMs: resolvedDurationMs,
    easing: resolvedEasing,
    transition: `${resolvedDurationMs}ms ${resolvedEasing}`,
  };
}

/** The default resolved animation — what a group without an `animation`
 * prop uses. */
export const DEFAULT_PANEL_ANIMATION: ResolvedPanelAnimation =
  resolvePanelAnimation(false, undefined, undefined);

/** How long after the last group-element resize observation the group waits
 * before declaring the container resize over (`panel-group.tsx` observer).
 * While the window is open, panel transitions are suppressed so layout
 * tracks the container frame-by-frame; closing it too early makes panels
 * animate against a still-moving container. */
export const CONTAINER_RESIZE_IDLE_MS = 150;

/** Debounce for persistence write-back (`panel-group.tsx`): store
 * notifications within this window coalesce into one storage write. Guards
 * the C6 contract that writes happen at meaningful lifecycle moments rather
 * than on every frame of a drag (drag frames are additionally gated by the
 * session's write gate, flushed on release). */
export const PERSISTENCE_WRITE_DEBOUNCE_MS = 200;

/** Pointer movement (px) that separates a click from a drag. Until a
 * pointer session's first move exceeds this distance from the pointer-down
 * origin, the press classifies as a click: the resize lifecycle stays
 * unarmed (R-03) and the post-release compatibility click is not
 * suppressed. Once crossed, every subsequent move is delivered — the gate
 * never re-arms mid-session (R-19). Not a duration, but it lives here with
 * the other deliberate interaction-tuning constants (R-11). */
export const POINTER_CLICK_DRAG_THRESHOLD_PX = 2;

/** Dead-band (px) for detecting a genuine direction reversal in a
 * `cascade="latching"` pointer session (`panel-group.tsx` `moveResize`,
 * R-25). A retreat from the directional extreme within this distance keeps
 * computing from the current session origin (reversible micro-unwind), so
 * pointer jitter never latches; a retreat beyond it rebases the session at
 * the extreme — no space is lost to the band. Derived from the
 * click-vs-drag threshold: both classify "did the pointer really move". */
export const CASCADE_LATCH_DEAD_BAND_PX = POINTER_CLICK_DRAG_THRESHOLD_PX;
