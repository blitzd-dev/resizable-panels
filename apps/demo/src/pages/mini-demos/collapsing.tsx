import {
  Panel,
  PanelGroup,
  type PanelLocator,
  PanelResizeHandle,
  usePanelControls,
} from "@blitzd/resizable-panels";
import {
  Home,
  Inbox,
  type LucideIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
} from "lucide-react";
import {
  MiniDemoFrame,
  MiniPanel,
  ToggleButton,
} from "@/components/showcase/mini-demo";
import { Button } from "@/components/ui/button";
import { MiniDemoCard } from "./card";

export function DefaultCollapsedDemo() {
  return (
    <MiniDemoCard
      slug="default-collapsed"
      title="defaultCollapsed"
      caption="Start collapsed and expand from a persistent control — the disabled resize handle stays out of the tab order."
      docsSlug="collapsing"
      code={`<Panel side="start" defaultSize={200} defaultCollapsed>
  left
</Panel>`}
    >
      <MiniDemoFrame
        panels={[
          {
            groupId: "default-collapsed",
            panelId: "mini-closed",
            label: "left",
          },
        ]}
      >
        <PanelGroup groupId="default-collapsed" orientation="horizontal">
          <Panel
            panelId="mini-closed"
            side="start"
            defaultSize={200}
            defaultCollapsed
          >
            <MiniPanel
              groupId="default-collapsed"
              panelId="mini-closed"
              label="left"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel>
            <MiniPanel label="main" />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}

function CollapseBelowStatus({ groupId, panelId }: PanelLocator) {
  const ctrl = usePanelControls({ groupId, panelId });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ToggleButton groupId={groupId} panelId={panelId} label="nav" />
      <span className="ml-auto font-mono text-[11px] text-muted-foreground">
        {Math.round(ctrl?.renderedSize ?? 0)}px ·{" "}
        {ctrl?.collapsed ? "collapsed" : "expanded"}
      </span>
    </div>
  );
}

export function CollapseBelowDemo() {
  return (
    <MiniDemoCard
      slug="collapse-below"
      title="collapseBelow · animated"
      caption="The default — cross the collapseBelow threshold and the panel animates shut, reverse the same drag to reopen before you release."
      docsSlug="collapsing"
      code={`<Panel
  id="nav"
  side="start"
  defaultSize={220}
  minSize={140}
  collapseBelow={60}
  collapseBelowBehavior="animated"
>
  nav
</Panel>`}
    >
      <MiniDemoFrame
        toolbar={
          <CollapseBelowStatus
            groupId="collapse-below"
            panelId="mini-collapse-below"
          />
        }
        panels={[
          {
            groupId: "collapse-below",
            panelId: "mini-collapse-below",
            label: "nav",
          },
        ]}
      >
        <PanelGroup groupId="collapse-below" orientation="horizontal">
          <Panel
            panelId="mini-collapse-below"
            side="start"
            defaultSize={220}
            minSize={140}
            maxSize={320}
            collapseBelow={60}
          >
            <MiniPanel
              groupId="collapse-below"
              panelId="mini-collapse-below"
              label="nav"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel>
            <MiniPanel label="main" />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}

export function CollapseBelowInstantDemo() {
  return (
    <MiniDemoCard
      slug="collapse-below-instant"
      title="collapseBelow · instant snap"
      caption="The same live threshold with an instant transition — snapping instead of motion for dense tools or reduced-chrome workspaces."
      docsSlug="collapsing"
      code={`<Panel
  id="nav"
  side="start"
  defaultSize={220}
  minSize={140}
  collapseBelow={60}
  collapseBelowBehavior="instant"
>
  nav
</Panel>`}
    >
      <MiniDemoFrame
        toolbar={
          <CollapseBelowStatus
            groupId="collapse-below-instant"
            panelId="mini-collapse-snap"
          />
        }
        panels={[
          {
            groupId: "collapse-below-instant",
            panelId: "mini-collapse-snap",
            label: "nav",
          },
        ]}
      >
        <PanelGroup groupId="collapse-below-instant" orientation="horizontal">
          <Panel
            panelId="mini-collapse-snap"
            side="start"
            defaultSize={220}
            minSize={140}
            maxSize={320}
            collapseBelow={60}
            collapseBelowBehavior="instant"
          >
            <MiniPanel
              groupId="collapse-below-instant"
              panelId="mini-collapse-snap"
              label="nav"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel>
            <MiniPanel label="main" />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}

const RAIL_ITEMS: { label: string; Icon: LucideIcon }[] = [
  { label: "Home", Icon: Home },
  { label: "Search", Icon: Search },
  { label: "Inbox", Icon: Inbox },
  { label: "Settings", Icon: Settings },
];

function RailSidebarContent() {
  const ctrl = usePanelControls({
    groupId: "collapsed-size-rail",
    panelId: "mini-collapse-rail",
  });
  const collapsed = ctrl?.collapsed ?? false;
  return (
    <div
      className={`flex h-full flex-col bg-background/30 p-1.5 text-foreground ${collapsed ? "w-[52px] items-center" : "w-full"}`}
    >
      <div
        className={`mb-1 flex w-full items-center ${collapsed ? "justify-center" : "justify-between px-1"}`}
      >
        {collapsed ? null : (
          <span className="truncate text-xs font-semibold">Workspace</span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => ctrl?.toggle()}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </Button>
      </div>
      <nav aria-label="Demo sidebar" className="flex w-full flex-col gap-0.5">
        {RAIL_ITEMS.map(({ label, Icon }) => (
          <Button
            key={label}
            type="button"
            variant="ghost"
            size="sm"
            aria-label={collapsed ? label : undefined}
            title={collapsed ? label : undefined}
            className={`h-8 w-full text-xs text-muted-foreground hover:text-foreground ${collapsed ? "justify-center px-0" : "justify-start gap-2 px-2"}`}
          >
            <Icon className="size-4 shrink-0" />
            {collapsed ? null : <span>{label}</span>}
          </Button>
        ))}
      </nav>
    </div>
  );
}

export function CollapsedRailDemo() {
  return (
    <MiniDemoCard
      slug="collapsed-size-rail"
      title="collapsedSize · icon rail"
      caption="A non-zero collapsedSize keeps a compact icon rail instead of vanishing; resizableWhenCollapsed reopens it by dragging the seam."
      docsSlug="collapsing"
      code={`<Panel
  id="sidebar"
  side="start"
  defaultSize={220}
  minSize={140}
  collapsedSize={52}
  resizableWhenCollapsed
  collapseBelow={90}
>
  <SidebarContent />
</Panel>`}
    >
      <MiniDemoFrame
        toolbar={
          <CollapseBelowStatus
            groupId="collapsed-size-rail"
            panelId="mini-collapse-rail"
          />
        }
        panels={[
          {
            groupId: "collapsed-size-rail",
            panelId: "mini-collapse-rail",
            label: "nav",
          },
        ]}
        frameClassName="h-48"
      >
        <PanelGroup groupId="collapsed-size-rail" orientation="horizontal">
          <Panel
            panelId="mini-collapse-rail"
            side="start"
            defaultSize={220}
            minSize={140}
            maxSize={320}
            collapsedSize={52}
            resizableWhenCollapsed
            collapseBelow={90}
            className="border-r border-border"
          >
            <RailSidebarContent />
          </Panel>
          <PanelResizeHandle />
          <Panel>
            <MiniPanel label="main" />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}

function ForceCloseToolbar() {
  const ctrl = usePanelControls({
    groupId: "force-close",
    panelId: "mini-force",
  });
  if (!ctrl) {
    return (
      <span className="rounded-md border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-foreground">
        nav
      </span>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="secondary" size="xs" onClick={() => ctrl.expand()}>
        Expand (animated)
      </Button>
      <Button variant="secondary" size="xs" onClick={() => ctrl.collapse()}>
        Collapse (animated)
      </Button>
      <Button
        variant="secondary"
        size="xs"
        onClick={() => ctrl.expand({ transition: "none" })}
      >
        Expand (instant)
      </Button>
      <Button
        variant="secondary"
        size="xs"
        onClick={() => ctrl.collapse({ transition: "none" })}
      >
        Collapse (instant)
      </Button>
    </div>
  );
}

export function ForceCloseDemo() {
  return (
    <MiniDemoCard
      slug="force-close"
      title="Immediate collapse / expand"
      caption="collapse() and expand() with transition:'none' skip the size animation when motion would read as lag."
      docsSlug="collapsing"
      code={`const ctrl = usePanelControls("nav");

<button onClick={() => ctrl.collapse()}>animated collapse</button>
<button onClick={() => ctrl.collapse({ transition: "none" })}>instant collapse</button>
<button onClick={() => ctrl.expand({ transition: "none" })}>instant expand</button>`}
    >
      <MiniDemoFrame
        toolbar={<ForceCloseToolbar />}
        panels={[
          { groupId: "force-close", panelId: "mini-force", label: "nav" },
        ]}
      >
        <PanelGroup groupId="force-close" orientation="horizontal">
          <Panel
            panelId="mini-force"
            side="start"
            defaultSize={200}
            minSize={120}
            maxSize={320}
          >
            <MiniPanel groupId="force-close" panelId="mini-force" label="nav" />
          </Panel>
          <PanelResizeHandle />
          <Panel>
            <MiniPanel label="main" />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}

export function NotResizableDemo() {
  return (
    <MiniDemoCard
      slug="not-resizable"
      title="No resize handle"
      caption="Omit PanelResizeHandle to fix a boundary — the panel still responds to programmatic control."
      docsSlug="building-layouts"
      code={`<Panel side="start" defaultSize={180}>
  fixed
</Panel>`}
    >
      <MiniDemoFrame
        panels={[
          { groupId: "not-resizable", panelId: "mini-fixed", label: "fixed" },
        ]}
      >
        <PanelGroup groupId="not-resizable" orientation="horizontal">
          <Panel panelId="mini-fixed" side="start" defaultSize={180}>
            <MiniPanel
              groupId="not-resizable"
              panelId="mini-fixed"
              label="fixed"
            />
          </Panel>
          <Panel>
            <MiniPanel label="main" />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}
