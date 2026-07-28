/**
 * Post-build prerender: serve `dist/`, visit public routes, write static HTML
 * (and docs Markdown) so crawlers/LLMs see real content without executing JS.
 */
import { execSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { chromium } from "playwright";
import handler from "serve-handler";
import { absoluteUrl } from "../src/lib/site.ts";

const demoRoot = fileURLToPath(new URL("..", import.meta.url));
const distDir = path.join(demoRoot, "dist");

async function loadRouteMeta() {
  return import("../src/lib/route-meta.ts");
}

async function loadDocsToMarkdown() {
  return import("../src/lib/docs-to-markdown.ts");
}

async function loadDocMeta() {
  return import("../src/pages/docs/doc-meta.ts");
}

function distFileForPath(routePath) {
  if (routePath === "/") return path.join(distDir, "index.html");
  const trimmed = routePath.replace(/^\//, "").replace(/\/$/, "");
  return path.join(distDir, trimmed, "index.html");
}

function upsertHead(html, { title, description, canonical, noindex }) {
  let next = html;
  next = next.replace(
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(title)}</title>`,
  );

  const robots = noindex ? "noindex, nofollow" : "index, follow";
  next = replaceOrInsertMeta(next, 'name="description"', description);
  next = replaceOrInsertMeta(next, 'name="robots"', robots);
  next = replaceOrInsertMeta(next, 'property="og:title"', title);
  next = replaceOrInsertMeta(next, 'property="og:description"', description);
  next = replaceOrInsertMeta(next, 'property="og:url"', canonical);
  next = replaceOrInsertLink(next, "canonical", canonical);
  return next;
}

function replaceOrInsertMeta(html, attrMatcher, content) {
  const re = new RegExp(`<meta\\s+[^>]*${attrMatcher}[^>]*>`, "i");
  const tag = `<meta ${attrMatcher} content="${escapeAttr(content)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace("</head>", `    ${tag}\n  </head>`);
}

function replaceOrInsertLink(html, rel, href) {
  const re = new RegExp(`<link\\s+[^>]*rel=["']${rel}["'][^>]*>`, "i");
  const tag = `<link rel="${rel}" href="${escapeAttr(href)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace("</head>", `    ${tag}\n  </head>`);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

async function startStaticServer() {
  const server = createServer((request, response) =>
    handler(request, response, {
      public: distDir,
      rewrites: [{ source: "**", destination: "/index.html" }],
    }),
  );

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

function htmlFragmentToMarkdown(
  fragmentHtml,
  { title, description, pageUrl },
  docsToMarkdown,
) {
  const dom = new JSDOM(`<!doctype html><body>${fragmentHtml}</body>`, {
    url: pageUrl,
  });
  const content = dom.window.document.body.firstElementChild;
  if (!content) return `# ${title}\n`;
  return docsToMarkdown(title, content, { description, pageUrl });
}

async function waitForApp(page) {
  await page.waitForFunction(
    () => {
      const root = document.querySelector("#root");
      const text = root?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      return text.length > 40;
    },
    { timeout: 30_000 },
  );
  // Deferred Shiki highlight — optional for SEO; wait briefly when present.
  await page.waitForTimeout(200);
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/Executable doesn't exist|browserType\.launch/i.test(message)) {
      throw error;
    }
    console.log("Playwright Chromium missing — installing…");
    execSync("bunx playwright install chromium", {
      stdio: "inherit",
      cwd: demoRoot,
    });
    return chromium.launch({ headless: true });
  }
}

async function main() {
  const { publicPrerenderPaths, metaForPath } = await loadRouteMeta();
  const { docsToMarkdown } = await loadDocsToMarkdown();
  const { DOC_PAGE_META } = await loadDocMeta();
  const docMetaBySlug = new Map(
    DOC_PAGE_META.map((page) => [page.slug, page]),
  );
  const routes = publicPrerenderPaths();

  // Preserve the Vite SPA shell for hosts that fall back unknown paths to it
  // (e.g. `200.html` on Surge / some CDN SPA modes).
  const spaShell = await readFile(path.join(distDir, "index.html"), "utf8");
  await writeFile(path.join(distDir, "200.html"), spaShell, "utf8");

  const server = await startStaticServer();
  const browser = await launchBrowser();
  const page = await browser.newPage();
  const markdownPages = [];

  try {
    for (const routePath of routes) {
      const url = `${server.origin}${routePath}`;
      await page.goto(url, { waitUntil: "networkidle" });
      await waitForApp(page);

      const meta = metaForPath(routePath);
      const canonical = absoluteUrl(routePath);

      let html = await page.content();
      html = upsertHead(html, {
        title: meta.title,
        description: meta.description,
        canonical,
        noindex: meta.noindex,
      });

      const outFile = distFileForPath(routePath);
      await mkdir(path.dirname(outFile), { recursive: true });
      await writeFile(outFile, html, "utf8");
      console.log(
        `prerender ${routePath} → ${path.relative(demoRoot, outFile)}`,
      );

      if (routePath.startsWith("/docs/")) {
        const slug = routePath.slice("/docs/".length);
        const docPage = docMetaBySlug.get(slug);
        if (!docPage) {
          throw new Error(`Missing DOC_PAGE_META for docs slug "${slug}"`);
        }

        const fragmentHtml = await page.evaluate(() => {
          const content = document.querySelector("[data-docs-content]");
          return content?.outerHTML ?? null;
        });
        if (!fragmentHtml) {
          throw new Error(`Missing [data-docs-content] on ${routePath}`);
        }

        const pageUrl = absoluteUrl(routePath);
        const body = htmlFragmentToMarkdown(
          fragmentHtml,
          {
            title: docPage.heading,
            description: docPage.description,
            pageUrl,
          },
          docsToMarkdown,
        );
        const mdPath = path.join(distDir, "docs", `${slug}.md`);
        await mkdir(path.dirname(mdPath), { recursive: true });
        await writeFile(mdPath, body, "utf8");
        markdownPages.push(body);
        console.log(`markdown  /docs/${slug}.md`);
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }

  if (markdownPages.length > 0) {
    const full = `${markdownPages.map((body) => body.trim()).join("\n\n---\n\n")}\n`;
    await writeFile(path.join(distDir, "llms-full.txt"), full, "utf8");
    console.log(
      `Wrote dist/llms-full.txt (${markdownPages.length} docs, ${full.length} bytes)`,
    );
  }

  const home = await readFile(path.join(distDir, "index.html"), "utf8");
  if (!home.includes("Resizable Panels")) {
    throw new Error("Prerender smoke check failed: home HTML missing H1 text");
  }
}

await main();
