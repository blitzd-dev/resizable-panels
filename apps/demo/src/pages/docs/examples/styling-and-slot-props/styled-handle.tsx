import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { type CSSProperties, useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Segmented } from "@/components/segmented";

// The library paints the separator line with
// var(--resizable-panels-resize-handle-color, rgb(120, 120, 120)).
const lineColors = {
  default: "rgb(120, 120, 120)",
  accent: "var(--primary)",
  amber: "#f59e0b",
} as const;
type LineColor = keyof typeof lineColors;

export default function StyledHandle() {
  const [color, setColor] = useState<LineColor>("accent");

  return (
    <>
      <DemoControls>
        <Segmented
          mono
          options={["default", "accent", "amber"] as const}
          value={color}
          onValueChange={setColor}
        />
      </DemoControls>

      {/* Set the CSS variable on a wrapper — not on PanelGroup, whose style
          prop owns width/height. It cascades to every handle line inside. */}
      <div
        className="h-full"
        style={
          {
            "--resizable-panels-resize-handle-color": lineColors[color],
          } as CSSProperties
        }
      >
        <PanelGroup orientation="horizontal">
          <Panel defaultSize="50%" minSize={120}>
            <DemoPanel label="Left" />
          </Panel>
          {/* A gutter gives the handle real width to style. data-active flips
              on while the handle is hovered, focused, or dragged — key the
              gutter background off it. The centered line uses the variable. */}
          <PanelResizeHandle
            gutterSize={8}
            className="bg-muted/40 transition-colors data-[active]:bg-muted-foreground/20"
          />
          <Panel minSize={120}>
            <DemoPanel label="Right" muted />
          </Panel>
        </PanelGroup>
      </div>
    </>
  );
}
