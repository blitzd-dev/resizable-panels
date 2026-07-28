import {
  Panel,
  PanelGroup,
  type PanelGroupCommandResult,
  type PanelGroupValue,
  PanelProvider,
  PanelResizeHandle,
  usePanelActions,
} from "@blitzd/resizable-panels";
import { useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Button } from "@/components/ui/button";

const wide: PanelGroupValue = {
  left: { size: 320 },
  right: { size: 120 },
};

function Controls() {
  const actions = usePanelActions();
  const [read, setRead] = useState<PanelGroupValue | undefined>();
  const [command, setCommand] = useState<PanelGroupCommandResult | null>(null);

  return (
    <DemoControls>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setRead(actions.getGroupValue("layout"))}
      >
        getGroupValue("layout")
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setRead(actions.getGroupValue("nope"))}
      >
        getGroupValue("nope")
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setCommand(actions.setGroupValue("layout", wide))}
      >
        setGroupValue(…)
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setCommand(actions.resetGroupValue("layout"))}
      >
        resetGroupValue()
      </Button>
      <span className="font-mono text-xs text-muted-foreground">
        {command
          ? `command: ${JSON.stringify(command)}`
          : read === undefined
            ? "read: undefined"
            : `read: ${JSON.stringify(read)}`}
      </span>
    </DemoControls>
  );
}

export default function GroupCommands() {
  return (
    <PanelProvider>
      <Controls />
      <PanelGroup
        groupId="layout"
        orientation="horizontal"
        defaultValue={{ left: { size: 240 } }}
      >
        <Panel panelId="left" side="start" defaultSize={240} minSize={120}>
          <DemoPanel label="Left" />
        </Panel>
        <PanelResizeHandle />
        <Panel panelId="right" minSize={120}>
          <DemoPanel label="Right" muted />
        </Panel>
      </PanelGroup>
    </PanelProvider>
  );
}
