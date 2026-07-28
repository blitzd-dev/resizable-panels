import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type PanelStorage,
} from "@blitzd/resizable-panels";
import { useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Button } from "@/components/ui/button";

// An in-memory store with an artificial delay to exercise the async path.
// Swap the two method bodies for document.cookie or a fetch and nothing
// else about the group changes.
const store = new Map<string, string>();
const delay = <T,>(value: T) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), 250));

const asyncStorage: PanelStorage = {
  getItem: (key) => delay(store.get(key) ?? null),
  setItem: (key, value) => delay(void store.set(key, value)),
};

export default function CustomStorage() {
  const [instance, setInstance] = useState(0);

  return (
    <>
      <DemoControls>
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
        persistence={{ key: "docs.persistence.custom", storage: asyncStorage }}
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
