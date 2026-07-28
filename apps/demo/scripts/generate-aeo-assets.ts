/**
 * Emit crawler/LLM discovery files into `public/` so Vite copies them into
 * `dist/` on every build. Per-page Markdown and `llms-full.txt` are written
 * later by prerender into `dist/` only.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publicPrerenderPaths, sitemapPaths } from "../src/lib/route-meta";
import {
  absoluteUrl,
  DEFAULT_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "../src/lib/site";
import { DOC_PAGE_META } from "../src/pages/docs/doc-meta";

const outputDirectory = fileURLToPath(new URL("../public/", import.meta.url));

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function writeRobots() {
  const body = `User-agent: *
Allow: /
Disallow: /demos/stress

Sitemap: ${SITE_URL}/sitemap.xml
`;
  await writeFile(path.join(outputDirectory, "robots.txt"), body, "utf8");
}

async function writeSitemap() {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapPaths()
  .map(
    (pathname) => `  <url>
    <loc>${escapeXml(absoluteUrl(pathname))}</loc>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
  await writeFile(path.join(outputDirectory, "sitemap.xml"), body, "utf8");
}

async function writeLlmsTxt() {
  const docLinks = DOC_PAGE_META.map(
    (page) =>
      `- [${page.title}](${SITE_URL}/docs/${page.slug}.md): ${page.description}`,
  ).join("\n");

  const body = `# ${SITE_NAME}

> ${DEFAULT_DESCRIPTION}

The preferred machine-readable docs are the per-page Markdown files under \`/docs/*.md\`. HTML docs at \`/docs/*\` match the same content and include interactive examples.

## Docs

${docLinks}

## Optional

- [Full docs dump](${SITE_URL}/llms-full.txt): concatenated Markdown for all documentation pages
- [Changelog feed (JSON)](${SITE_URL}/changelog.json)
- [Changelog feed (RSS)](${SITE_URL}/changelog.xml)
- [npm package](https://www.npmjs.com/package/@blitzd/resizable-panels)
- [GitHub repository](https://github.com/blitzd-dev/resizable-panels)
`;

  await writeFile(path.join(outputDirectory, "llms.txt"), body, "utf8");
}

await mkdir(outputDirectory, { recursive: true });
await Promise.all([writeRobots(), writeSitemap(), writeLlmsTxt()]);

console.log(
  `Wrote robots.txt, sitemap.xml, llms.txt (${publicPrerenderPaths().length} HTML routes) → public/`,
);
