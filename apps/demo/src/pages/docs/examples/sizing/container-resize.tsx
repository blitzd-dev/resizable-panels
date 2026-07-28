import {
  Panel,
  type PanelContainerResizeBehavior,
  PanelGroup,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Button } from "@/components/ui/button";

function LabeledGroup({
  behavior,
  dockedLabel,
  peerLabel,
}: {
  behavior: PanelContainerResizeBehavior;
  dockedLabel: string;
  peerLabel: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <span className="font-mono text-xs text-muted-foreground">
        containerResizeBehavior="{behavior}"
      </span>
      <div className="min-h-0 flex-1">
        <PanelGroup orientation="horizontal">
          <Panel
            side="start"
            defaultSize={200}
            minSize={0}
            containerResizeBehavior={behavior}
            collapsible={false}
          >
            <DemoPanel
              label={<span className="font-mono text-xs">{dockedLabel}</span>}
            />
          </Panel>
          <PanelResizeHandle />
          <Panel>
            <DemoPanel label={peerLabel} muted className="text-xs" />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

export default function ContainerResize() {
  const [wide, setWide] = useState(true);

  return (
    <>
      <DemoControls>
        <Button variant="outline" size="sm" onClick={() => setWide((w) => !w)}>
          {wide ? "Shrink container" : "Grow container"}
        </Button>
      </DemoControls>

      <div
        className="flex h-full w-full flex-col gap-2 transition-all duration-300"
        style={{ width: wide ? "100%" : "55%" }}
      >
        <LabeledGroup
          behavior="fixed"
          dockedLabel="stays 200px"
          peerLabel="absorbs the change"
        />
        <LabeledGroup
          behavior="proportional"
          dockedLabel="rescales"
          peerLabel="keeps its share"
        />
      </div>
    </>
  );
}
