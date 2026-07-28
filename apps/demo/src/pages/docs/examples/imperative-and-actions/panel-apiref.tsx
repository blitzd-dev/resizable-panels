import {
  Panel,
  type PanelApi,
  PanelGroup,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useRef, useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Button } from "@/components/ui/button";

export default function PanelApiRef() {
  const sidebar = useRef<PanelApi>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);

  const read = () => {
    const api = sidebar.current;
    if (!api) return;
    setSnapshot(
      `getSize() = ${api.getSize()}px\n` +
        `getRenderedSize() = ${api.getRenderedSize()}px\n` +
        `isCollapsed() = ${api.isCollapsed()}`,
    );
  };

  return (
    <>
      <DemoControls>
        <Button
          variant="outline"
          size="sm"
          onClick={() => sidebar.current?.toggle()}
        >
          toggle()
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => sidebar.current?.collapse()}
        >
          collapse()
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => sidebar.current?.expand()}
        >
          expand()
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => sidebar.current?.setSize(320)}
        >
          setSize(320)
        </Button>
        <Button variant="outline" size="sm" onClick={read}>
          Read snapshot
        </Button>
      </DemoControls>

      <PanelGroup orientation="horizontal">
        <Panel apiRef={sidebar} side="start" defaultSize={240} minSize={120}>
          <DemoPanel label="Sidebar" />
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={160}>
          <DemoPanel muted>
            {snapshot ? (
              <pre className="whitespace-pre text-center font-mono text-xs text-foreground">
                {snapshot}
              </pre>
            ) : (
              "Press “Read snapshot” to sample the getters"
            )}
          </DemoPanel>
        </Panel>
      </PanelGroup>
    </>
  );
}
