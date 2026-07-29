"use client";

import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import * as React from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";

/** Matches shadcn sidebar-07: 16rem expanded, 3rem icon rail. */
const SIDEBAR_EXPANDED = 256;
const SIDEBAR_MIN = 160;
const SIDEBAR_COLLAPSE_BELOW = 160;
const SIDEBAR_ICON = 48;

export function AppShell({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(true);

  return (
    <TooltipProvider>
      <SidebarProvider
        open={open}
        onOpenChange={setOpen}
        className="h-svh! min-h-svh"
        style={
          {
            "--sidebar-width": `${SIDEBAR_EXPANDED}px`,
            "--sidebar-width-icon": `${SIDEBAR_ICON}px`,
          } as React.CSSProperties
        }
      >
        {isMobile ? (
          <>
            <AppSidebar />
            <SidebarInset>{children}</SidebarInset>
          </>
        ) : (
          <PanelProvider>
            <PanelGroup
              groupId="app"
              orientation="horizontal"
              className="h-svh w-full"
            >
              <Panel
                panelId="sidebar"
                side="start"
                defaultSize={SIDEBAR_EXPANDED}
                minSize={SIDEBAR_MIN}
                maxSize={360}
                collapsedSize={SIDEBAR_ICON}
                collapsible
                collapseBelow={SIDEBAR_COLLAPSE_BELOW}
                resizableWhenCollapsed
                collapsed={!open}
                onCollapsedChange={(collapsed) => setOpen(!collapsed)}
                className="min-w-0 bg-sidebar"
              >
                <AppSidebar resizable />
              </Panel>

              <PanelResizeHandle />

              <Panel minSize={320} className="min-w-0 min-h-0">
                <SidebarInset className="h-full min-h-0 overflow-auto">
                  {children}
                </SidebarInset>
              </Panel>
            </PanelGroup>
          </PanelProvider>
        )}
      </SidebarProvider>
    </TooltipProvider>
  );
}
