import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { DemoPanel } from "@/components/demo-panel";

export default function NestedGroups() {
  return (
    <PanelGroup orientation="horizontal">
      <Panel side="start" defaultSize={180} minSize={120} collapsible={false}>
        <DemoPanel label="Sidebar" />
      </Panel>
      <PanelResizeHandle />
      <Panel minSize={160}>
        {/* A group inside a peer — its own boundary, its own drag axis. */}
        <PanelGroup orientation="vertical">
          <Panel defaultSize="65%" minSize={60}>
            <DemoPanel label="Editor" />
          </Panel>
          <PanelResizeHandle />
          <Panel minSize={60}>
            <DemoPanel label="Terminal" muted />
          </Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
}
