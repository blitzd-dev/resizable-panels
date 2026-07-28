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

// A slow async store so the restore window is visible. onStatusChange drives
// the cover; the group stays mounted underneath so `ready` still arrives.
const store = new Map<string, string>();
const delay = <T,>(value: T) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), 500));

const slowStorage: PanelStorage = {
  getItem: (key) => delay(store.get(key) ?? null),
  setItem: (key, value) => delay(void store.set(key, value)),
};

export default function StatusGating() {
  const [instance, setInstance] = useState(0);
  const [ready, setReady] = useState(false);

  const remount = () => {
    setReady(false);
    setInstance((n) => n + 1);
  };

  return (
    <>
      <DemoControls>
        <Button variant="outline" size="sm" onClick={remount}>
          Remount from storage
        </Button>
      </DemoControls>

      <div className="relative h-full w-full">
        <PanelGroup
          key={instance}
          orientation="horizontal"
          persistence={{
            key: "docs.persistence.status",
            storage: slowStorage,
            onStatusChange: (status) => setReady(status.state === "ready"),
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
        {ready ? null : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted text-sm text-muted-foreground">
            Restoring layout…
          </div>
        )}
      </div>
    </>
  );
}
