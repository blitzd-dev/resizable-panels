import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { DemoPanel } from "@/components/demo-panel";

export default function DockedSidebar() {
  return (
    <PanelGroup orientation="horizontal">
      <Panel side="start" defaultSize={240} minSize={160}>
        <nav className="flex h-full flex-col gap-1 bg-background/30 p-3 text-sm text-foreground">
          <span className="font-medium">Workspace</span>
          <a className="text-muted-foreground hover:text-foreground" href="#">
            Overview
          </a>
          <a className="text-muted-foreground hover:text-foreground" href="#">
            Reports
          </a>
          <a className="text-muted-foreground hover:text-foreground" href="#">
            Settings
          </a>
        </nav>
      </Panel>
      <PanelResizeHandle />
      <Panel minSize={120}>
        <DemoPanel label="Main content" muted />
      </Panel>
    </PanelGroup>
  );
}
