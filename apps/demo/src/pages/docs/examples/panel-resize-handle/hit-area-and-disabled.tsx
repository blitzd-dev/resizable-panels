import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Segmented } from "@/components/segmented";

const MARGINS = ["5", "20", "40"] as const;

export default function HitAreaAndDisabled() {
  const [fine, setFine] = useState<(typeof MARGINS)[number]>("5");

  return (
    <>
      <DemoControls>
        <Segmented
          options={MARGINS}
          value={fine}
          onValueChange={setFine}
          mono
        />
      </DemoControls>

      <PanelGroup orientation="horizontal">
        <Panel defaultSize="34%" minSize={80}>
          <DemoPanel label="Left" />
        </Panel>
        {/* Live seam: the visible line stays thin; the grab zone grows with
            hitAreaMargins.fine (px on each side, for a mouse). */}
        <PanelResizeHandle hitAreaMargins={{ fine: Number(fine) }} />
        <Panel defaultSize="33%" minSize={80}>
          <DemoPanel label="Wide grab" muted />
        </Panel>
        {/* Frozen seam: renders so the layout keeps its shape, but the handle
            cannot be dragged, focused, or double-clicked. */}
        <PanelResizeHandle disabled />
        <Panel defaultSize="33%" minSize={80}>
          <DemoPanel label="Disabled seam" muted />
        </Panel>
      </PanelGroup>
    </>
  );
}
