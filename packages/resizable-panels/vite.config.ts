/// <reference types="vitest/config" />
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import preserveDirectives from "rollup-preserve-directives";
import { defineConfig } from "vite";

export default defineConfig({
  // Preserve the conventional NODE_ENV check in the published ESM so the
  // consuming application's bundler, not this library build, chooses whether
  // to retain development diagnostics.
  keepProcessEnv: true,
  test: {
    // Unit tests only. e2e/**/*.spec.ts are Playwright specs with their own
    // runner (playwright.config.ts) — vitest must not pick them up.
    include: ["src/**/*.test.{ts,tsx}"],
  },
  plugins: [react(), preserveDirectives()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
    },
    sourcemap: true,
    // Ship readable, per-module ESM and let downstream builds minify. A
    // flattened single-module bundle materially defeats consumer tree
    // shaking: narrow imports retain unrelated context creation and React
    // implementation (§6).
    minify: false,
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
      },
    },
  },
});
