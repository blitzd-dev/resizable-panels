import {
  Panel,
  PanelGroup,
  type PanelGroupApi,
  type PanelGroupValue,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useRef, useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Button } from "@/components/ui/button";

export default function GroupApiRef() {
  const group = useRef<PanelGroupApi>(null);
  const [value, setValue] = useState<PanelGroupValue | null>(null);

  const show = () => setValue(group.current?.getValue() ?? null);

  const write = (next: PanelGroupValue) => {
    group.current?.setValue(next);
    show();
  };

  return (
    <>
      <DemoControls>
        <Button variant="outline" size="sm" onClick={show}>
          getValue()
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => write({ sidebar: { size: 340 } })}
        >
          setValue(sidebar 340)
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => write({ sidebar: { size: 220, collapsed: true } })}
        >
          setValue(collapsed)
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            group.current?.resetValue();
            show();
          }}
        >
          resetValue()
        </Button>
      </DemoControls>

      <PanelGroup
        apiRef={group}
        orientation="horizontal"
        defaultValue={{ sidebar: { size: 220 } }}
      >
        <Panel panelId="sidebar" side="start" defaultSize={220} minSize={120}>
          <DemoPanel label="sidebar" />
        </Panel>
        <PanelResizeHandle />
        <Panel panelId="main" minSize={160}>
          <DemoPanel muted>
            <pre className="max-w-full overflow-x-auto font-mono text-xs text-foreground">
              {value
                ? JSON.stringify(value, null, 2)
                : "Press “getValue()” to read the layout"}
            </pre>
          </DemoPanel>
        </Panel>
      </PanelGroup>
    </>
  );
}
