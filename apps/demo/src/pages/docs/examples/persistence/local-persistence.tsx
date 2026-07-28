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

export default function LocalPersistence() {
  const sidebar = useRef<PanelApi>(null);
  // Bumping the key unmounts the group and mounts a fresh one, which reads
  // the last layout back from localStorage — the same path a reload takes.
  const [instance, setInstance] = useState(0);

  return (
    <>
      <DemoControls>
        <Button
          variant="outline"
          size="sm"
          onClick={() => sidebar.current?.toggle()}
        >
          Toggle sidebar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setInstance((n) => n + 1)}
        >
          Remount from storage
        </Button>
      </DemoControls>

      <PanelGroup
        key={instance}
        orientation="horizontal"
        persistence={{ key: "docs.persistence.local" }}
      >
        <Panel
          apiRef={sidebar}
          panelId="sidebar"
          side="start"
          defaultSize={220}
          minSize={140}
        >
          <DemoPanel label="Sidebar" />
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={160}>
          <DemoPanel label="Main content" muted />
        </Panel>
      </PanelGroup>
    </>
  );
}
