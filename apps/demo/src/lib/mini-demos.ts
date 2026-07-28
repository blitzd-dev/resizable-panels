export type MiniDemoLink = {
  /** Matches the card `slug` in pages/mini-demos/, where it doubles as the
   *  card's anchor id — menu links go to `/mini-demos#<slug>`. Frozen. */
  slug: string;
  title: string;
};

export type MiniDemoGroup = {
  label: string;
  demos: MiniDemoLink[];
};

/** Nav-menu index of the mini demos, grouped by topic. */
export const MINI_DEMO_GROUPS: MiniDemoGroup[] = [
  {
    label: "Sizing",
    demos: [
      { slug: "pixel-sizing", title: "Pixel sizing" },
      { slug: "percentage-bounds", title: "Percentage bounds" },
      { slug: "calc-mixed", title: "calc() & mixed units" },
      { slug: "mixed-units", title: "Mixed units" },
    ],
  },
  {
    label: "Layouts",
    demos: [
      { slug: "vertical", title: "Vertical group" },
      { slug: "nested", title: "Nested groups" },
      { slug: "four-columns", title: "Four columns" },
      { slug: "quadrants", title: "2 × 2 quadrants" },
      { slug: "min-only", title: "Peers with minSize only" },
    ],
  },
  {
    label: "Cascades",
    demos: [
      { slug: "cascade-outward", title: "Cascade outward" },
      { slug: "cascade-inward", title: "Cascade inward" },
      { slug: "cascade-symmetric", title: "Symmetric cascade" },
    ],
  },
  {
    label: "Pinned",
    demos: [
      { slug: "pinned", title: "Pinned panel" },
      { slug: "pinned-px-sidebar", title: "Pinned px sidebar" },
      { slug: "multiple-pinned", title: "Multiple pinned panels" },
    ],
  },
  {
    label: "Open & close",
    demos: [
      { slug: "default-collapsed", title: "defaultCollapsed" },
      { slug: "collapse-below", title: "collapseBelow" },
      { slug: "collapse-below-instant", title: "collapseBelow · instant" },
      { slug: "collapsed-size-rail", title: "collapsedSize rail" },
      { slug: "force-close", title: "Immediate collapse / expand" },
      { slug: "not-resizable", title: "No resize handle" },
    ],
  },
  {
    label: "Handles",
    demos: [
      { slug: "coincident-handles", title: "Zero-width handle seam" },
      { slug: "custom-handle", title: "iOS-style grab handle" },
      { slug: "custom-handle-multi", title: "iOS handles, multi-panel" },
      { slug: "hover-reveal-handle", title: "Reveal handle on hover" },
    ],
  },
  {
    label: "Control & state",
    demos: [
      { slug: "imperative", title: "usePanelLayout()" },
      { slug: "persistence", title: "Persistence" },
      { slug: "no-id", title: "No id (uncontrolled)" },
    ],
  },
];
