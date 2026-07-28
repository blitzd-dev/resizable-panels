import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { DemoPanel } from "@/components/demo-panel";

export default function Hero() {
  return (
    <PanelGroup orientation="horizontal">
      <Panel side="start" defaultSize={200} minSize={140} collapsible={false}>
        <nav className="flex h-full flex-col gap-1 bg-background/30 p-3 text-sm">
          <span className="font-medium text-foreground">Workspace</span>
          <a className="text-muted-foreground hover:text-foreground" href="#">
            Overview
          </a>
          <a className="text-muted-foreground hover:text-foreground" href="#">
            Documents
          </a>
          <a className="text-muted-foreground hover:text-foreground" href="#">
            Settings
          </a>
        </nav>
      </Panel>
      <PanelResizeHandle />
      <Panel minSize={160}>
        <DemoPanel label="Editor" muted />
      </Panel>
      <PanelResizeHandle />
      <Panel side="end" defaultSize={220} minSize={140}>
        <DemoPanel label="Inspector" />
      </Panel>
    </PanelGroup>
  );
}
