import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Segmented } from "@/components/segmented";

const OPTIONS = ["before", "after", "off"] as const;

export default function DoubleClickReset() {
  const [mode, setMode] = useState<(typeof OPTIONS)[number]>("before");
  const doubleClickReset = mode === "off" ? false : mode;

  return (
    <>
      <DemoControls>
        <Segmented
          options={OPTIONS}
          value={mode}
          onValueChange={setMode}
          mono
        />
      </DemoControls>

      <PanelGroup orientation="horizontal">
        <Panel defaultSize="35%" minSize={120}>
          <DemoPanel label="Left" />
        </Panel>
        <PanelResizeHandle doubleClickReset={doubleClickReset} />
        <Panel defaultSize="65%" minSize={120}>
          <DemoPanel label="Right" muted />
        </Panel>
      </PanelGroup>
    </>
  );
}
