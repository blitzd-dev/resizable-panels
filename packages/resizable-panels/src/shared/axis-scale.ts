import type { PanelGroupOrientation } from "../types.js";

/** Visual px painted per CSS layout px along `orientation` — 1 everywhere
 * except inside a scaled ancestor (`transform: scale()`, a zoomed preview).
 * Group layout runs in layout px, but `getBoundingClientRect` and pointer
 * coordinates arrive in visual px; geometry crossing that boundary divides
 * by this so a scaled group's seams still track the pointer 1:1 and resize
 * limits stay in the layout unit that min/max configs use.
 *
 * Measured as rect-size over `offset*` size. `offset*` rounds to whole px,
 * so a gap of ≤ 0.5px is indistinguishable from an untransformed element
 * with a fractional layout size and snaps to exactly 1 — untransformed
 * layouts keep subpixel-exact behavior at any element size, and a real
 * scale that close to 1 is sub-half-pixel across the whole element anyway.
 * Callers still pass the largest available element sharing the transform
 * (the group container) so genuine scales resolve with minimal rounding
 * error. Returns 1 when unmeasurable (detached, display:none, jsdom). */
export function readAxisScale(
  element: HTMLElement | null | undefined,
  orientation: PanelGroupOrientation,
): number {
  if (!element) return 1;
  const rect = element.getBoundingClientRect();
  const visual = orientation === "horizontal" ? rect.width : rect.height;
  const layout =
    orientation === "horizontal" ? element.offsetWidth : element.offsetHeight;
  if (!visual || !layout) return 1;
  if (Math.abs(visual - layout) <= 0.5) return 1;
  const scale = visual / layout;
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return scale;
}
