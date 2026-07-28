import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { DemoPanel } from "@/components/demo-panel";

export default function DockedPanelWithPeers() {
  return (
    <PanelGroup orientation="horizontal">
      <Panel side="start" defaultSize={200} minSize={120}>
        <DemoPanel label="Docked">
          <Detail>side="start"</Detail>
        </DemoPanel>
      </Panel>
      <PanelResizeHandle />
      <Panel minSize={120}>
        <DemoPanel label="Peer">
          <Detail>no side</Detail>
        </DemoPanel>
      </Panel>
      <PanelResizeHandle />
      <Panel minSize={120}>
        <DemoPanel label="Peer">
          <Detail>no side</Detail>
        </DemoPanel>
      </Panel>
    </PanelGroup>
  );
}

function Detail({ children }: { children: string }) {
  return (
    <span className="font-mono text-[10px] text-muted-foreground">
      {children}
    </span>
  );
}
