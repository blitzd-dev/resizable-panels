import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { DemoPanel } from "@/components/demo-panel";

export default function PinnedPanel() {
  return (
    <PanelGroup orientation="horizontal">
      <Panel side="start" defaultSize={240} minSize={160} pinned>
        <DemoPanel label="Pinned sidebar">
          <span className="font-mono text-[10px] text-muted-foreground">
            drag my own handle
          </span>
        </DemoPanel>
      </Panel>
      <PanelResizeHandle />
      <Panel minSize={120}>
        <DemoPanel label="Peer one" muted />
      </Panel>
      <PanelResizeHandle />
      <Panel minSize={120}>
        <DemoPanel label="Peer two" muted />
      </Panel>
    </PanelGroup>
  );
}
