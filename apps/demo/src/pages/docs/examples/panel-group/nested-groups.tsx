import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { DemoPanel } from "@/components/demo-panel";

export default function NestedGroups() {
  return (
    <PanelGroup orientation="horizontal">
      <Panel side="start" defaultSize={160} minSize={100} collapsible={false}>
        <DemoPanel label="Sidebar" />
      </Panel>
      <PanelResizeHandle />
      <Panel minSize={160}>
        <PanelGroup orientation="vertical">
          <Panel defaultSize="65%" minSize={60}>
            <DemoPanel label="Editor" />
          </Panel>
          <PanelResizeHandle />
          <Panel minSize={60}>
            <DemoPanel label="Terminal" />
          </Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
}
