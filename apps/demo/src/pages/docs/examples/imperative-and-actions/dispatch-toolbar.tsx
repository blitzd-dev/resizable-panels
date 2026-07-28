import {
  Panel,
  PanelGroup,
  type PanelLookupActionResult,
  PanelProvider,
  PanelResizeHandle,
  usePanelActions,
} from "@blitzd/resizable-panels";
import { useRef, useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Button } from "@/components/ui/button";

const nav = { groupId: "workspace", panelId: "nav" };
const inspector = { groupId: "workspace", panelId: "inspector" };
const ghost = { groupId: "workspace", panelId: "ghost" };

function Toolbar() {
  const actions = usePanelActions();
  const renders = useRef(0);
  renders.current += 1;
  const [miss, setMiss] = useState<PanelLookupActionResult<boolean> | null>(
    null,
  );

  return (
    <DemoControls>
      <Button variant="outline" size="sm" onClick={() => actions.collapse(nav)}>
        Collapse nav
      </Button>
      <Button variant="outline" size="sm" onClick={() => actions.expand(nav)}>
        Expand nav
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => actions.setSize(nav, 240)}
      >
        nav → 240px
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => actions.toggle(inspector)}
      >
        Toggle inspector
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setMiss(actions.toggle(ghost))}
      >
        toggle(ghost)
      </Button>
      <span className="font-mono text-xs text-muted-foreground">
        {miss && !miss.applied && miss.reason === "not-found"
          ? "ghost → not-found"
          : `renders: ${renders.current}`}
      </span>
    </DemoControls>
  );
}

export default function DispatchToolbar() {
  return (
    <PanelProvider>
      <Toolbar />
      <PanelGroup groupId="workspace" orientation="horizontal">
        <Panel
          side="start"
          panelId="nav"
          defaultSize={160}
          minSize={120}
          collapsedSize={0}
        >
          <DemoPanel label="Nav" />
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={120}>
          <DemoPanel label="Editor" muted />
        </Panel>
        <PanelResizeHandle />
        <Panel
          side="end"
          panelId="inspector"
          defaultSize={160}
          minSize={120}
          collapsedSize={0}
        >
          <DemoPanel label="Inspector" />
        </Panel>
      </PanelGroup>
    </PanelProvider>
  );
}
