import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Segmented } from "@/components/segmented";

export default function DisabledHandle() {
  const [scope, setScope] = useState<"none" | "handle" | "group">("none");

  return (
    <>
      <DemoControls>
        <Segmented
          options={["none", "handle", "group"] as const}
          value={scope}
          onValueChange={setScope}
        />
      </DemoControls>

      <PanelGroup orientation="horizontal" disabled={scope === "group"}>
        <Panel side="start" defaultSize={200} minSize={120}>
          <DemoPanel label="Sidebar" />
        </Panel>
        <PanelResizeHandle disabled={scope === "handle"} />
        <Panel minSize={160}>
          <DemoPanel label="Main content" muted />
        </Panel>
      </PanelGroup>
    </>
  );
}
