import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelActions,
  usePanelControls,
} from "@blitzd/resizable-panels";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Button } from "@/components/ui/button";

const sidebar = { groupId: "readout-demo", panelId: "sidebar" };

function Readout() {
  const controls = usePanelControls(sidebar);
  if (!controls) {
    return (
      <span className="font-mono text-xs text-muted-foreground">
        Waiting for the sidebar to mount…
      </span>
    );
  }

  const fields: [string, string][] = [
    ["kind", controls.kind],
    ["side", controls.kind === "docked" ? controls.side : "—"],
    ["size", `${Math.round(controls.size)}px`],
    ["renderedSize", `${Math.round(controls.renderedSize)}px`],
    ["collapsed", String(controls.collapsed)],
    ["min", `${Math.round(controls.constraints.minSize)}px`],
    ["max", `${Math.round(controls.constraints.maxSize)}px`],
  ];

  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-xs">
      {fields.map(([label, value]) => (
        <span key={label}>
          <span className="text-muted-foreground">{label} </span>
          <span className="text-foreground">{value}</span>
        </span>
      ))}
    </span>
  );
}

function ToggleButton() {
  const actions = usePanelActions();
  return (
    <Button variant="outline" size="sm" onClick={() => actions.toggle(sidebar)}>
      Toggle collapse
    </Button>
  );
}

export default function ControlsReadout() {
  return (
    <PanelProvider>
      <DemoControls>
        <Readout />
        <ToggleButton />
      </DemoControls>
      <PanelGroup groupId="readout-demo" orientation="horizontal">
        <Panel
          side="start"
          panelId="sidebar"
          defaultSize={200}
          minSize={120}
          maxSize={340}
          collapsedSize={48}
        >
          <DemoPanel label="Sidebar" />
        </Panel>
        <PanelResizeHandle />
        <Panel>
          <DemoPanel label="Content" muted />
        </Panel>
      </PanelGroup>
    </PanelProvider>
  );
}
