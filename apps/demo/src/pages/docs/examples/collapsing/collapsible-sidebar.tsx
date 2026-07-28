import {
  Panel,
  type PanelApi,
  PanelGroup,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useRef } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Button } from "@/components/ui/button";

export default function CollapsibleSidebar() {
  const sidebar = useRef<PanelApi>(null);

  return (
    <>
      <DemoControls>
        <Button
          variant="outline"
          size="sm"
          onClick={() => sidebar.current?.toggle()}
        >
          Toggle sidebar
        </Button>
      </DemoControls>

      <PanelGroup orientation="horizontal">
        <Panel
          apiRef={sidebar}
          side="start"
          defaultSize={200}
          minSize={140}
          collapsedSize={0}
        >
          <nav className="flex h-full flex-col gap-1 bg-background/30 p-3 text-sm text-foreground">
            <span className="font-medium">Navigation</span>
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
        <Panel minSize={160}>
          <DemoPanel label="Main content" muted />
        </Panel>
      </PanelGroup>
    </>
  );
}
