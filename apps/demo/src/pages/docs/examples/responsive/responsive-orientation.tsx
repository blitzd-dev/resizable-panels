import {
  Panel,
  PanelGroup,
  type PanelGroupOrientation,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useEffect, useRef, useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";

const BREAKPOINT = 520;

export default function ResponsiveOrientation() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [orientation, setOrientation] =
    useState<PanelGroupOrientation>("horizontal");

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const wide = entry.contentRect.width >= BREAKPOINT;
      setOrientation(wide ? "horizontal" : "vertical");
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <DemoControls>
        <span className="font-mono text-xs text-muted-foreground">
          orientation = "{orientation}"
        </span>
      </DemoControls>

      <div ref={wrapperRef} className="h-full w-full">
        <PanelGroup orientation={orientation}>
          <Panel
            side="start"
            defaultSize="35%"
            minSize={80}
            collapsible={false}
          >
            <DemoPanel label="Sidebar" />
          </Panel>
          <PanelResizeHandle />
          <Panel minSize={80}>
            <DemoPanel label="Main content" muted />
          </Panel>
        </PanelGroup>
      </div>
    </>
  );
}
