declare const process: { env: { NODE_ENV?: string } } | undefined;

// Keep the conventional NODE_ENV expression in the published ESM. Consumer
// bundlers can replace and fold it, while process-less runtimes retain
// development diagnostics instead of failing during module evaluation.
export const IS_DEVELOPMENT =
  typeof process === "undefined" || process.env.NODE_ENV !== "production";
