import {
  Panel,
  PanelGroup,
  type PanelPersistenceError,
  PanelResizeHandle,
  type PanelStorage,
} from "@blitzd/resizable-panels";
import { useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Button } from "@/components/ui/button";

// Seeded with a corrupt value: the first read cannot be parsed, so onError
// fires with operation "deserialize" and the group keeps its declarative
// defaults. Dragging the seam writes a valid layout over the bad one.
let raw: string | null = "{ not valid json";

const seededStorage: PanelStorage = {
  getItem: () => raw,
  setItem: (_key, value) => {
    raw = value;
  },
};

export default function DeserializeError() {
  const [instance, setInstance] = useState(0);
  const [error, setError] = useState<PanelPersistenceError | null>(null);

  const remount = () => {
    setError(null);
    setInstance((n) => n + 1);
  };

  return (
    <>
      <DemoControls>
        <Button variant="outline" size="sm" onClick={remount}>
          Remount from storage
        </Button>
        <span className="text-xs text-muted-foreground">
          onError:{" "}
          <span className="font-mono">{error ? error.operation : "none"}</span>
        </span>
      </DemoControls>

      <PanelGroup
        key={instance}
        orientation="horizontal"
        persistence={{
          key: "docs.persistence.error",
          storage: seededStorage,
          onError: (err) => setError(err),
        }}
      >
        <Panel panelId="sidebar" side="start" defaultSize={220} minSize={140}>
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
