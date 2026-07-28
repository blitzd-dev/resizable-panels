import {
  Panel,
  PanelGroup,
  type PanelGroupApi,
  type PanelGroupValue,
  PanelProvider,
  PanelResizeHandle,
  type PanelStorage,
} from "@blitzd/resizable-panels";
import { useRef, useState } from "react";

type PendingWrite = {
  id: number;
  key: string;
  value: string;
  status: "pending" | "resolved" | "rejected";
  resolve: () => void;
  reject: () => void;
};

type DeferredWriteStorage = PanelStorage & {
  name: string;
  writes: PendingWrite[];
  values: Map<string, string>;
  active: number;
  maxActive: number;
  armed: boolean;
  calls: number;
  arm: () => void;
  resolve: (which: "oldest" | "newest") => void;
  reject: (which: "oldest" | "newest") => void;
};

function createDeferredWriteStorage(name: string): DeferredWriteStorage {
  let nextId = 1;
  const storage: DeferredWriteStorage = {
    name,
    writes: [],
    values: new Map(),
    active: 0,
    maxActive: 0,
    armed: false,
    calls: 0,
    getItem(key) {
      return storage.values.get(key) ?? null;
    },
    setItem(key, value) {
      storage.calls += 1;
      if (!storage.armed) {
        storage.values.set(key, value);
        return;
      }
      storage.active += 1;
      storage.maxActive = Math.max(storage.maxActive, storage.active);
      return new Promise<void>((resolve, reject) => {
        const write: PendingWrite = {
          id: nextId++,
          key,
          value,
          status: "pending",
          resolve() {
            if (write.status !== "pending") return;
            write.status = "resolved";
            storage.active -= 1;
            storage.values.set(key, value);
            resolve();
          },
          reject() {
            if (write.status !== "pending") return;
            write.status = "rejected";
            storage.active -= 1;
            reject(new Error(`${name}:${key}:write failed`));
          },
        };
        storage.writes.push(write);
      });
    },
    arm() {
      storage.armed = true;
      storage.writes.length = 0;
      storage.active = 0;
      storage.maxActive = 0;
      storage.calls = 0;
    },
    resolve(which) {
      const pending = storage.writes.filter(
        (write) => write.status === "pending",
      );
      const write = which === "oldest" ? pending[0] : pending.at(-1);
      write?.resolve();
    },
    reject(which) {
      const pending = storage.writes.filter(
        (write) => write.status === "pending",
      );
      const write = which === "oldest" ? pending[0] : pending.at(-1);
      write?.reject();
    },
  };
  return storage;
}

function layout(primarySize: number): PanelGroupValue {
  return {
    primary: { size: primarySize },
    main: { size: 1200 - primarySize },
  };
}

/** Written snapshots use the versioned storage document shape. */
type PersistedDocument = {
  version: 1;
  orientation: "horizontal" | "vertical";
  panels: Record<string, { size: number; collapsed?: boolean }>;
};

function primarySize(serialized: string | undefined): number | null {
  if (!serialized) return null;
  return (
    (JSON.parse(serialized) as PersistedDocument).panels.primary?.size ?? null
  );
}

export default function PersistenceWriteLifecycleTest() {
  const [mounted, setMounted] = useState(true);
  const [persistenceKey, setPersistenceKey] = useState("layout-a");
  const [storageA] = useState(() => createDeferredWriteStorage("a"));
  const [storageB] = useState(() => createDeferredWriteStorage("b"));
  const [storage, setStorage] = useState(storageA);
  const groupRef = useRef<PanelGroupApi>(null);
  const errorsRef = useRef<string[]>([]);

  const inspect = (element: HTMLElement) => {
    const describe = (candidate: DeferredWriteStorage) => ({
      active: candidate.active,
      maxActive: candidate.maxActive,
      calls: candidate.calls,
      stored: Object.fromEntries(
        Array.from(candidate.values, ([key, value]) => [
          key,
          primarySize(value),
        ]),
      ),
      writes: candidate.writes.map((write) => ({
        id: write.id,
        key: write.key,
        primarySize: primarySize(write.value),
        status: write.status,
      })),
    });
    element.dataset.state = JSON.stringify({
      a: describe(storageA),
      b: describe(storageB),
      errors: errorsRef.current,
    });
  };

  return (
    <PanelProvider>
      <div className="fixture-root">
        {mounted ? (
          <PanelGroup
            apiRef={groupRef}
            orientation="horizontal"
            persistence={{
              key: persistenceKey,
              storage,
              onError: (event) => {
                const message =
                  event.error instanceof Error
                    ? event.error.message
                    : String(event.error);
                errorsRef.current.push(
                  `${event.operation}:${event.key}:${message}`,
                );
              },
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
            <PanelResizeHandle data-testid="write-handle" />
            <Panel panelId="main" minSize={100}>
              main
            </Panel>
          </PanelGroup>
        ) : null}
        <div className="toolbar-overlay">
          <div className="toolbar">
            <button
              type="button"
              data-testid="arm-writes"
              onClick={() => {
                storageA.arm();
                storageB.arm();
              }}
            >
              arm
            </button>
            {[200, 250, 300, 420].map((size) => (
              <button
                key={size}
                type="button"
                data-testid={`set-primary-${size}`}
                onClick={() => groupRef.current?.setValue(layout(size))}
              >
                set {size}
              </button>
            ))}
            <button
              type="button"
              data-testid="change-write-key"
              onClick={() => setPersistenceKey("layout-b")}
            >
              key b
            </button>
            <button
              type="button"
              data-testid="change-write-storage"
              onClick={() => setStorage(storageB)}
            >
              storage b
            </button>
            <button
              type="button"
              data-testid="unmount-write-group"
              onClick={() => setMounted(false)}
            >
              unmount
            </button>
            <button
              type="button"
              data-testid="resolve-oldest-write"
              onClick={() => {
                storageA.resolve("oldest");
                storageB.resolve("oldest");
              }}
            >
              resolve oldest
            </button>
            <button
              type="button"
              data-testid="resolve-newest-write"
              onClick={() => {
                storageA.resolve("newest");
                storageB.resolve("newest");
              }}
            >
              resolve newest
            </button>
            <button
              type="button"
              data-testid="reject-oldest-write"
              onClick={() => {
                storageA.reject("oldest");
                storageB.reject("oldest");
              }}
            >
              reject oldest
            </button>
            <button
              type="button"
              data-testid="inspect-write-storage"
              onClick={(event) => inspect(event.currentTarget)}
            >
              inspect
            </button>
          </div>
        </div>
      </div>
    </PanelProvider>
  );
}
