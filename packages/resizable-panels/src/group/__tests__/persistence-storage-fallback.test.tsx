// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PanelResizeHandle } from "../../handle/panel-resize-handle";
import { Panel, type PanelApi } from "../../panel/panel";
import { PanelProvider } from "../../provider/panel-provider";
import type { PanelGroupPersistenceOptions } from "../../types";
import { PanelGroup } from "../panel-group";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// Write-back debounce is 200ms; wait past it plus coordinator microtasks.
const WRITE_SETTLE_MS = 300;

const roots: Root[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(async () => root.unmount());
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

function settleWrites() {
  return act(
    () => new Promise((resolve) => setTimeout(resolve, WRITE_SETTLE_MS)),
  );
}

function groupTree(
  persistence: PanelGroupPersistenceOptions,
  handleRef: { current: PanelApi | null },
) {
  return (
    <PanelProvider>
      <PanelGroup orientation="horizontal" persistence={persistence}>
        <Panel
          panelId="sidebar"
          side="start"
          defaultSize={200}
          collapsible
          apiRef={handleRef}
        >
          sidebar
        </Panel>
        <PanelResizeHandle aria-label="Resize sidebar" />
        <Panel panelId="main">main</Panel>
      </PanelGroup>
    </PanelProvider>
  );
}

describe("storage adapter fallback (R-06)", () => {
  it("falls back to default localStorage when a custom adapter is later removed", async () => {
    const defaultSetItem = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: defaultSetItem,
    });

    const customSetItem = vi.fn();
    const handleRef = { current: null as PanelApi | null };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);

    // Mount WITH a custom adapter: writes go to it, never to localStorage.
    await act(async () => {
      root.render(
        groupTree(
          {
            key: "workspace",
            storage: { getItem: () => null, setItem: customSetItem },
          },
          handleRef,
        ),
      );
    });
    await settleWrites();
    expect(customSetItem).toHaveBeenCalled();
    expect(defaultSetItem).not.toHaveBeenCalled();

    // Re-render the SAME group without the storage option (key kept). The
    // fallback must resolve at render time: persistence switches to the
    // default localStorage adapter instead of staying silently disabled
    // because the first-mount useState froze the fallback at null (R-06).
    await act(async () => {
      root.render(groupTree({ key: "workspace" }, handleRef));
    });
    await act(async () => {
      handleRef.current?.collapse();
    });
    await settleWrites();

    expect(defaultSetItem).toHaveBeenCalled();
    const [key, value] = defaultSetItem.mock.calls.at(-1) as [string, string];
    expect(key).toBe("workspace");
    expect(JSON.parse(value).panels.sidebar.collapsed).toBe(true);
  });
});
