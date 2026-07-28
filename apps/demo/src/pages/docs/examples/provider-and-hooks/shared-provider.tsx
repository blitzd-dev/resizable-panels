import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelActions,
  usePanelCollapsed,
} from "@blitzd/resizable-panels";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Button } from "@/components/ui/button";

// The panel's address: the group's published groupId plus the panel's
// group-local panelId. Both strings are mandatory.
const sidebar = { groupId: "shell", panelId: "sidebar" };

// This toolbar renders as a sibling of the group, not inside it. It can
// still reach the sidebar because both live under one <PanelProvider>.
function Toolbar() {
  const actions = usePanelActions();
  const collapsed = usePanelCollapsed(sidebar);
  return (
    <Button variant="outline" size="sm" onClick={() => actions.toggle(sidebar)}>
      {collapsed ? "Show sidebar" : "Hide sidebar"}
    </Button>
  );
}

export default function SharedProvider() {
  return (
    <PanelProvider>
      <DemoControls>
        <Toolbar />
      </DemoControls>
      <PanelGroup groupId="shell" orientation="horizontal">
        <Panel
          side="start"
          panelId="sidebar"
          defaultSize={160}
          minSize={120}
          collapsedSize={0}
        >
          <DemoPanel label="Sidebar" />
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={120}>
          <DemoPanel label="Content" muted />
        </Panel>
      </PanelGroup>
    </PanelProvider>
  );
}
