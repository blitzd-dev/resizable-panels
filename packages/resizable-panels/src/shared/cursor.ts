import type { PanelGroupOrientation } from "../types.js";

export function resizeCursor(direction: PanelGroupOrientation) {
  return direction === "horizontal" ? "col-resize" : "row-resize";
}

export function resizeLimitCursor(
  direction: PanelGroupOrientation,
  screenDelta: number,
) {
  if (screenDelta === 0) return resizeCursor(direction);
  if (direction === "horizontal") {
    return screenDelta > 0 ? "w-resize" : "e-resize";
  }
  return screenDelta > 0 ? "n-resize" : "s-resize";
}
