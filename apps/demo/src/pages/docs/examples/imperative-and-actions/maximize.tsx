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

export default function Maximize() {
  const editor = useRef<PanelApi>(null);
  const [landed, setLanded] = useState<number | null>(null);

  const maximize = () => {
    const result = editor.current?.maximize();
    if (result?.applied || result?.reason === "unchanged") {
      setLanded(result.value);
    }
  };

  return (
    <>
      <DemoControls>
        <Button variant="outline" size="sm" onClick={maximize}>
          editor.maximize()
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            editor.current?.reset();
            setLanded(null);
          }}
        >
          reset()
        </Button>
      </DemoControls>

      <PanelGroup orientation="horizontal">
        <Panel side="start" defaultSize={200} minSize={120} collapsedSize={0}>
          <DemoPanel label="Sidebar" muted />
        </Panel>
        <PanelResizeHandle />
        <Panel apiRef={editor} panelId="editor" minSize={160} maxSize="80%">
          <DemoPanel label="Editor">
            <span className="font-mono text-xs text-muted-foreground">
              {landed === null
                ? "maximize() grows to the resolved max (80%)"
                : `landed at ${landed}px`}
            </span>
          </DemoPanel>
        </Panel>
      </PanelGroup>
    </>
  );
}
