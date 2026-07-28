export type DocPageMeta = {
  slug: string;
  /** Short name used in the sidebar, breadcrumb, and prev/next pager. */
  title: string;
  /** Page h1 — may differ from `title` (e.g. `<PanelGroup>`). */
  heading: string;
  /** Introductory one-liner shown below the page heading. */
  description: string;
};

export type DocGroupMeta = {
  /** Stable category slug. It is not itself a documentation page. */
  slug: string;
  label: string;
  pages: [DocPageMeta, ...DocPageMeta[]];
};

function makeGroup(
  label: string,
  slug: string,
  pages: [DocPageMeta, ...DocPageMeta[]],
): DocGroupMeta {
  return { label, slug, pages };
}

const LEARN_PAGES: [DocPageMeta, ...DocPageMeta[]] = [
  {
    slug: "introduction",
    title: "Introduction",
    heading: "Introduction",
    description:
      "What Resizable Panels is, what it owns versus what your app owns, and where to start.",
  },
  {
    slug: "installation",
    title: "Installation & first layout",
    heading: "Installation",
    description:
      "Install the package and render a working, draggable split in a few lines.",
  },
  {
    slug: "mental-model",
    title: "Mental model",
    heading: "How it fits together",
    description:
      "Group, panel, handle; docked vs peer; preferred vs rendered size; the implicit provider.",
  },
];

const GUIDE_PAGES: [DocPageMeta, ...DocPageMeta[]] = [
  {
    slug: "building-layouts",
    title: "Building layouts",
    heading: "Building layouts",
    description:
      "Docked sidebars, peer columns, nested grids, and pinned or locked panels.",
  },
  {
    slug: "sizing",
    title: "Sizing & constraints",
    heading: "Sizing & constraints",
    description:
      "The SizeSpec grammar, min/max bounds, over-constrained layouts, and container resize.",
  },
  {
    slug: "collapsing",
    title: "Collapsing panels",
    heading: "Collapsing panels",
    description:
      "Collapse off-canvas, to a compact rail, by dragging past a threshold, or automatically when space runs out.",
  },
  {
    slug: "controlled-state",
    title: "Controlled state & events",
    heading: "Controlled state & events",
    description:
      "Seed, control, and observe the layout with defaultValue, value/onValueChange, and change metadata.",
  },
  {
    slug: "persistence",
    title: "Persisting layouts",
    heading: "Persistence",
    description:
      "Save and restore layouts across reloads, plug in custom storage, and gate on the restore lifecycle.",
  },
  {
    slug: "imperative-and-actions",
    title: "Driving panels from code",
    heading: "Driving panels from code",
    description:
      "apiRef handles, the usePanelActions dispatcher, and reading authoritative action results.",
  },
  {
    slug: "reading-state",
    title: "Reading state with hooks",
    heading: "Reading state with hooks",
    description:
      "Subscribe to a panel, a group, or provider-wide activity with the narrowest hook for the job.",
  },
  {
    slug: "styling-and-slot-props",
    title: "Styling & slotProps",
    heading: "Styling & slotProps",
    description:
      "Style panels through data attributes and CSS variables, and customize the inner slots.",
  },
  {
    slug: "responsive",
    title: "Responsive layouts",
    heading: "Responsive layouts",
    description:
      "Switch orientation at breakpoints, auto-collapse on small screens, and pause work while resizing.",
  },
  {
    slug: "accessibility",
    title: "Keyboard & accessibility",
    heading: "Keyboard & accessibility",
    description:
      "The window-splitter pattern: key bindings, focus behavior, and the ARIA contract.",
  },
];

const REFERENCE_PAGES: [DocPageMeta, ...DocPageMeta[]] = [
  {
    slug: "panel-group",
    title: "PanelGroup",
    heading: "<PanelGroup>",
    description:
      "The container that holds panels — orientation, direction, cursor policy, and every prop.",
  },
  {
    slug: "panel",
    title: "Panel",
    heading: "<Panel>",
    description:
      "Docked and peer panels — sizing, collapsing, docking, and every prop.",
  },
  {
    slug: "panel-resize-handle",
    title: "PanelResizeHandle",
    heading: "<PanelResizeHandle>",
    description:
      "The separator between panels — placement, hit area, gutters, keyboard steps, and every prop.",
  },
  {
    slug: "provider-and-hooks",
    title: "PanelProvider & hooks",
    heading: "<PanelProvider>",
    description:
      "The explicit provider boundary, locators, and the signatures of every hook.",
  },
  {
    slug: "component-props",
    title: "Components & props",
    heading: "Component prop types",
    description:
      "Props for PanelGroup, Panel, PanelResizeHandle, and advanced panel slots.",
  },
  {
    slug: "layout-types",
    title: "Layout & sizing types",
    heading: "Layout & sizing types",
    description:
      "Axes, panel roles, logical sides, animation, cascades, collapse behavior, and SizeSpec.",
  },
  {
    slug: "value-event-types",
    title: "Value & event types",
    heading: "Value & event types",
    description:
      "Controlled layout values, change metadata, resize lifecycle events, reasons, and triggers.",
  },
  {
    slug: "action-types",
    title: "Action & API types",
    heading: "Imperative action types",
    description:
      "Panel and group APIs, shared actions, options, and authoritative result unions.",
  },
  {
    slug: "provider-hook-types",
    title: "Provider & hook types",
    heading: "Provider, hook & locator types",
    description:
      "Provider addresses, reactive control snapshots, dispatchers, locators, and lookup results.",
  },
  {
    slug: "persistence-types",
    title: "Persistence types",
    heading: "Persistence types",
    description:
      "Persistence configuration, storage adapters, restore status, and errors.",
  },
];

export const DOC_GROUP_META: DocGroupMeta[] = [
  makeGroup("Get started", "get-started", LEARN_PAGES),
  makeGroup("Guides", "guides", GUIDE_PAGES),
  makeGroup("Reference", "reference", REFERENCE_PAGES),
];

export const DOC_PAGE_META: DocPageMeta[] = DOC_GROUP_META.flatMap(
  (group) => group.pages,
);

export const DOCS_HOME = `/docs/${DOC_PAGE_META[0].slug}`;

export function groupMetaForPage(slug: string): DocGroupMeta | undefined {
  return DOC_GROUP_META.find((group) =>
    group.pages.some((page) => page.slug === slug),
  );
}

/** Retired slugs from the pre-rewrite information architecture. Old links
 * (bookmarks, search hits) land on the page that owns the topic now. */
const LEGACY_DOC_REDIRECTS: Record<string, string> = {
  panels: "panel",
  "resize-handles": "panel-resize-handle",
  "controlled-value-and-events": "controlled-state",
  "imperative-api": "imperative-and-actions",
  "hooks-dispatch-actions": "imperative-and-actions",
  "hooks-read-state": "reading-state",
  "provider-and-locators": "provider-and-hooks",
  mobile: "responsive",
  "keyboard-accessibility": "accessibility",
  "a11y-mobile": "accessibility",
  "managing-state": "controlled-state",
  "driving-panels": "imperative-and-actions",
  "building-layouts-group": "building-layouts",
};

/** A category slug is not itself a page — it leads into its first page.
 * Legacy page slugs redirect to their successors. */
export function redirectForDocSlug(slug: string | undefined) {
  const group = DOC_GROUP_META.find((candidate) => candidate.slug === slug);
  if (group) return `/docs/${group.pages[0].slug}`;
  const legacy = slug ? LEGACY_DOC_REDIRECTS[slug] : undefined;
  return legacy ? `/docs/${legacy}` : undefined;
}
