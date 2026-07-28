import type { InternalPanelControls } from "../types.js";

/**
 * The user-facing collapsed state of a panel (R-33): the controlled
 * `collapsed` prop when the panel is controlled, else its locally committed
 * state. Every REPORTED layout (getValue, emitted group values, resize
 * events, persistence write-back) pins controlled panels to this value —
 * the prop stays authoritative even while a live gesture presents a
 * threshold crossing. Geometry consumers (allocation, capacity models,
 * session snapshots) deliberately keep reading `controls.collapsed`, the
 * presentation truth.
 */
export function effectiveCollapsed(controls: InternalPanelControls): boolean {
  return controls.controlledCollapsed ?? controls.collapsed;
}

/** Effective collapse INCLUDING a width-driven auto-fold (R-37). Used where a
 * user interacts with what they SEE (handle Enter), never for the persisted
 * group value, which stays the stored preference. */
export function shownCollapsed(controls: InternalPanelControls): boolean {
  return (
    controls.controlledCollapsed ??
    (controls.collapsed || controls.autoCollapsed)
  );
}
