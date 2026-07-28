import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { DemoPanel } from "@/components/demo-panel";

export default function PeerColumns() {
  return (
    <PanelGroup orientation="horizontal">
      <Panel minSize={80}>
        <DemoPanel label="List">
          <span className="font-mono text-[10px] text-muted-foreground">
            auto
          </span>
        </DemoPanel>
      </Panel>
      <PanelResizeHandle />
      <Panel defaultSize="40%" minSize={80}>
        <DemoPanel label="Detail">
          <span className="font-mono text-[10px] text-muted-foreground">
            defaultSize="40%"
          </span>
        </DemoPanel>
      </Panel>
      <PanelResizeHandle />
      <Panel minSize={80}>
        <DemoPanel label="Inspector">
          <span className="font-mono text-[10px] text-muted-foreground">
            auto
          </span>
        </DemoPanel>
      </Panel>
    </PanelGroup>
  );
}
