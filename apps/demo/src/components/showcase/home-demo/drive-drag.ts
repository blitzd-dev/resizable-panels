import type {
  PanelActionDispatcher,
  PanelLocator,
} from "@blitzd/resizable-panels";
import { clamp } from "@/lib/utils";
import type { FakeCursorHandle } from "./fake-cursor";

/**
 * Scripted "user drags the seam" gesture for the hero demo.
 *
 * Deliberately does NOT dispatch synthetic mouse events into the library's
 * real drag session: that session ends the moment any trusted mousemove
 * arrives with no buttons held (its released-off-screen safety net), so a
 * visitor idly moving their mouse would kill the gesture mid-drag — and a
 * real session also flips the page-wide body cursor. Instead this issues a
 * clamped imperative `setSize` per frame, with the fake cursor glued to
 * the seam by construction. Visually near-identical, and immune to real
 * user input.
 */
export type DriveDragOptions = {
  /** Element containing the live panel layout; seam lookup root. */
  container: HTMLElement;
  cursor: FakeCursorHandle;
  actions: PanelActionDispatcher;
  target: PanelLocator;
  /** Target panel size in px; the gesture drags until the panel reaches it. */
  toSize: number;
  /** Leave the cursor on screen after release (next step is also a drag). */
  keepCursor?: boolean;
  signal: AbortSignal;
};

export type DriveClickOptions = {
  /** Element containing the visible control; target lookup root. */
  container: HTMLElement;
  cursor: FakeCursorHandle;
  /** Selector for the control the cursor should visibly activate. */
  selector: string;
  /** Runs at the bottom of the fake click, while the cursor is pressed. */
  activate: () => void;
  signal: AbortSignal;
};

// Gestures own the shared cursor one at a time. A stale gesture's abort
// cleanup (scene crossfade, unmount) must not hide a cursor that a newer
// gesture has already picked up.
let gestureEpoch = 0;

/**
 * Scripted pointer click for panel controls in the hero demo. The control is
 * real and remains usable by visitors; autoplay invokes the scene command at
 * the same point in the gesture instead of dispatching a synthetic event.
 */
export async function driveClick(opts: DriveClickOptions): Promise<void> {
  const { container, cursor, selector, activate, signal } = opts;
  const epoch = ++gestureEpoch;
  const target = container.querySelector<HTMLElement>(selector);

  // Keep the scene deterministic even if a responsive layout temporarily
  // removes its visual control.
  if (!target) {
    activate();
    return;
  }

  const rect = target.getBoundingClientRect();
  const point = {
    // Aim slightly off-center so the pointer tip doesn't obscure the icon.
    x: rect.left + rect.width * 0.62,
    y: rect.top + rect.height * 0.58,
  };

  try {
    if (!cursor.isVisible()) {
      const entry = clampIntoRect(
        { x: point.x + 54, y: point.y + 38 },
        container.getBoundingClientRect(),
        14,
      );
      cursor.placeAt(entry.x, entry.y);
      cursor.setGlyph("pointer");
      cursor.setVisible(true);
      await sleep(80, signal);
    }

    await travelTo(cursor, point, signal);
    target.setAttribute("data-fake-active", "");
    await sleep(150, signal);

    cursor.setPressed(true);
    await sleep(110, signal);
    activate();
    await sleep(110, signal);

    cursor.setPressed(false);
    target.removeAttribute("data-fake-active");
    await sleep(220, signal);
    cursor.setVisible(false);
  } catch (err) {
    target.removeAttribute("data-fake-active");
    if (epoch === gestureEpoch) {
      cursor.setPressed(false);
      cursor.setGlyph("pointer");
      cursor.setVisible(false);
    }
    throw err;
  }
}

export async function driveDrag(opts: DriveDragOptions): Promise<void> {
  const { container, cursor, actions, target, toSize, keepCursor, signal } =
    opts;
  const epoch = ++gestureEpoch;

  const panelEl = container.querySelector<HTMLElement>(
    `[data-resizable-panels-panel-id="${target.panelId}"]`,
  );
  const handleEl = panelEl?.querySelector<HTMLElement>(
    "[data-resizable-panels-resize-handle]",
  );
  if (!panelEl || !handleEl) {
    // Panel closed or not mounted: still converge to the scripted state so
    // the rest of the scene plays out from the sizes it expects.
    actions.setSize(target, toSize);
    return;
  }

  const horizontal = panelEl.dataset.axis === "horizontal";
  // Screen direction the seam moves when this panel grows: a start-side
  // panel's seam is its far edge (moves right/down, +1); an end-side
  // panel's seam is its near edge (moves left/up, -1).
  const sign = panelEl.dataset.side === "start" ? 1 : -1;

  const handleRect = handleEl.getBoundingClientRect();
  // Grab slightly off the seam's midpoint — dead center reads robotic.
  const grab = horizontal
    ? {
        x: handleRect.left + handleRect.width / 2,
        y: handleRect.top + handleRect.height * 0.44,
      }
    : {
        x: handleRect.left + handleRect.width * 0.44,
        y: handleRect.top + handleRect.height / 2,
      };

  const panelRect = panelEl.getBoundingClientRect();
  // Client rects are visual px; the scene may sit inside a scaled "zoomed
  // out" wrapper while setSize speaks layout px. Derive the scale from the
  // panel itself so fromSize lands in the same unit as toSize.
  const scale = panelEl.offsetWidth ? panelRect.width / panelEl.offsetWidth : 1;
  const fromSize = (horizontal ? panelRect.width : panelRect.height) / scale;
  const seamTravel = sign * (toSize - fromSize);

  try {
    if (!cursor.isVisible()) {
      const entry = clampIntoRect(
        { x: grab.x + 56, y: grab.y + 44 },
        container.getBoundingClientRect(),
        14,
      );
      cursor.placeAt(entry.x, entry.y);
      cursor.setVisible(true);
      await sleep(80, signal);
    }

    await travelTo(cursor, grab, signal);

    // Arrived: swap to the resize glyph and light the seam the way a real
    // hover would.
    cursor.setGlyph(horizontal ? "col-resize" : "row-resize");
    handleEl.setAttribute("data-fake-active", "");
    await sleep(170, signal);

    cursor.setPressed(true);
    await sleep(140, signal);

    const duration = clamp(480 + Math.abs(seamTravel) * 2.5, 550, 950);
    await tween(duration, easeInOutCubic, signal, (p) => {
      actions.setSize(target, fromSize + (toSize - fromSize) * p);
      // Pin the cursor to the seam's real position rather than dead-
      // reckoning from toSize: when the layout clamps the panel (over-
      // constrained container on narrow viewports), the seam saturates
      // early and a dead-reckoned cursor would drift off it. The one-frame
      // commit lag behind setSize is imperceptible. The cross-axis drift
      // keeps the hand from tracking a laser line.
      const r = handleEl.getBoundingClientRect();
      const drift = Math.sin(p * Math.PI) * 2.5;
      if (horizontal) cursor.placeAt(r.left + r.width / 2, grab.y + drift);
      else cursor.placeAt(grab.x + drift, r.top + r.height / 2);
    });

    await sleep(160, signal);
    // Settle exactly on the seam now that the final size has committed.
    const settled = handleEl.getBoundingClientRect();
    if (horizontal) cursor.placeAt(settled.left + settled.width / 2, grab.y);
    else cursor.placeAt(grab.x, settled.top + settled.height / 2);
    cursor.setPressed(false);
    await sleep(120, signal);
    handleEl.removeAttribute("data-fake-active");
    cursor.setGlyph("pointer");

    if (!keepCursor) {
      await sleep(200, signal);
      cursor.setVisible(false);
    }
  } catch (err) {
    // Aborted mid-gesture (pause-by-unmount, scene crossfade). Scene-scoped
    // state is always ours to restore; the shared cursor only if no newer
    // gesture has claimed it.
    handleEl.removeAttribute("data-fake-active");
    if (epoch === gestureEpoch) {
      cursor.setPressed(false);
      cursor.setGlyph("pointer");
      cursor.setVisible(false);
    }
    throw err;
  }
}

/** Eased hop to a point along a subtle perpendicular arc — straight-line
 *  cursor travel is the single biggest "that's a robot" tell. */
async function travelTo(
  cursor: FakeCursorHandle,
  target: { x: number; y: number },
  signal: AbortSignal,
): Promise<void> {
  const from = cursor.position();
  if (!from) {
    cursor.placeAt(target.x, target.y);
    return;
  }
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return;
  const arc = Math.min(26, dist * 0.18);
  const cx = from.x + dx / 2 - (dy / dist) * arc;
  const cy = from.y + dy / 2 + (dx / dist) * arc;
  const duration = clamp(dist * 1.5, 340, 650);
  await tween(duration, easeOutCubic, signal, (p) => {
    const u = 1 - p;
    cursor.placeAt(
      u * u * from.x + 2 * u * p * cx + p * p * target.x,
      u * u * from.y + 2 * u * p * cy + p * p * target.y,
    );
  });
}

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function tween(
  duration: number,
  ease: (t: number) => number,
  signal: AbortSignal,
  onUpdate: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const start = performance.now();
    let raf = 0;
    const onAbort = () => {
      cancelAnimationFrame(raf);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      onUpdate(ease(t));
      if (t < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }
    };
    raf = requestAnimationFrame(frame);
  });
}

const abortError = () => new DOMException("gesture aborted", "AbortError");

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

function clampIntoRect(
  p: { x: number; y: number },
  rect: DOMRect,
  inset: number,
): { x: number; y: number } {
  return {
    x: clamp(p.x, rect.left + inset, rect.right - inset),
    y: clamp(p.y, rect.top + inset, rect.bottom - inset),
  };
}
