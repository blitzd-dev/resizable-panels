import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { DemoPanel } from "@/components/demo-panel";

export default function Anatomy() {
  return (
    <PanelGroup orientation="horizontal">
      <Panel minSize={120}>
        <DemoPanel label="Panel" />
      </Panel>
      <PanelResizeHandle />
      <Panel minSize={120}>
        <DemoPanel label="Panel" />
      </Panel>
      <PanelResizeHandle />
      <Panel minSize={120}>
        <DemoPanel label="Panel" />
      </Panel>
    </PanelGroup>
  );
}
