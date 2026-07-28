import { type Ref, version as reactVersion } from "react";

// React 19 invokes a cleanup function returned from a callback ref; React 18
// dev mode instead warns "a callback ref should not return a function", so
// the cleanup return is gated and React 18 detaches through the null call.
const supportsRefCleanup = !reactVersion.startsWith("18.");

/**
 * Compose an internal ref with a consumer-forwarded ref into one callback
 * ref that supports both React ref protocols:
 *
 * - React 19 invokes the cleanup function our callback returns; consumer
 *   callback refs that themselves return cleanups have those cleanups
 *   retained and invoked (they never receive a null call).
 * - React 18 ignores the return value and calls the callback with `null`
 *   on detach; consumer callback refs without cleanups keep their
 *   conventional null-detach call, and object refs are reset to null.
 */
export function composeRefs<T>(
  ...refs: readonly (Ref<T> | undefined)[]
): (value: T | null) => (() => void) | undefined {
  let detach: (() => void) | null = null;
  return (value: T | null) => {
    if (value === null) {
      // React 18 detach protocol.
      detach?.();
      return undefined;
    }
    // Defensive: a re-attach without an intervening detach (ref identity
    // swap) must not leak the previous attachment.
    detach?.();
    const cleanups = refs.map((ref) => attachRef(ref, value));
    detach = () => {
      detach = null;
      for (const cleanup of cleanups) cleanup();
    };
    // React 19 detach protocol; React 18 uses the null call above instead
    // and warns in dev when a callback ref returns a function.
    return supportsRefCleanup ? detach : undefined;
  };
}

function attachRef<T>(ref: Ref<T> | undefined, value: T): () => void {
  if (typeof ref === "function") {
    const cleanup = ref(value);
    if (typeof cleanup === "function") return cleanup;
    return () => ref(null);
  }
  if (ref) {
    ref.current = value;
    return () => {
      ref.current = null;
    };
  }
  return () => {};
}
