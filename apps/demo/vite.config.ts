import { existsSync } from "node:fs";
import path from "node:path";
import type { Connect, Plugin } from "vite";
import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import remarkGfm from "remark-gfm";
import { defineConfig } from "vite";

/**
 * Vite's preview SPA fallback serves `/index.html` for extensionless paths
 * that aren't directories-with-trailing-slash. Prerender writes
 * `docs/foo/index.html`, so `/docs/foo` (no slash) would otherwise paint the
 * home shell, then client-route to docs — the reload flash.
 */
function prerenderCleanUrls(): Plugin {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    const raw = req.url ?? "/";
    const q = raw.indexOf("?");
    const pathname = decodeURIComponent(q === -1 ? raw : raw.slice(0, q));
    const search = q === -1 ? "" : raw.slice(q);
    if (
      pathname === "/" ||
      pathname.endsWith("/") ||
      pathname.includes(".")
    ) {
      next();
      return;
    }

    const outDir = path.resolve(demoRoot, "dist");
    const nestedIndex = path.join(outDir, pathname.slice(1), "index.html");
    if (existsSync(nestedIndex)) {
      // Trailing slash lets sirv serve the directory index before SPA fallback.
      req.url = `${pathname}/${search}`;
    }
    next();
  };

  return {
    name: "prerender-clean-urls",
    configurePreviewServer(server) {
      // Register before Vite's internal SPA fallback.
      server.middlewares.use(rewrite);
    },
  };
}

const demoRoot = path.resolve(import.meta.dirname);

function vendorChunk(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;

  if (
    id.includes("/react/") ||
    id.includes("/react-dom/") ||
    id.includes("/scheduler/")
  ) {
    return "react-vendor";
  }
  if (id.includes("react-router")) return "router";
  if (
    id.includes("/motion/") ||
    id.includes("framer-motion") ||
    id.includes("motion-dom")
  ) {
    return "motion";
  }
  if (id.includes("@base-ui") || id.includes("@floating-ui")) return "base-ui";
  if (
    id.includes("shiki") ||
    id.includes("@shikijs") ||
    id.includes("oniguruma")
  ) {
    return "shiki";
  }
  if (id.includes("lucide-react")) return "icons";
  return "vendor";
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    { enforce: "pre", ...mdx({ remarkPlugins: [remarkGfm] }) },
    react({ include: /\.(jsx|js|mdx|md|tsx|ts)$/ }),
    tailwindcss(),
    {
      name: "css-before-modules",
      transformIndexHtml(html) {
        // Vite emits module scripts before the stylesheet. Prerendered HTML
        // needs CSS first so mx-auto / max-w centering apply on first paint.
        const stylesheet =
          html.match(/<link\s+rel="stylesheet"[^>]*>/)?.[0] ?? null;
        if (!stylesheet) return html;
        const without = html.replace(stylesheet, "");
        return without.replace("</title>", `</title>\n    ${stylesheet}`);
      },
    },
    prerenderCleanUrls(),
  ],
  resolve: {
    alias: {
      // Workspace dep: resolve to source so demo HMRs against live lib edits
      // without needing a build step. The published package.json `exports`
      // still point at ./dist for consumers.
      "@blitzd/resizable-panels": path.resolve(
        __dirname,
        "../../packages/resizable-panels/src/index.ts",
      ),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Don't let vite pre-bundle the workspace package — we want the live source
  // resolved through the alias above, not a cached bundle.
  optimizeDeps: {
    exclude: ["@blitzd/resizable-panels"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          return vendorChunk(id);
        },
      },
    },
    // Docs + demos legitimately exceed the default advisory threshold even
    // after splitting; keep the warning useful for regressions past 1 MB.
    chunkSizeWarningLimit: 1000,
  },
  server: {
    fs: {
      // Allow vite to serve files from the package source (outside the demo dir).
      allow: [path.resolve(__dirname, "../..")],
    },
  },
});
