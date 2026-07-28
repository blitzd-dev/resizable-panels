import type { PanelApi, PanelGroupAnimation } from "@blitzd/resizable-panels";
import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { useRef, useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";

const MODES: { label: string; animation: PanelGroupAnimation | undefined }[] = [
  { label: "default (300ms)", animation: undefined },
  { label: "off", animation: false },
  { label: "slow (900ms)", animation: { durationMs: 900 } },
];

export default function AnimationControl() {
  const [mode, setMode] = useState(0);
  const sidebar = useRef<PanelApi>(null);

  return (
    <>
      <DemoControls>
        <Button
          variant="outline"
          size="sm"
          onClick={() => sidebar.current?.toggle()}
        >
          Toggle sidebar
        </Button>
        <Segmented
          options={MODES.map((m) => m.label)}
          value={MODES[mode].label}
          onValueChange={(label) =>
            setMode(MODES.findIndex((m) => m.label === label))
          }
          mono
        />
      </DemoControls>

      <PanelGroup orientation="horizontal" animation={MODES[mode].animation}>
        <Panel
          apiRef={sidebar}
          side="start"
          defaultSize={200}
          minSize={120}
          collapsedSize={0}
        >
          <DemoPanel label="Sidebar" />
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={160}>
          <DemoPanel
            label="Toggle the sidebar under each mode to feel the difference"
            muted
          />
        </Panel>
      </PanelGroup>
    </>
  );
}
