import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelInteractionState,
} from "@blitzd/resizable-panels";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";

function Indicator() {
  const { isPointerDragging, isContainerResizing } = usePanelInteractionState();
  const active = isPointerDragging || isContainerResizing;
  const label = isPointerDragging
    ? "Dragging a handle"
    : isContainerResizing
      ? "Container resizing"
      : "Idle";

  return (
    <span
      className={
        "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors " +
        (active
          ? "border-primary/50 bg-primary/10 text-foreground"
          : "border-border bg-background text-muted-foreground")
      }
    >
      <span
        className={
          "size-2 rounded-full " +
          (active ? "bg-primary" : "bg-muted-foreground/40")
        }
      />
      {label}
    </span>
  );
}

export default function InteractionIndicator() {
  return (
    <PanelProvider>
      <DemoControls>
        <Indicator />
      </DemoControls>
      <PanelGroup orientation="horizontal">
        <Panel side="start" defaultSize={180} minSize={120}>
          <DemoPanel label="Sidebar" />
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={160}>
          <DemoPanel label="Content" muted />
        </Panel>
      </PanelGroup>
    </PanelProvider>
  );
}
