import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelGroupState,
} from "@blitzd/resizable-panels";
import { useEffect, useState } from "react";
import { DemoPanel } from "@/components/demo-panel";

const PANE = "pane";
const items = ["Inbox", "Sent", "Drafts", "Archive"];

// The same four items rendered as a side list (split) or a top strip (stack).
function Items({ variant }: { variant: "list" | "tabs" }) {
  const list = variant === "list";
  return (
    <div
      className={`flex gap-1 bg-background/30 p-2 text-xs text-muted-foreground ${
        list ? "h-full flex-col" : "overflow-x-auto border-b border-border"
      }`}
    >
      {items.map((item) => (
        <span
          key={item}
          className={`rounded px-2 py-1 ${list ? "" : "shrink-0 bg-muted"}`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

// Reads the measured containerSize and swaps the list column for a top tab
// strip below a breakpoint — the right measurement for a nested group or a
// split view, where window.matchMedia is the wrong number.
function ResponsivePane() {
  const state = usePanelGroupState(PANE);
  const [mode, setMode] = useState<"split" | "stack">("split");

  // Hysteresis: cross the LOWER edge to stack, the HIGHER edge to split.
  // Effect-phase (not render-phase): remounting PanelGroup children from a
  // render-phase setState hits React 18's max update depth.
  useEffect(() => {
    if (!state?.measured) return;
    const w = state.containerSize;
    setMode((current) => {
      if (current === "split" && w < 420) return "stack";
      if (current === "stack" && w > 520) return "split";
      return current;
    });
  }, [state]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-between border-b border-border px-2 py-1.5 font-mono text-xs">
        <span className="text-foreground">
          containerSize {state ? `${Math.round(state.containerSize)}px` : "—"}
        </span>
        <span className="text-muted-foreground">mode: {mode}</span>
      </div>
      {/* The measured group stays mounted in both modes, so containerSize keeps
          updating and a widen restores the split. Only its children swap. */}
      <div className="min-h-0 flex-1">
        <PanelGroup groupId={PANE} orientation="horizontal">
          {mode === "split" && (
            <>
              <Panel
                side="start"
                panelId="list"
                defaultSize={180}
                minSize={140}
              >
                <Items variant="list" />
              </Panel>
              <PanelResizeHandle />
            </>
          )}
          <Panel panelId="detail">
            <div className="flex h-full flex-col bg-background/30">
              {mode === "stack" && <Items variant="tabs" />}
              <DemoPanel label="Detail" muted />
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

export default function GroupStateSwap() {
  return (
    <PanelProvider>
      {/* Outer group is only a resizer: dragging its seam changes the inner
          pane's containerSize, which is what usePanelGroupState reads. */}
      <PanelGroup orientation="horizontal">
        <Panel side="start" defaultSize={560} minSize={220}>
          <ResponsivePane />
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={80}>
          <DemoPanel label="Drag the seam ← to narrow the pane" muted />
        </Panel>
      </PanelGroup>
    </PanelProvider>
  );
}
