import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Dev-server config for the e2e harness (NOT the library build — that's
 * ../vite.config.ts). Playwright's webServer starts this; it serves the
 * fixture pages under /test/* via the SPA fallback.
 */
const require = createRequire(import.meta.url);
const useReact18 = process.env.RESIZABLE_PANELS_REACT_VERSION === "18";
const react18Root = useReact18
  ? dirname(require.resolve("react18/package.json"))
  : null;
const reactDom18Root = useReact18
  ? dirname(require.resolve("react-dom18/package.json"))
  : null;

// The npm aliases let the browser bundle test React 18 without replacing the
// workspace's React 19 install. React DOM's external CommonJS server renderer
// still calls `require("react")` itself, so bind only that package's peer
// resolution to the same alias for the SSR fixture.
if (react18Root && reactDom18Root) {
  const NodeModule = require("node:module") as {
    _resolveFilename: (
      request: string,
      parent: { filename?: string } | undefined,
      isMain: boolean,
      options?: unknown,
    ) => string;
  };
  const resolveFilename = NodeModule._resolveFilename;
  NodeModule._resolveFilename = (request, parent, isMain, options) => {
    if (request === "react" && parent?.filename?.startsWith(reactDom18Root)) {
      return resolve(react18Root, "index.js");
    }
    return resolveFilename(request, parent, isMain, options);
  };
}

const react18Aliases =
  react18Root && reactDom18Root
    ? [
        {
          find: "react/jsx-dev-runtime",
          replacement: "react18/jsx-dev-runtime",
        },
        {
          find: "react/jsx-runtime",
          replacement: "react18/jsx-runtime",
        },
        { find: "react", replacement: "react18" },
        {
          find: "react-dom/client",
          replacement: "react-dom18/client",
        },
        {
          find: "react-dom",
          replacement: "react-dom18",
        },
      ]
    : [];

const react18SsrBridge = {
  name: "react18-ssr-cjs-bridge",
  enforce: "pre" as const,
  resolveId(
    id: string,
    _importer: string | undefined,
    options: { ssr?: boolean },
  ) {
    if (!useReact18 || !options.ssr) return null;
    if (id === "react18" || id === resolve(react18Root!, "index.js")) {
      return "\0react18-ssr";
    }
    if (
      id === "react18/jsx-runtime" ||
      id === resolve(react18Root!, "jsx-runtime.js")
    ) {
      return "\0react18-jsx-runtime-ssr";
    }
    if (
      id === "react18/jsx-dev-runtime" ||
      id === resolve(react18Root!, "jsx-dev-runtime.js")
    ) {
      return "\0react18-jsx-dev-runtime-ssr";
    }
    return null;
  },
  load(id: string) {
    if (id === "\0react18-ssr") {
      return `import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const React = require("react18");
export default React;
export const { Children, Component, Fragment, Profiler, PureComponent, StrictMode, Suspense, cloneElement, createContext, createElement, createFactory, createRef, forwardRef, isValidElement, lazy, memo, startTransition, useCallback, useContext, useDebugValue, useDeferredValue, useEffect, useId, useImperativeHandle, useInsertionEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, useTransition, version } = React;`;
    }
    if (id === "\0react18-jsx-runtime-ssr") {
      return `import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const runtime = require("react18/jsx-runtime");
export const { Fragment, jsx, jsxs } = runtime;`;
    }
    if (id === "\0react18-jsx-dev-runtime-ssr") {
      return `import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const runtime = require("react18/jsx-dev-runtime");
export const { Fragment, jsxDEV } = runtime;`;
    }
    return null;
  },
};

export default defineConfig({
  root: resolve(__dirname, "harness"),
  plugins: [
    react18SsrBridge,
    react(),
    {
      name: "accessibility-ssr-fixture",
      configureServer(server) {
        server.middlewares.use(
          "/test/accessibility-motion-ssr",
          async (request, response, next) => {
            try {
              const url = new URL(request.url ?? "/", "http://localhost");
              const { renderAccessibilitySsr } =
                await server.ssrLoadModule("/ssr.tsx");
              const markup = renderAccessibilitySsr(
                url.searchParams.get("collapsed") !== "0",
              );
              const hydrate = url.searchParams.get("hydrate") !== "0";
              response.statusCode = 200;
              response.setHeader("Content-Type", "text/html; charset=utf-8");
              const html = `<!doctype html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body><div id="root">${markup}</div>${
                hydrate
                  ? `<script>window.__hydrationErrors=[];const originalError=console.error;console.error=(...args)=>{window.__hydrationErrors.push(args.map(String).join(" "));originalError(...args)};</script><script type="module" src="/main.tsx"></script>`
                  : ""
              }</body></html>`;
              response.end(
                await server.transformIndexHtml(
                  "/test/accessibility-motion-ssr",
                  html,
                ),
              );
            } catch (error) {
              next(error);
            }
          },
        );
      },
    },
  ],
  resolve: {
    alias: [
      ...react18Aliases,
      // Resolve the package specifier to live source so the suite tests
      // the current working tree, not a stale dist build.
      {
        find: "@blitzd/resizable-panels",
        replacement: resolve(__dirname, "../src/index.ts"),
      },
    ],
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    exclude: ["@blitzd/resizable-panels"],
  },
  server: {
    fs: {
      // The harness root is e2e/harness; allow serving ../src through it.
      allow: [resolve(__dirname, "../../..")],
    },
  },
});
