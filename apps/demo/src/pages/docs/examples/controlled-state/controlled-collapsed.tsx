import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";

export default function ControlledCollapsed() {
  // The `collapsed` prop is authoritative; your state is the single source.
  const [collapsed, setCollapsed] = useState(false);
  const [mode, setMode] = useState<"accept" | "decline">("accept");

  return (
    <>
      <DemoControls>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? "Expand" : "Collapse"} from app state
        </Button>
        <Segmented
          options={["accept", "decline"] as const}
          value={mode}
          onValueChange={setMode}
          labels={{ accept: "accept proposals", decline: "decline" }}
        />
      </DemoControls>

      <PanelGroup orientation="horizontal">
        <Panel
          side="start"
          defaultSize={200}
          minSize={140}
          collapsedSize={0}
          collapseBelow={110}
          collapsed={collapsed}
          // Enter on the handle and a drag past 110px propose here instead of
          // applying; "decline" ignores the proposal and the panel snaps back.
          onCollapsedChange={(next) => {
            if (mode === "accept") setCollapsed(next);
          }}
        >
          <nav className="flex h-full flex-col gap-1 bg-background/30 p-3 text-sm text-foreground">
            <span className="font-medium">Sidebar</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              Enter on the seam, or drag past 110px, proposes
            </span>
          </nav>
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={120}>
          <DemoPanel label="Main content" muted />
        </Panel>
      </PanelGroup>
    </>
  );
}
