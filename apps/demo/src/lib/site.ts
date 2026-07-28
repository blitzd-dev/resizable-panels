/** Public site origin used for canonical URLs, sitemap, and feeds. */
export const SITE_URL = "https://resizable-panels.blitzd.dev";

export const SITE_NAME = "@blitzd/resizable-panels";

export const DEFAULT_DESCRIPTION =
  "Headless, animated, resizable panel layout primitives for React. Docked sidebars, peer splits, collapse to rails, persistence, and full keyboard support.";

export function absoluteUrl(pathname: string) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`;
}
