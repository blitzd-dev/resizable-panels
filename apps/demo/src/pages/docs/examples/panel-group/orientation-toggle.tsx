import {
  Panel,
  PanelGroup,
  type PanelGroupOrientation,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Segmented } from "@/components/segmented";

export default function OrientationToggle() {
  const [orientation, setOrientation] =
    useState<PanelGroupOrientation>("horizontal");

  return (
    <>
      <DemoControls>
        <Segmented
          options={["horizontal", "vertical"] as const}
          value={orientation}
          onValueChange={setOrientation}
          mono
        />
      </DemoControls>

      <PanelGroup orientation={orientation}>
        {/* 60px stays comfortable in both orientations — the vertical frame
            is much shorter than the horizontal one is wide. */}
        <Panel defaultSize="50%" minSize={60}>
          <DemoPanel label="Panel A" />
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={60}>
          <DemoPanel label="Panel B" />
        </Panel>
      </PanelGroup>
    </>
  );
}
