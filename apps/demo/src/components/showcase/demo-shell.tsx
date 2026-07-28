import { PanelProvider } from "@blitzd/resizable-panels";
import type { ReactNode } from "react";
import {
  FloatingPanelMenu,
  type FloatingPanelMenuItem,
} from "./floating-panel-menu";
import { ResponsiveDrawerProvider } from "./responsive-drawer";
import { useDemoPersistence } from "./use-demo-persistence";

export type DemoShellContext = {
  /** Key for the page's PanelGroup `persistence` option; undefined while
   *  persistence is off. */
  persistenceKey: string | undefined;
};

/**
 * Shared scaffolding for the demo example pages: the floating dock wired to
 * persistence state. The layout wrapper is re-keyed by the persistence
 * toggle / remount button; the dock sits outside the key so its dragged
 * position survives.
 *
 * The page keeps its own PanelGroup — panels must stay direct children of
 * the group for seam interleaving, so the shell can't own it.
 */
export function DemoShell({
  storageKey,
  menuItems,
  children,
}: {
  storageKey: string;
  menuItems: FloatingPanelMenuItem[];
  children: (demo: DemoShellContext) => ReactNode;
}) {
  const { persistenceKey, groupKey, persistence } =
    useDemoPersistence(storageKey);
  return (
    <PanelProvider>
      <ResponsiveDrawerProvider>
        <FloatingPanelMenu items={menuItems} persistence={persistence} />
        <div key={groupKey} className="relative h-full w-full overflow-hidden">
          {children({ persistenceKey })}
        </div>
      </ResponsiveDrawerProvider>
    </PanelProvider>
  );
}
