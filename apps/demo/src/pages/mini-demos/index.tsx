import { useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { PageHeader } from "@/components/page-header";
import { MINI_DEMO_GROUPS } from "@/lib/mini-demos";
import type { MiniDemoComponent } from "./card";
import {
  CascadeInwardDemo,
  CascadeOutwardDemo,
  CascadeSymmetricDemo,
} from "./cascades";
import {
  CollapseBelowDemo,
  CollapseBelowInstantDemo,
  CollapsedRailDemo,
  DefaultCollapsedDemo,
  ForceCloseDemo,
  NotResizableDemo,
} from "./collapsing";
import {
  ImperativeControlDemo,
  NoIdDemo,
  PersistenceDemo,
} from "./control-state";
import {
  CoincidentHandlesDemo,
  CustomHandleDemo,
  CustomHandleMultiDemo,
  HoverRevealHandleDemo,
} from "./handles";
import {
  FourColumnsDemo,
  MinOnlyDemo,
  NestedDemo,
  QuadrantDemo,
  VerticalDemo,
} from "./layouts";
import {
  MultiplePinnedDemo,
  PinnedPanelDemo,
  PinnedPxSidebarDemo,
} from "./pinned";
import {
  CalcDemo,
  MixedUnitsDemo,
  PercentDemo,
  PixelSizingDemo,
} from "./sizing";

/** Every demo card, keyed by its frozen slug. The registry drives grouping
 *  and order; this map resolves each slug to its component so the page and
 *  the nav dropdown always agree. */
const DEMOS: Record<string, MiniDemoComponent> = {
  "pixel-sizing": PixelSizingDemo,
  "percentage-bounds": PercentDemo,
  "calc-mixed": CalcDemo,
  "mixed-units": MixedUnitsDemo,
  vertical: VerticalDemo,
  nested: NestedDemo,
  "four-columns": FourColumnsDemo,
  quadrants: QuadrantDemo,
  "min-only": MinOnlyDemo,
  "cascade-outward": CascadeOutwardDemo,
  "cascade-inward": CascadeInwardDemo,
  "cascade-symmetric": CascadeSymmetricDemo,
  pinned: PinnedPanelDemo,
  "pinned-px-sidebar": PinnedPxSidebarDemo,
  "multiple-pinned": MultiplePinnedDemo,
  "default-collapsed": DefaultCollapsedDemo,
  "collapse-below": CollapseBelowDemo,
  "collapse-below-instant": CollapseBelowInstantDemo,
  "collapsed-size-rail": CollapsedRailDemo,
  "force-close": ForceCloseDemo,
  "not-resizable": NotResizableDemo,
  "coincident-handles": CoincidentHandlesDemo,
  "custom-handle": CustomHandleDemo,
  "custom-handle-multi": CustomHandleMultiDemo,
  "hover-reveal-handle": HoverRevealHandleDemo,
  imperative: ImperativeControlDemo,
  persistence: PersistenceDemo,
  "no-id": NoIdDemo,
};

export default function MiniDemos() {
  const location = useLocation();
  // Landing on `/mini-demos#…` (reload / deep link) should jump before paint.
  // Later in-app hash clicks get the smooth scroll.
  const preferInstantScroll = useRef(Boolean(location.hash));

  // Scroll the nav-menu-targeted demo card into view. The app scrolls a
  // nested <main>, not the window, so the browser's native hash handling
  // doesn't fire on client-side navigations.
  // biome-ignore lint/correctness/useExhaustiveDependencies: location.key is extra on purpose — re-clicking the currently-targeted menu entry (same hash, new key) should scroll again.
  useLayoutEffect(() => {
    if (!location.hash) return;
    const encoded = location.hash.slice(1);
    let id = encoded;
    try {
      id = decodeURIComponent(encoded);
    } catch {
      // Keep the raw fragment if it isn't valid URI encoding.
    }
    const behavior = preferInstantScroll.current ? "auto" : "smooth";
    preferInstantScroll.current = false;
    document.getElementById(id)?.scrollIntoView({
      behavior,
      block: "start",
    });
  }, [location.key, location.hash]);

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <PageHeader eyebrow="Mini demos" title="Every prop, in 30 seconds each">
          One self-contained demo per API feature. Drag handles, toggle buttons,
          and the size readouts are all live — open devtools and poke around.
        </PageHeader>

        <div className="flex flex-col gap-10">
          {MINI_DEMO_GROUPS.map((group) => (
            <section key={group.label} className="flex flex-col gap-4">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {group.label}
              </h2>
              {group.demos.map((demo) => {
                const Demo = DEMOS[demo.slug];
                return Demo ? <Demo key={demo.slug} /> : null;
              })}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
