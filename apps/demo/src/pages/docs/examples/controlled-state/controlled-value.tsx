import type { PanelGroupValue } from "@blitzd/resizable-panels";
import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { Segmented } from "@/components/segmented";

export default function ControlledValue() {
  // Your state is authoritative: the panels render exactly what `value` says.
  const [value, setValue] = useState<PanelGroupValue>({
    left: { size: 220 },
    right: { size: 300 },
  });
  const [mode, setMode] = useState<"accept" | "decline">("accept");

  return (
    <>
      <DemoControls>
        <Segmented
          options={["accept", "decline"] as const}
          value={mode}
          onValueChange={setMode}
          labels={{ accept: "accept proposals", decline: "decline (lock)" }}
        />
      </DemoControls>

      <PanelGroup
        orientation="horizontal"
        value={value}
        // A drag only PROPOSES a next value; nothing moves until you set it.
        onValueChange={(next) => {
          if (mode === "accept") setValue(next);
        }}
      >
        <Panel panelId="left" minSize={120}>
          <PanelFace label="left" px={value.left.size} />
        </Panel>
        <PanelResizeHandle />
        <Panel panelId="right" minSize={120}>
          <PanelFace label="right" px={value.right.size} />
        </Panel>
      </PanelGroup>
    </>
  );
}

function PanelFace({ label, px }: { label: string; px: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-0.5 bg-background/30 text-foreground">
      <span className="text-sm font-medium">{label}</span>
      <span className="font-mono text-[10px] text-muted-foreground">
        {Math.round(px)}px
      </span>
    </div>
  );
}
