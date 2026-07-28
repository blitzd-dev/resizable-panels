import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { DemoPanel } from "@/components/demo-panel";

export default function SlotProps() {
  return (
    <PanelGroup orientation="horizontal">
      <Panel
        side="start"
        defaultSize={240}
        minSize={160}
        // Root className styles the outermost panel element.
        className="border-r border-border"
        slotProps={{
          // The viewport is the clip box — round it and the content clips to
          // the rounded corners.
          viewport: {
            className: "rounded-lg ring-1 ring-inset ring-primary/40",
          },
          // The content element directly wraps your children — pad it to
          // inset them from the clipping edge.
          content: { className: "p-4" },
        }}
      >
        <div className="flex h-full flex-col gap-2 text-sm">
          <p className="font-medium text-foreground">Slot-styled panel</p>
          <p className="text-muted-foreground">
            Ring on the viewport, padding on the content, border on the root —
            three separate elements.
          </p>
        </div>
      </Panel>
      <PanelResizeHandle />
      <Panel minSize={160}>
        <DemoPanel label="Main content" muted />
      </Panel>
    </PanelGroup>
  );
}
