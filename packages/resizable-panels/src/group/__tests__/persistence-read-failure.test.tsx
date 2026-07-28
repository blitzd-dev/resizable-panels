// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PanelResizeHandle } from "../../handle/panel-resize-handle";
import { Panel, type PanelApi } from "../../panel/panel";
import { PanelProvider } from "../../provider/panel-provider";
import type {
  PanelGroupPersistenceOptions,
  PanelGroupValue,
  PanelStorage,
} from "../../types";
import { PanelGroup, type PanelGroupApi } from "../panel-group";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// Write-back debounce is 200ms; wait past it plus coordinator microtasks.
const WRITE_SETTLE_MS = 300;

const roots: Root[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(async () => root.unmount());
  }
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

function settleWrites() {
  return act(
    () => new Promise((resolve) => setTimeout(resolve, WRITE_SETTLE_MS)),
  );
}

async function renderPersistedGroup(
  storage: PanelStorage,
  options?: {
    handleRef?: { current: PanelApi | null };
    onError?: PanelGroupPersistenceOptions["onError"];
    onStatusChange?: PanelGroupPersistenceOptions["onStatusChange"];
    value?: PanelGroupValue;
  },
) {
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
            storage,
            onError: options?.onError,
            onStatusChange: options?.onStatusChange,
          }}
          {...(options?.value ? { value: options.value } : {})}
        >
          <Panel
            panelId="sidebar"
            side="start"
            defaultSize={200}
            collapsible
            apiRef={options?.handleRef}
          >
            sidebar
          </Panel>
          <PanelResizeHandle aria-label="Resize sidebar" />
          <Panel panelId="main">main</Panel>
        </PanelGroup>
      </PanelProvider>,
    );
  });
}

describe("persistence read-failure write gate", () => {
  it("still writes after a genuinely empty entry", async () => {
    const setItem = vi.fn();
    await renderPersistedGroup({ getItem: () => null, setItem });
    await settleWrites();
    expect(setItem).toHaveBeenCalled();
  });

  it("does not overwrite the record after a rejected read", async () => {
    const setItem = vi.fn();
    await renderPersistedGroup({
      getItem: () => Promise.reject(new Error("storage offline")),
      setItem,
    });
    await settleWrites();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("does not overwrite the record after a thrown sync read", async () => {
    const setItem = vi.fn();
    await renderPersistedGroup({
      getItem: () => {
        throw new Error("storage offline");
      },
      setItem,
    });
    await settleWrites();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("does not overwrite the record after invalid JSON", async () => {
    const setItem = vi.fn();
    await renderPersistedGroup({ getItem: () => "not json{", setItem });
    await settleWrites();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("does not overwrite the record after an invalid schema", async () => {
    const setItem = vi.fn();
    await renderPersistedGroup({
      getItem: () =>
        JSON.stringify({ version: 2, orientation: "diagonal", panels: {} }),
      setItem,
    });
    await settleWrites();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("reopens the write gate on the first explicit mutation", async () => {
    const setItem = vi.fn();
    const handleRef = { current: null as PanelApi | null };
    await renderPersistedGroup(
      {
        getItem: () => Promise.reject(new Error("storage offline")),
        setItem,
      },
      { handleRef },
    );
    await settleWrites();
    expect(setItem).not.toHaveBeenCalled();

    await act(async () => {
      handleRef.current?.collapse();
    });
    await settleWrites();

    expect(setItem).toHaveBeenCalled();
    const [key, value] = setItem.mock.calls.at(-1) as [string, string];
    expect(key).toBe("workspace");
    expect(JSON.parse(value).panels.sidebar.collapsed).toBe(true);
  });
});

describe("persistence error reporting", () => {
  it("reports a rejected getItem as a read error, exactly once", async () => {
    const cause = new Error("storage offline");
    const onError = vi.fn();
    await renderPersistedGroup(
      { getItem: () => Promise.reject(cause), setItem: vi.fn() },
      { onError },
    );
    await settleWrites();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith({
      operation: "read",
      key: "workspace",
      error: cause,
    });
  });

  it("reports a thrown sync getItem as a read error", async () => {
    const cause = new Error("storage offline");
    const onError = vi.fn();
    await renderPersistedGroup(
      {
        getItem: () => {
          throw cause;
        },
        setItem: vi.fn(),
      },
      { onError },
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      operation: "read",
      key: "workspace",
      error: cause,
    });
  });

  it("reports invalid JSON as a deserialize error", async () => {
    const onError = vi.fn();
    await renderPersistedGroup(
      { getItem: () => "not json{", setItem: vi.fn() },
      { onError },
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      operation: "deserialize",
      key: "workspace",
    });
  });

  it("reports an invalid schema as a deserialize error", async () => {
    const onError = vi.fn();
    await renderPersistedGroup(
      {
        getItem: () =>
          JSON.stringify({
            version: 99,
            orientation: "horizontal",
            panels: {},
          }),
        setItem: vi.fn(),
      },
      { onError },
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      operation: "deserialize",
      key: "workspace",
    });
  });

  it("reports nothing for an empty entry", async () => {
    const onError = vi.fn();
    await renderPersistedGroup(
      { getItem: () => null, setItem: vi.fn() },
      { onError },
    );
    await settleWrites();
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("persistence status reporting", () => {
  it("reports restoring then ready exactly once for a successful restore", async () => {
    const onStatusChange = vi.fn();
    await renderPersistedGroup(
      {
        getItem: () =>
          JSON.stringify({
            version: 1,
            orientation: "horizontal",
            panels: { sidebar: { size: 240 } },
          }),
        setItem: vi.fn(),
      },
      { onStatusChange },
    );
    await settleWrites();
    expect(onStatusChange.mock.calls.map((call) => call[0])).toEqual([
      { state: "restoring", key: "workspace" },
      { state: "ready", key: "workspace" },
    ]);
  });

  it("reports restoring then ready exactly once for an async failed read", async () => {
    const onStatusChange = vi.fn();
    await renderPersistedGroup(
      {
        getItem: () => Promise.reject(new Error("storage offline")),
        setItem: vi.fn(),
      },
      { onStatusChange },
    );
    await settleWrites();
    expect(onStatusChange.mock.calls.map((call) => call[0])).toEqual([
      { state: "restoring", key: "workspace" },
      { state: "ready", key: "workspace" },
    ]);
  });

  it("reports restoring then ready exactly once for an empty entry", async () => {
    const onStatusChange = vi.fn();
    await renderPersistedGroup(
      { getItem: () => null, setItem: vi.fn() },
      { onStatusChange },
    );
    await settleWrites();
    expect(onStatusChange.mock.calls.map((call) => call[0])).toEqual([
      { state: "restoring", key: "workspace" },
      { state: "ready", key: "workspace" },
    ]);
  });
});

describe("defaultValue with persistence", () => {
  it("restores over defaultValue: the prop is only the first-paint fallback", async () => {
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
            apiRef={groupRef}
            defaultValue={{ sidebar: { size: 200 } }}
            persistence={{
              key: "workspace",
              storage: {
                getItem: () =>
                  JSON.stringify({
                    version: 1,
                    orientation: "horizontal",
                    panels: { sidebar: { size: 240 } },
                  }),
                setItem: vi.fn(),
              },
            }}
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
    expect(groupRef.current?.getValue().sidebar?.size).toBe(240);
  });
});

describe("controlled value + persistence exclusion", () => {
  it("neither reads nor writes when the group is controlled", async () => {
    const getItem = vi.fn(() => null);
    const setItem = vi.fn();
    const onStatusChange = vi.fn();
    await renderPersistedGroup(
      { getItem, setItem },
      {
        onStatusChange,
        value: { sidebar: { size: 240 }, main: { size: 760 } },
      },
    );
    await settleWrites();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(onStatusChange).not.toHaveBeenCalled();
  });
});
