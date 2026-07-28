import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { DemoPanel } from "@/components/demo-panel";

export default function DockedSidebar() {
  return (
    <PanelGroup orientation="horizontal">
      <Panel side="start" defaultSize={240} minSize={160}>
        <nav className="flex h-full flex-col gap-1 bg-background/30 p-3 text-sm text-foreground">
          <span className="font-medium">Sidebar</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            side="start", defaultSize={240}
          </span>
          <a
            className="mt-2 text-muted-foreground hover:text-foreground"
            href="#"
          >
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
        <DemoPanel label="Peer fills the rest" muted />
      </Panel>
    </PanelGroup>
  );
}
