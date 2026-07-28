// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PanelGroup, type PanelGroupApi } from "../../group/panel-group";
import { PanelResizeHandle } from "../../handle/panel-resize-handle";
import { Panel } from "../../panel/panel";
import type { PanelControls, PanelLocator } from "../../types";
import { PanelProvider } from "../panel-provider";
import { usePanelControls } from "../public-hooks";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(async () => root.unmount());
  }
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

async function render(element: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(element);
  });
  return container;
}

/** Records what `usePanelControls` resolves for a locator, from wherever in
 * the tree this probe is mounted. */
function ControlsProbe({
  locator,
  out,
}: {
  locator: PanelLocator;
  out: { current: PanelControls | undefined };
}) {
  out.current = usePanelControls(locator);
  return null;
}

function groupOf(groupId: string, panelId: string, children?: React.ReactNode) {
  return (
    <PanelGroup orientation="horizontal" groupId={groupId}>
      <Panel
        panelId={panelId}
        side="start"
        defaultSize={200}
        minSize={0}
        maxSize={1000}
      >
        {panelId}
        {children}
      </Panel>
      <PanelResizeHandle aria-label={`resize ${panelId}`} />
      <Panel panelId={`${panelId}-main`}>main</Panel>
    </PanelGroup>
  );
}

describe("implicit provider (§14)", () => {
  it("renders a standalone group without a provider and serves its API", async () => {
    const apiRef = { current: null as PanelGroupApi | null };
    await render(
      <PanelGroup orientation="horizontal" apiRef={apiRef}>
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
      </PanelGroup>,
    );
    expect(apiRef.current?.getValue().sidebar?.size).toBe(200);
    await act(async () => {
      apiRef.current?.setValue({ sidebar: { size: 320 } });
    });
    expect(apiRef.current?.getValue().sidebar?.size).toBe(320);
  });

  it("lets nested providerless groups share the outer group's implicit provider", async () => {
    const probe = { current: undefined as PanelControls | undefined };
    await render(
      groupOf(
        "outer",
        "a",
        <>
          {groupOf("inner", "b")}
          <ControlsProbe
            locator={{ groupId: "inner", panelId: "b" }}
            out={probe}
          />
        </>,
      ),
    );
    expect(probe.current).toBeDefined();
    expect(probe.current?.kind).toBe("docked");
  });

  it("isolates standalone sibling groups in independent registries", async () => {
    const probe = { current: undefined as PanelControls | undefined };
    await render(
      <>
        {groupOf(
          "left",
          "a",
          <ControlsProbe
            locator={{ groupId: "right", panelId: "b" }}
            out={probe}
          />,
        )}
        {groupOf("right", "b")}
      </>,
    );
    expect(probe.current).toBeUndefined();
  });

  it("shares lookup across siblings under one explicit provider", async () => {
    const probe = { current: undefined as PanelControls | undefined };
    await render(
      <PanelProvider>
        <ControlsProbe
          locator={{ groupId: "right", panelId: "b" }}
          out={probe}
        />
        {groupOf("left", "a")}
        {groupOf("right", "b")}
      </PanelProvider>,
    );
    expect(probe.current).toBeDefined();
    expect(probe.current?.kind).toBe("docked");
  });

  it("keeps an explicit nested provider as an isolation boundary", async () => {
    const probe = { current: undefined as PanelControls | undefined };
    await render(
      groupOf(
        "outer",
        "a",
        <>
          <PanelProvider>{groupOf("walled", "b")}</PanelProvider>
          <ControlsProbe
            locator={{ groupId: "walled", panelId: "b" }}
            out={probe}
          />
        </>,
      ),
    );
    expect(probe.current).toBeUndefined();
  });

  it("throws an actionable error for hooks outside any boundary", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const probe = { current: undefined as PanelControls | undefined };
    await expect(
      render(
        <ControlsProbe locator={{ groupId: "g", panelId: "p" }} out={probe} />,
      ),
    ).rejects.toThrow(/inside a <PanelGroup>.*<PanelProvider>/s);
    spy.mockRestore();
  });

  it("installs at most one window resize listener across many providers", async () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    await render(
      <>
        {groupOf("one", "a")}
        {groupOf("two", "b")}
        <PanelProvider>{groupOf("three", "c")}</PanelProvider>
      </>,
    );
    const resizeListeners = addSpy.mock.calls.filter(
      ([type]) => type === "resize",
    );
    expect(resizeListeners.length).toBeLessThanOrEqual(1);
  });
});
