import type { ComponentProps } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/**
 * Project adapter that lets the stock shadcn sidebar render inside a
 * resizable panel instead of owning fixed viewport geometry.
 *
 * The panel owns all width, so the content never animates its own width — the
 * buttons stay `w-full` and follow the panel frame-for-frame with no transition
 * (nothing lags the pointer on a drag, nothing snaps at the collapse pop). The
 * only motion the content adds is opacity (text/chevron fades) and the
 * header/footer icon height morph — see sidebar.tsx.
 */
export function EmbeddedSidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}: ComponentProps<"div"> & {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon";
}) {
  const { state } = useSidebar();

  return (
    <div
      data-slot="sidebar"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      className={cn(
        "group relative h-full w-full text-sidebar-foreground",
        className,
      )}
      {...props}
    >
      <div
        data-sidebar="sidebar"
        data-slot="sidebar-inner"
        className="flex h-full w-full flex-col bg-sidebar"
      >
        {children}
      </div>
    </div>
  );
}
