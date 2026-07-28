import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelRegistry,
} from "@blitzd/resizable-panels";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";

// A live snapshot of every named panel in one group, keyed by panelId.
// Anonymous panels (the Scratch panel) stay resizable but never appear.
function RegistryList() {
  const panels = usePanelRegistry("workspace");
  const entries = Object.entries(panels);

  if (entries.length === 0) {
    return (
      <span className="font-mono text-xs text-muted-foreground">
        No panels published yet.
      </span>
    );
  }

  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-xs">
      {entries.map(([panelId, controls]) => (
        <li key={panelId}>
          <span className="text-foreground">{panelId}</span>{" "}
          <span className="text-muted-foreground">
            {Math.round(controls.renderedSize)}px · {controls.kind}
            {controls.collapsed ? " · collapsed" : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function RegistryListExample() {
  return (
    <PanelProvider>
      <DemoControls>
        <RegistryList />
      </DemoControls>
      <PanelGroup groupId="workspace" orientation="horizontal">
        <Panel
          side="start"
          panelId="nav"
          defaultSize={140}
          minSize={100}
          maxSize={280}
        >
          <DemoPanel label="Nav" />
        </Panel>
        <PanelResizeHandle />
        <Panel panelId="editor" minSize={80}>
          <DemoPanel label="Editor" />
        </Panel>
        <PanelResizeHandle />
        <Panel panelId="preview" minSize={80}>
          <DemoPanel label="Preview" />
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={80}>
          <DemoPanel label="Scratch (no id)" muted />
        </Panel>
      </PanelGroup>
    </PanelProvider>
  );
}
