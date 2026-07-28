import { useSyncExternalStore } from "react";

/**
 * Module-level viewport invalidation, mirroring reduced-motion.ts: one
 * `window` resize listener feeds every subscriber, no matter how many
 * providers — explicit or implicit (§14) — are mounted. The tick is a
 * monotonic counter; its only meaning is "vw/vh-relative sizes must
 * re-resolve", so consumers read it for the subscription side effect.
 */

let tick = 0;
const subscribers = new Set<() => void>();

function onResize() {
  tick += 1;
  for (const subscriber of subscribers) subscriber();
}

function subscribe(subscriber: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  subscribers.add(subscriber);
  if (subscribers.size === 1) window.addEventListener("resize", onResize);
  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) window.removeEventListener("resize", onResize);
  };
}

function getSnapshot(): number {
  return tick;
}

/** Re-render the caller on every window resize. The server snapshot stays 0
 * so hydration matches SSR; the first client resize event re-resolves. */
export function useViewportTick(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
