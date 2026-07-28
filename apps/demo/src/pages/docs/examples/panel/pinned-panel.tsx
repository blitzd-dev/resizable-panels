import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Segmented } from "@/components/segmented";

export default function PinnedPanel() {
  const [pinned, setPinned] = useState<"pinned" | "unpinned">("pinned");

  return (
    <>
      <DemoControls>
        <Segmented
          options={["pinned", "unpinned"] as const}
          value={pinned}
          onValueChange={setPinned}
          mono
        />
      </DemoControls>

      <PanelGroup orientation="horizontal">
        <Panel
          side="start"
          defaultSize={200}
          minSize={120}
          pinned={pinned === "pinned"}
        >
          <DemoPanel label="Sidebar">
            <span className="font-mono text-[10px] text-muted-foreground">
              {pinned === "pinned" ? "holds its width" : "cascades shrink me"}
            </span>
          </DemoPanel>
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={80}>
          <DemoPanel label="Peer one" muted />
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={80}>
          <DemoPanel label="Peer two" muted />
        </Panel>
      </PanelGroup>
    </>
  );
}
