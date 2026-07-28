import { generatedChangelogMetadata } from "@/pages/changelog/generated-metadata";
import { DOC_PAGE_META } from "@/pages/docs/doc-meta";
import { DEFAULT_DESCRIPTION, SITE_NAME } from "./site";

export type RouteMeta = {
  path: string;
  title: string;
  description: string;
  /** When true, emit robots noindex,nofollow. */
  noindex?: boolean;
};

const DEMO_META: RouteMeta[] = [
  {
    path: "/demos",
    title: `Examples · ${SITE_NAME}`,
    description:
      "Interactive layout examples built with @blitzd/resizable-panels.",
  },
  {
    path: "/demos/shadcn-sidebar",
    title: `Shadcn sidebar · ${SITE_NAME}`,
    description: "Docked sidebar layout example with collapse and persistence.",
  },
  {
    path: "/demos/three-panel",
    title: `Three panel · ${SITE_NAME}`,
    description: "Three-panel horizontal split example.",
  },
  {
    path: "/demos/four-panel",
    title: `Four panel · ${SITE_NAME}`,
    description: "Nested four-panel workspace example.",
  },
  {
    path: "/demos/four-vertical",
    title: `Four vertical · ${SITE_NAME}`,
    description: "Vertical stack workspace example.",
  },
  {
    path: "/demos/stress",
    title: `Stress test · ${SITE_NAME}`,
    description: "High-churn stress harness for panel layouts.",
    noindex: true,
  },
  {
    path: "/mini-demos",
    title: `Mini demos · ${SITE_NAME}`,
    description: "Small focused demos of common panel patterns.",
  },
];

export const ROUTE_META: RouteMeta[] = [
  {
    path: "/",
    title: `${SITE_NAME} · Resizable panels for React`,
    description: DEFAULT_DESCRIPTION,
  },
  ...DOC_PAGE_META.map((page) => ({
    path: `/docs/${page.slug}`,
    title: `${page.title} · ${SITE_NAME}`,
    description: page.description,
  })),
  {
    path: "/changelog",
    title: `Changelog · ${SITE_NAME}`,
    description:
      "Release notes for @blitzd/resizable-panels — features, fixes, and breaking changes.",
  },
  ...generatedChangelogMetadata
    .filter(({ meta }) => !meta.draft)
    .map(({ meta }) => ({
      path: `/changelog/${meta.slug}`,
      title: `${meta.title} · Changelog · ${SITE_NAME}`,
      description: meta.summary,
    })),
  ...DEMO_META,
];

const byPath = new Map(ROUTE_META.map((entry) => [entry.path, entry]));

/** Resolve meta for a pathname (ignores trailing slash and hash/query). */
export function metaForPath(pathname: string): RouteMeta {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return (
    byPath.get(normalized) ?? {
      path: normalized,
      title: `Page not found · ${SITE_NAME}`,
      description: "This page does not exist.",
      noindex: true,
    }
  );
}

/** Public routes that should be prerendered and listed for crawlers. */
export function publicPrerenderPaths() {
  return ROUTE_META.filter((entry) => !entry.noindex).map(
    (entry) => entry.path,
  );
}

/** Sitemap entries: HTML routes plus machine-readable docs dumps. */
export function sitemapPaths() {
  return [
    ...publicPrerenderPaths(),
    ...DOC_PAGE_META.map((page) => `/docs/${page.slug}.md`),
    "/llms.txt",
    "/llms-full.txt",
  ];
}
