import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Segmented } from "@/components/segmented";

export default function HandlePlacement() {
  const [placement, setPlacement] = useState<"direct sibling" | "wrapped">(
    "direct sibling",
  );
  const wrapped = placement === "wrapped";

  return (
    <>
      <DemoControls>
        <Segmented
          options={["direct sibling", "wrapped"] as const}
          value={placement}
          onValueChange={setPlacement}
        />
      </DemoControls>

      <PanelGroup orientation="horizontal">
        <Panel defaultSize="50%" minSize={120}>
          <DemoPanel label="Left" />
        </Panel>
        {/* Wrapping the handle in a <div> breaks adjacency: the group can no
            longer find a Panel on each side, disables the seam, and warns. */}
        {wrapped ? (
          <div>
            <PanelResizeHandle />
          </div>
        ) : (
          <PanelResizeHandle />
        )}
        <Panel minSize={120}>
          <DemoPanel label="Right" />
        </Panel>
      </PanelGroup>
    </>
  );
}
