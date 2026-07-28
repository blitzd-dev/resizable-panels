"use client";

import { useEffect, useRef } from "react";
import { IS_DEVELOPMENT } from "./runtime-mode.js";

export { IS_DEVELOPMENT } from "./runtime-mode.js";

const PREFIX = "[@blitzd/resizable-panels]";
export const NO_WARNINGS: readonly null[] = [];

/** Development-only diagnostic. Consumer bundlers fold NODE_ENV so their
 * production output can remove both the branch and message. */
export function warnDev(message: string): void {
  if (!IS_DEVELOPMENT) return;
  console.warn(`${PREFIX} ${message}`);
}

/** Development-only error diagnostic for misconfiguration that materially
 * changes layout meaning (e.g. a required size that could not be used). */
export function errorDev(message: string): void {
  if (!IS_DEVELOPMENT) return;
  console.error(`${PREFIX} ${message}`);
}

/** Warn once per mounted component for each distinct message. Keeping the
 * de-duplication local means separate providers still report their own
 * invalid configuration while React Strict Mode does not double-log it. */
export function useDevWarnings(messages: readonly (string | null)[]): void {
  const warnedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!IS_DEVELOPMENT) return;
    for (const message of messages) {
      if (!message || warnedRef.current.has(message)) continue;
      warnedRef.current.add(message);
      warnDev(message);
    }
  }, [messages]);
}
