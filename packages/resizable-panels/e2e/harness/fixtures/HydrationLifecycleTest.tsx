import {
  Panel,
  PanelGroup,
  type PanelGroupApi,
  type PanelGroupOrientation,
  PanelProvider,
  PanelResizeHandle,
  type PanelStorage,
} from "@blitzd/resizable-panels";
import { useRef, useState } from "react";

/** The persisted storage document shape written/read by PanelGroup. */
type PersistedDocument = {
  version: 1;
  orientation: PanelGroupOrientation;
  panels: Record<string, { size: number; collapsed?: boolean }>;
};

type PendingRead = {
  key: string;
  resolve: (value: string | null) => void;
};

type DeferredStorage = PanelStorage & {
  pending: PendingRead[];
  reads: string[];
  writes: string[];
  resolve: (key: string, document: PersistedDocument) => void;
};

function createDeferredStorage(name: string): DeferredStorage {
  const pending: PendingRead[] = [];
  const reads: string[] = [];
  const writes: string[] = [];
  return {
    pending,
    reads,
    writes,
    getItem(key) {
      reads.push(`${name}:${key}`);
      return new Promise<string | null>((resolve) => {
        pending.push({ key, resolve });
      });
    },
    setItem(key, value) {
      writes.push(`${name}:${key}:${value}`);
    },
    resolve(key, document) {
      const index = pending.findIndex((read) => read.key === key);
      if (index < 0) return;
      const [read] = pending.splice(index, 1);
      read.resolve(JSON.stringify(document));
    },
  };
}

function persistedLayout(
  orientation: PanelGroupOrientation,
  primarySize: number,
): PersistedDocument {
  const total = orientation === "horizontal" ? 1200 : 800;
  return {
    version: 1,
    orientation,
    panels: {
      primary: { size: primarySize },
      main: { size: total - primarySize },
    },
  };
}

export default function HydrationLifecycleTest() {
  const [persistenceKey, setPersistenceKey] = useState("layout-a");
  const [orientation, setOrientation] =
    useState<PanelGroupOrientation>("horizontal");
  const [storageA] = useState(() => createDeferredStorage("a"));
  const [storageB] = useState(() => createDeferredStorage("b"));
  const [storage, setStorage] = useState<DeferredStorage>(storageA);
  const groupRef = useRef<PanelGroupApi>(null);
  const eventsRef = useRef<HTMLDivElement>(null);
  // Every persistence.onStatusChange call, in order, as "state:key" —
  // the specs assert restoring→ready ordering and exactly-once delivery.
  const statusEventsRef = useRef<string[]>([]);

  const recordStorage = (element: HTMLElement) => {
    element.dataset.reads = JSON.stringify([
      ...storageA.reads,
      ...storageB.reads,
    ]);
    element.dataset.writes = JSON.stringify([
      ...storageA.writes,
      ...storageB.writes,
    ]);
    element.dataset.pending = JSON.stringify({
      a: storageA.pending.map((read) => read.key),
      b: storageB.pending.map((read) => read.key),
    });
    element.dataset.status = JSON.stringify(statusEventsRef.current);
  };

  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup
          apiRef={groupRef}
          orientation={orientation}
          persistence={{
            key: persistenceKey,
            storage,
            onStatusChange: (status) => {
              statusEventsRef.current.push(`${status.state}:${status.key}`);
            },
          }}
          onValueChange={(value, details) => {
            if (!eventsRef.current) return;
            const count = Number(eventsRef.current.dataset.count ?? "0") + 1;
            eventsRef.current.dataset.count = String(count);
            eventsRef.current.dataset.reason = details.reason;
            eventsRef.current.dataset.trigger = details.trigger;
            eventsRef.current.dataset.value = JSON.stringify(value);
          }}
        >
          <Panel
            panelId="primary"
            side="start"
            defaultSize={240}
            minSize={100}
            maxSize={600}
          >
            primary
          </Panel>
          <PanelResizeHandle data-testid="hydration-handle" />
          <Panel panelId="main" minSize={100}>
            main
          </Panel>
        </PanelGroup>
        <div className="toolbar-overlay">
          <div className="toolbar">
            <button
              type="button"
              data-testid="read-hydration-layout"
              onClick={(event) => {
                event.currentTarget.dataset.layout = JSON.stringify(
                  groupRef.current?.getValue(),
                );
              }}
            >
              read layout
            </button>
            <button
              type="button"
              data-testid="inspect-hydration-storage"
              onClick={(event) => recordStorage(event.currentTarget)}
            >
              inspect storage
            </button>
            <button
              type="button"
              data-testid="resolve-a-layout-a"
              onClick={() =>
                storageA.resolve("layout-a", persistedLayout("horizontal", 320))
              }
            >
              resolve a/layout-a
            </button>
            <button
              type="button"
              data-testid="resolve-a-layout-b"
              onClick={() =>
                storageA.resolve("layout-b", persistedLayout("horizontal", 420))
              }
            >
              resolve a/layout-b
            </button>
            <button
              type="button"
              data-testid="resolve-b-layout-b"
              onClick={() =>
                storageB.resolve("layout-b", persistedLayout("horizontal", 480))
              }
            >
              resolve b/layout-b
            </button>
            <button
              type="button"
              data-testid="resolve-b-layout-b-vertical"
              onClick={() =>
                storageB.resolve("layout-b", persistedLayout("vertical", 500))
              }
            >
              resolve b/layout-b vertical
            </button>
            <button
              type="button"
              data-testid="change-hydration-key"
              onClick={() => setPersistenceKey("layout-b")}
            >
              key b
            </button>
            <button
              type="button"
              data-testid="change-hydration-storage"
              onClick={() => setStorage(storageB)}
            >
              storage b
            </button>
            <button
              type="button"
              data-testid="change-hydration-orientation"
              onClick={() => setOrientation("vertical")}
            >
              vertical
            </button>
          </div>
        </div>
        <div
          ref={eventsRef}
          data-testid="hydration-events"
          data-count="0"
          data-reason=""
          data-trigger=""
          data-value=""
        />
      </div>
    </PanelProvider>
  );
}
