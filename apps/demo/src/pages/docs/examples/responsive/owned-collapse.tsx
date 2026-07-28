import {
  Panel,
  type PanelApi,
  PanelGroup,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useEffect, useRef, useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";

const BREAKPOINT = 480;

export default function OwnedCollapse() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sidebar = useRef<PanelApi>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const isNarrow = entry.contentRect.width < BREAKPOINT;
      setNarrow(isNarrow);
      // Your policy, your call: collapse fully here, or demote to a rail,
      // a sheet, or anything else. The panel just does what you ask.
      if (isNarrow) sidebar.current?.collapse();
      else sidebar.current?.expand();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <DemoControls>
        <span className="font-mono text-xs text-muted-foreground">
          {narrow ? "narrow → collapsed" : "wide → expanded"}
        </span>
      </DemoControls>

      <div ref={wrapperRef} className="h-full w-full">
        <PanelGroup orientation="horizontal">
          <Panel
            apiRef={sidebar}
            side="start"
            defaultSize={200}
            minSize={140}
            collapsedSize={0}
          >
            <DemoPanel label="Navigation" />
          </Panel>
          <PanelResizeHandle />
          <Panel minSize={160}>
            <DemoPanel label="Main content" muted />
          </Panel>
        </PanelGroup>
      </div>
    </>
  );
}
