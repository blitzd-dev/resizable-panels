import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Segmented } from "@/components/segmented";

type Lock = "none" | "middle" | "group";

export default function Disabled() {
  const [lock, setLock] = useState<Lock>("middle");

  return (
    <>
      <DemoControls>
        <Segmented
          options={["none", "middle", "group"] as const}
          value={lock}
          onValueChange={setLock}
          labels={{
            none: "Unlocked",
            middle: "Lock middle",
            group: "Lock all",
          }}
        />
      </DemoControls>

      <PanelGroup orientation="horizontal" disabled={lock === "group"}>
        <Panel minSize={80}>
          <DemoPanel label="Left" muted />
        </Panel>
        <PanelResizeHandle />
        <Panel disabled={lock === "middle"} minSize={80}>
          <DemoPanel label="Middle" />
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={80}>
          <DemoPanel label="Right" muted />
        </Panel>
      </PanelGroup>
    </>
  );
}
