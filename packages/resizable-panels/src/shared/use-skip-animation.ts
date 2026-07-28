"use client";

import { useEffect, useState } from "react";

/**
 * A boolean flag that auto-clears two requestAnimationFrames after being
 * set to true. Used to suppress CSS transitions for the next paint while
 * a synchronous state change ripples through dependent effects — e.g. a
 * force-close that should snap the whole layout instead of animating, or
 * a lazy-resolved default size that would otherwise visibly slide in
 * from 0.
 *
 * Two rAFs (not one) because the trigger commit and the cascading
 * auto-distribute commit can land in separate frames; the flag must
 * stay raised through both.
 */
export function useSkipAnimation(): readonly [
  boolean,
  (skip: boolean) => void,
] {
  const [skip, setSkip] = useState(false);
  useEffect(() => {
    if (!skip) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setSkip(false));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [skip]);
  return [skip, setSkip];
}
