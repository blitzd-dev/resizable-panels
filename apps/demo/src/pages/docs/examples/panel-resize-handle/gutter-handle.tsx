import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Segmented } from "@/components/segmented";

const SIZES = ["0", "8", "16"] as const;

export default function GutterHandle() {
  const [size, setSize] = useState<(typeof SIZES)[number]>("8");
  const gutterSize = Number(size);

  return (
    <>
      <DemoControls>
        <Segmented options={SIZES} value={size} onValueChange={setSize} mono />
      </DemoControls>

      <PanelGroup orientation="horizontal">
        <Panel defaultSize="50%" minSize={120}>
          <DemoPanel label="Left" />
        </Panel>
        {/* gutterSize gives the handle real layout space. Its own className
            fills that space; the default separator line centers in it. At 0
            it collapses back to a zero-width overlay seam. */}
        <PanelResizeHandle
          gutterSize={gutterSize}
          className="bg-muted transition-colors hover:bg-muted-foreground/20"
        />
        <Panel minSize={120}>
          <DemoPanel label="Right" muted />
        </Panel>
      </PanelGroup>
    </>
  );
}
