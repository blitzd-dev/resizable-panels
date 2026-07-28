// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PanelResizeHandle } from "../../handle/panel-resize-handle";
import { Panel } from "../../panel/panel";
import { PanelProvider } from "../../provider/panel-provider";
import { PanelGroup } from "../panel-group";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function Layout() {
  return (
    <PanelProvider>
      <PanelGroup orientation="horizontal">
        <Panel panelId="nav" side="start" defaultSize="25%" minSize={100}>
          <span>server navigation</span>
        </Panel>
        <PanelResizeHandle />
        <Panel panelId="main">
          <span>server main</span>
        </Panel>
      </PanelGroup>
    </PanelProvider>
  );
}

function DefaultCollapsedPeerLayout() {
  return (
    <PanelProvider>
      <PanelGroup orientation="horizontal">
        <Panel
          panelId="tools"
          defaultSize="30%"
          minSize="4rem"
          collapsible
          defaultCollapsed
          collapsedSize="2rem"
        >
          <span>server tools</span>
        </Panel>
        <PanelResizeHandle />
        <Panel panelId="workspace">
          <span>server workspace</span>
        </Panel>
      </PanelGroup>
    </PanelProvider>
  );
}

function CollapsedAccessibilityLayout({ collapsed = true }) {
  return (
    <PanelProvider>
      <PanelGroup orientation="horizontal">
        <Panel
          panelId="nav"
          side="start"
          defaultSize={240}
          minSize={120}
          defaultCollapsed={collapsed}
        >
          <button type="button">nav action</button>
        </Panel>
        <PanelResizeHandle />
        <Panel
          panelId="tools"
          defaultSize={240}
          minSize={120}
          collapsible
          defaultCollapsed={collapsed}
        >
          <button type="button">tools action</button>
        </Panel>
        <PanelResizeHandle />
        <Panel panelId="main">main</Panel>
      </PanelGroup>
    </PanelProvider>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("SSR and hydration", () => {
  it("renders without browser globals and preserves unresolved CSS sizes", () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);

    const html = renderToString(<Layout />);

    expect(html).toContain("server navigation");
    expect(html).toContain("server main");
    expect(html).toContain("width:25%");
    expect(html).not.toContain("position:fixed;left:-10000px");
  });

  it("hydrates deterministic markup under StrictMode without warnings", async () => {
    const html = renderToString(
      <StrictMode>
        <Layout />
      </StrictMode>,
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const errors: unknown[][] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args);
    });

    const root = hydrateRoot(
      container,
      <StrictMode>
        <Layout />
      </StrictMode>,
    );
    await act(async () => {});

    expect(container.textContent).toContain("server navigation");
    expect(
      errors.filter(([message]) =>
        String(message).toLowerCase().includes("hydration"),
      ),
    ).toEqual([]);

    await act(async () => root.unmount());
  });

  it("renders defaultValue identically on the server and first client pass", () => {
    const html = renderToString(
      <PanelProvider>
        <PanelGroup
          orientation="horizontal"
          defaultValue={{
            nav: { size: 320, collapsed: true },
            main: { size: 880 },
          }}
        >
          <Panel panelId="nav" side="start" defaultSize="25%">
            nav
          </Panel>
          <PanelResizeHandle />
          <Panel panelId="main">main</Panel>
        </PanelGroup>
      </PanelProvider>,
    );

    expect(html).toContain('data-state="collapsed"');
    expect(html).toContain("width:0px");
    expect(html).toContain("width:320px");
  });

  it("hydrates a default-collapsed peer with a nonzero CSS size", async () => {
    const html = renderToString(
      <StrictMode>
        <DefaultCollapsedPeerLayout />
      </StrictMode>,
    );
    expect(html).toContain('data-state="collapsed"');
    expect(html).toContain("flex-basis:2rem");

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const errors: unknown[][] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args);
    });

    const root = hydrateRoot(
      container,
      <StrictMode>
        <DefaultCollapsedPeerLayout />
      </StrictMode>,
    );
    await act(async () => {});

    const tools = container.querySelector(
      '[data-resizable-panels-panel-id="tools"]',
    );
    expect(tools?.getAttribute("data-state")).toBe("collapsed");
    expect((tools as HTMLElement | null)?.style.flexBasis).toBe("2rem");
    expect(
      errors.filter(([message]) =>
        String(message).toLowerCase().includes("hydration"),
      ),
    ).toEqual([]);

    await act(async () => root.unmount());
  });

  it("serializes zero-size collapsed panels as inert before hydration", () => {
    const html = renderToString(<CollapsedAccessibilityLayout />);
    const container = document.createElement("div");
    container.innerHTML = html;

    for (const id of ["nav", "tools"]) {
      const panel = container.querySelector(
        `[data-resizable-panels-panel-id="${id}"]`,
      );
      expect(panel?.getAttribute("aria-hidden")).toBe("true");
      expect(panel?.hasAttribute("inert")).toBe(true);
    }
  });

  it("keeps collapsed accessibility markup stable through hydration", async () => {
    const html = renderToString(
      <StrictMode>
        <CollapsedAccessibilityLayout />
      </StrictMode>,
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const errors: unknown[][] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args);
    });

    const root = hydrateRoot(
      container,
      <StrictMode>
        <CollapsedAccessibilityLayout />
      </StrictMode>,
    );
    await act(async () => {});

    for (const id of ["nav", "tools"]) {
      const panel = container.querySelector(
        `[data-resizable-panels-panel-id="${id}"]`,
      );
      expect(panel?.getAttribute("aria-hidden")).toBe("true");
      expect(panel?.hasAttribute("inert")).toBe(true);
    }
    expect(
      errors.filter(([message]) =>
        /hydration|inert|non-boolean attribute/i.test(String(message)),
      ),
    ).toEqual([]);

    await act(async () => root.unmount());
  });

  it("leaves initially expanded panels accessible in server markup", () => {
    const html = renderToString(
      <CollapsedAccessibilityLayout collapsed={false} />,
    );
    const container = document.createElement("div");
    container.innerHTML = html;

    for (const id of ["nav", "tools"]) {
      const panel = container.querySelector(
        `[data-resizable-panels-panel-id="${id}"]`,
      );
      expect(panel?.hasAttribute("aria-hidden")).toBe(false);
      expect(panel?.hasAttribute("inert")).toBe(false);
    }
  });

  it("disconnects observers and removes global listeners on unmount", async () => {
    const disconnect = vi.fn();
    class TestResizeObserver {
      observe() {}
      disconnect = disconnect;
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const html = renderToString(<Layout />);
    container.innerHTML = html;

    const root = hydrateRoot(container, <Layout />);
    await act(async () => {});
    await act(async () => root.unmount());

    expect(disconnect).toHaveBeenCalled();
    for (const eventName of ["resize", "blur"] as const) {
      const added = add.mock.calls.filter(
        ([type]) => type === eventName,
      ).length;
      const removed = remove.mock.calls.filter(
        ([type]) => type === eventName,
      ).length;
      expect(removed).toBe(added);
    }
  });
});
