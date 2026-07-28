// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { serializePersistedValue } from "../../core/layout-state";
import { PanelResizeHandle } from "../../handle/panel-resize-handle";
import { Panel } from "../../panel/panel";
import { PanelProvider } from "../../provider/panel-provider";
import { PanelGroup, type PanelGroupApi } from "../panel-group";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(async () => root.unmount());
  }
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const settle = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 250)));

describe("reset baseline (§2)", () => {
  it("resets to declarative defaults, never to the restored persisted value", async () => {
    const stored = serializePersistedValue("horizontal", {
      sidebar: { size: 300, collapsed: false },
    });
    const setItem = vi.fn();
    const groupRef = { current: null as PanelGroupApi | null };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <PanelProvider>
          <PanelGroup
            orientation="horizontal"
            persistence={{
              key: "workspace",
              storage: { getItem: () => stored, setItem },
            }}
            apiRef={groupRef}
          >
            <Panel
              panelId="sidebar"
              side="start"
              defaultSize={200}
              minSize={0}
              maxSize={1000}
            >
              sidebar
            </Panel>
            <PanelResizeHandle aria-label="resize" />
            <Panel panelId="main">main</Panel>
          </PanelGroup>
        </PanelProvider>,
      );
    });
    await settle();

    // The persisted value applied…
    expect(groupRef.current?.getValue().sidebar?.size).toBe(300);

    // …but reset restores the authored declarative default, not the
    // restored snapshot.
    await act(async () => {
      groupRef.current?.resetValue();
    });
    await settle();
    expect(groupRef.current?.getValue().sidebar?.size).toBe(200);

    // And the reset outcome is what persists (§12).
    const lastWrite = setItem.mock.calls.at(-1);
    expect(lastWrite?.[0]).toBe("workspace");
    expect(JSON.parse(lastWrite?.[1] as string).panels.sidebar.size).toBe(200);
  });

  it("resets to defaultValue when supplied", async () => {
    const groupRef = { current: null as PanelGroupApi | null };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <PanelProvider>
          <PanelGroup
            orientation="horizontal"
            defaultValue={{ sidebar: { size: 260 } }}
            apiRef={groupRef}
          >
            <Panel
              panelId="sidebar"
              side="start"
              defaultSize={200}
              minSize={0}
              maxSize={1000}
            >
              sidebar
            </Panel>
            <PanelResizeHandle aria-label="resize" />
            <Panel panelId="main">main</Panel>
          </PanelGroup>
        </PanelProvider>,
      );
    });
    await settle();
    expect(groupRef.current?.getValue().sidebar?.size).toBe(260);

    await act(async () => {
      groupRef.current?.setValue({ sidebar: { size: 420 } });
    });
    await settle();
    expect(groupRef.current?.getValue().sidebar?.size).toBe(420);

    await act(async () => {
      groupRef.current?.resetValue();
    });
    await settle();
    expect(groupRef.current?.getValue().sidebar?.size).toBe(260);
  });
});
