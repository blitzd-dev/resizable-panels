import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { DemoPanel } from "@/components/demo-panel";

export default function FirstSplit() {
  return (
    <PanelGroup orientation="horizontal">
      <Panel minSize={120}>
        <DemoPanel label="Left" />
      </Panel>
      <PanelResizeHandle />
      <Panel minSize={120}>
        <DemoPanel label="Right" />
      </Panel>
    </PanelGroup>
  );
}
