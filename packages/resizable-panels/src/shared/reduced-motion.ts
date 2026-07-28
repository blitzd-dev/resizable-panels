import { useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

let mediaQuery: MediaQueryList | null = null;
const subscribers = new Set<() => void>();

function getMediaQuery(): MediaQueryList | null {
  if (mediaQuery) return mediaQuery;
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return null;
  }
  mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  return mediaQuery;
}

function notifySubscribers() {
  for (const subscriber of subscribers) subscriber();
}

function subscribe(subscriber: () => void): () => void {
  const query = getMediaQuery();
  if (!query) return () => {};

  subscribers.add(subscriber);
  if (subscribers.size === 1) {
    query.addEventListener("change", notifySubscribers);
  }
  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      query.removeEventListener("change", notifySubscribers);
    }
  };
}

function getSnapshot(): boolean {
  return getMediaQuery()?.matches ?? false;
}

/** One shared browser media-query subscription feeds every provider. The
 * server snapshot deliberately stays false so hydration starts from the same
 * transition declarations as SSR; React synchronizes the real preference
 * before any user-driven panel motion can begin. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
