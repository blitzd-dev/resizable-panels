import {
  Panel,
  PanelGroup,
  type PanelPersistenceError,
  type PanelPersistenceStatus,
  PanelProvider,
  PanelResizeHandle,
  type PanelStorage,
} from "@blitzd/resizable-panels";
import { useMemo } from "react";
import { PanelBody, Toolbar } from "./shared";

const STORAGE_KEY = "resizable-panels-persist-test";

/** Ordered persistence lifecycle log, readable by the spec. Statuses are
 *  recorded as "state:key"; errors as {operation, key, message}. A fresh
 *  page load resets both (module scope re-evaluates per load). */
function persistenceLog() {
  window.__resizablePanelsPersistence ??= { status: [], errors: [] };
  return window.__resizablePanelsPersistence;
}

function recordStatus(status: PanelPersistenceStatus) {
  persistenceLog().status.push(`${status.state}:${status.key}`);
}

function recordError(error: PanelPersistenceError) {
  persistenceLog().errors.push({
    operation: error.operation,
    key: error.key,
    message:
      error.error instanceof Error ? error.error.message : String(error.error),
  });
}

/** sessionStorage wrapped as a `PanelStorage`. Distinct from the default
 *  (localStorage) so the spec can prove the user-supplied adapter is the
 *  one being called — round-trip works because sessionStorage outlives a
 *  reload within the same tab. */
function sessionAdapter(): PanelStorage {
  return {
    getItem: (k) => window.sessionStorage.getItem(k),
    setItem: (k, v) => {
      window.sessionStorage.setItem(k, v);
    },
  };
}

/** Adapter that always throws — simulates the quota / private-mode failure
 *  mode. `writeSnapshot` and `readSnapshot` both have try/catches around
 *  storage calls; this adapter pokes at both. We log the throw count on
 *  `window.__resizablePanelsThrowCount` so the spec can assert the lib actually
 *  attempted the call (i.e. we're not testing dead code). */
declare global {
  interface Window {
    __resizablePanelsThrowCount?: { get: number; set: number };
    __resizablePanelsPersistence?: {
      status: string[];
      errors: Array<{ operation: string; key: string; message: string }>;
    };
  }
}
function throwingAdapter(): PanelStorage {
  window.__resizablePanelsThrowCount = { get: 0, set: 0 };
  return {
    getItem: () => {
      window.__resizablePanelsThrowCount!.get += 1;
      throw new Error("simulated storage read failure");
    },
    setItem: () => {
      window.__resizablePanelsThrowCount!.set += 1;
      // DOMException name matches the real quota-exceeded throw so anyone
      // reading the test sees the intent.
      const err = new Error("QuotaExceededError");
      err.name = "QuotaExceededError";
      throw err;
    },
  };
}

/** Adapter whose `getItem` rejects asynchronously — the promise-based
 *  failure path, distinct from the synchronous throw above. Writes succeed
 *  so the write path stays observable. */
function rejectingAdapter(): PanelStorage {
  window.__resizablePanelsThrowCount = { get: 0, set: 0 };
  return {
    getItem: () => {
      window.__resizablePanelsThrowCount!.get += 1;
      return Promise.reject(new Error("simulated async storage read failure"));
    },
    setItem: () => {
      window.__resizablePanelsThrowCount!.set += 1;
    },
  };
}

/**
 * Full-viewport persistence harness.
 *
 * Query params (composable):
 * - `?storage=session` — wrap sessionStorage, exercising the user-supplied
 *   adapter path. Survives reload (round-trip works).
 * - `?storage=throwing` — adapter whose `getItem` and `setItem` always
 *   throw, simulating a quota-exceeded / private-mode failure.
 * - `?storage=rejecting` — adapter whose `getItem` rejects asynchronously,
 *   the promise-based read-failure path.
 * - `?pinned=nav` — apply `pinned` to nav, so the spec can verify pin state
 *   is implicitly preserved across reload (the prop is part of the spec,
 *   not persisted — but the panel's own size/collapsed state still must
 *   round-trip).
 *
 * Layout mixes two docked and two peer panels so a single round-trip can
 * assert preferred sizes and collapsible state across both panel kinds.
 */
export default function PersistenceTest() {
  // Specs drive params via full page loads, so reading location once per
  // render (no router subscription) is enough.
  const params = new URLSearchParams(window.location.search);
  const storageMode = params.get("storage");
  const pinnedIds = (params.get("pinned") ?? "").split(",").filter(Boolean);
  const storage = useMemo<PanelStorage | undefined>(() => {
    if (storageMode === "session") return sessionAdapter();
    if (storageMode === "throwing") return throwingAdapter();
    if (storageMode === "rejecting") return rejectingAdapter();
    return undefined;
  }, [storageMode]);

  const isPinned = (id: string) => pinnedIds.includes(id);

  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup
          orientation="horizontal"
          groupId="persistence"
          persistence={{
            key: STORAGE_KEY,
            storage,
            onError: recordError,
            onStatusChange: recordStatus,
          }}
        >
          <Panel
            panelId="nav"
            side="start"
            defaultSize="18%"
            minSize="12%"
            maxSize="30%"
            pinned={isPinned("nav")}
            className="panel-surface"
          >
            <PanelBody groupId="persistence" label="nav" />
          </Panel>
          <PanelResizeHandle />
          <Panel panelId="main" minSize="15%">
            <PanelBody groupId="persistence" label="main" variant="grow" />
          </Panel>
          <PanelResizeHandle />
          <Panel panelId="aux" minSize="15%">
            <PanelBody groupId="persistence" label="aux" variant="grow" />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="inspector"
            side="end"
            defaultSize="22%"
            minSize="15%"
            maxSize="35%"
            pinned={isPinned("inspector")}
            className="panel-surface"
          >
            <PanelBody groupId="persistence" label="inspector" />
          </Panel>
        </PanelGroup>
        <Toolbar
          panels={["nav", "inspector"].map((panelId) => ({
            groupId: "persistence",
            panelId,
          }))}
        />
      </div>
    </PanelProvider>
  );
}
