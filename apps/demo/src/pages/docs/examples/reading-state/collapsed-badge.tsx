import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelActions,
  usePanelCollapsed,
  usePanelControls,
} from "@blitzd/resizable-panels";
import { useRef } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Button } from "@/components/ui/button";

const sidebar = { groupId: "badge-demo", panelId: "sidebar" };

function Badge({ label, renders }: { label: string; renders: number }) {
  return (
    <span className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs">
      <span className="text-foreground">{label}</span>
      <span className="text-muted-foreground">renders: {renders}</span>
    </span>
  );
}

// Reads only the collapsed flag — a size-only drag frame leaves this equal,
// so the render counter holds still while you drag.
function CollapsedBadge() {
  const collapsed = usePanelCollapsed(sidebar);
  const renders = useRef(0);
  renders.current += 1;
  const label = `usePanelCollapsed · ${collapsed ? "collapsed" : "expanded"}`;
  return <Badge label={label} renders={renders.current} />;
}

// Reads the whole controls object — every drag frame changes size, so this
// re-renders on all of them.
function SizeReadout() {
  const controls = usePanelControls(sidebar);
  const renders = useRef(0);
  renders.current += 1;
  const size = controls ? `${Math.round(controls.renderedSize)}px` : "—";
  return (
    <Badge label={`usePanelControls · ${size}`} renders={renders.current} />
  );
}

function ToggleButton() {
  const actions = usePanelActions();
  return (
    <Button variant="outline" size="sm" onClick={() => actions.toggle(sidebar)}>
      Toggle collapse
    </Button>
  );
}

export default function CollapsedBadgeExample() {
  return (
    <PanelProvider>
      <DemoControls>
        <CollapsedBadge />
        <SizeReadout />
        <ToggleButton />
      </DemoControls>
      <PanelGroup groupId="badge-demo" orientation="horizontal">
        <Panel
          side="start"
          panelId="sidebar"
          defaultSize={200}
          minSize={120}
          maxSize={340}
          collapsedSize={0}
        >
          <DemoPanel label="Sidebar" />
        </Panel>
        <PanelResizeHandle />
        <Panel>
          <DemoPanel label="Content" muted />
        </Panel>
      </PanelGroup>
    </PanelProvider>
  );
}
