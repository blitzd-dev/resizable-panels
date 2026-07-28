import type { PanelGroupCascade } from "@blitzd/resizable-panels";
import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { useEffect, useRef, useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { Segmented } from "@/components/segmented";

export default function CascadeLatching() {
  const [cascade, setCascade] = useState<PanelGroupCascade>("reversible");

  return (
    <>
      <DemoControls>
        <Segmented
          options={["reversible", "latching"] as const}
          value={cascade}
          onValueChange={setCascade}
          mono
        />
      </DemoControls>

      <PanelGroup orientation="horizontal" cascade={cascade}>
        <Panel>
          <PanelFace label="A" />
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={60}>
          <PanelFace label="B" />
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={60}>
          <PanelFace label="C" />
        </Panel>
      </PanelGroup>
    </>
  );
}

// Reports its own live width, so the px readouts track the drag in real time —
// watch which panel regrows first when you reverse without releasing.
function PanelFace({ label }: { label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setPx(el.getBoundingClientRect().width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="flex h-full flex-col items-center justify-center gap-0.5 bg-background/30 text-foreground"
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="font-mono text-[10px] text-muted-foreground">
        {Math.round(px)}px
      </span>
    </div>
  );
}
