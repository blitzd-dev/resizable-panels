import {
  Panel,
  type PanelCursorBehavior,
  PanelGroup,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Segmented } from "@/components/segmented";

export default function RtlAndCursor() {
  const [dir, setDir] = useState<"ltr" | "rtl">("ltr");
  const [cursorBehavior, setCursorBehavior] =
    useState<PanelCursorBehavior>("global");

  return (
    <>
      <DemoControls>
        <Segmented
          options={["ltr", "rtl"] as const}
          value={dir}
          onValueChange={setDir}
          mono
        />
        <Segmented
          options={["global", "handle", "none"] as const}
          value={cursorBehavior}
          onValueChange={setCursorBehavior}
          mono
        />
      </DemoControls>

      <PanelGroup
        orientation="horizontal"
        dir={dir}
        cursorBehavior={cursorBehavior}
      >
        <Panel side="start" defaultSize={160} minSize={80} collapsible={false}>
          <DemoPanel label={'side="start"'} />
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={120}>
          <DemoPanel label="peer" />
        </Panel>
      </PanelGroup>
    </>
  );
}
