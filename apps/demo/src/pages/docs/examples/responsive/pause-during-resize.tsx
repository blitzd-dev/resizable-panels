import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  usePanelInteractionState,
} from "@blitzd/resizable-panels";
import { DemoPanel } from "@/components/demo-panel";

export default function PauseDuringResize() {
  return (
    <PanelGroup orientation="horizontal">
      <Panel side="start" defaultSize={200} minSize={120}>
        <DemoPanel label="Sidebar" />
      </Panel>
      <PanelResizeHandle />
      {/* Chart lives in a descendant of the group, so it reads the implicit
          provider's interaction flags — no explicit PanelProvider needed. */}
      <Panel minSize={160}>
        <Chart />
      </Panel>
    </PanelGroup>
  );
}

function Chart() {
  const { isPointerDragging, isContainerResizing } = usePanelInteractionState();
  const busy = isPointerDragging || isContainerResizing;

  return (
    <DemoPanel muted>
      {busy ? (
        <span className="font-mono text-xs">paused during resize…</span>
      ) : (
        <span>Expensive chart (recomputes on settle)</span>
      )}
    </DemoPanel>
  );
}
