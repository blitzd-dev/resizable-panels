import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Segmented } from "@/components/segmented";

export default function KeyboardResize() {
  const [dir, setDir] = useState<"ltr" | "rtl">("ltr");

  return (
    <>
      <DemoControls>
        <Segmented
          options={["ltr", "rtl"] as const}
          value={dir}
          onValueChange={setDir}
          mono
        />
      </DemoControls>

      <PanelGroup orientation="horizontal" dir={dir}>
        <Panel
          side="start"
          defaultSize={200}
          minSize={120}
          maxSize={320}
          collapsedSize={56}
          resizableWhenCollapsed
        >
          <DemoPanel label="Collapsible panel" />
        </Panel>
        <PanelResizeHandle
          keyboardStep={10}
          keyboardStepCoarse={50}
          keyboardStepFine={2}
        />
        <Panel minSize={160}>
          <DemoPanel label="Main content" muted />
        </Panel>
      </PanelGroup>
    </>
  );
}
