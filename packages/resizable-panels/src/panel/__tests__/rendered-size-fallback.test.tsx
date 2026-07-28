// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { PanelGroup } from "../../group/panel-group";
import { PanelResizeHandle } from "../../handle/panel-resize-handle";
import { PanelProvider } from "../../provider/panel-provider";
import { Panel, type PanelApi } from "../panel";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

afterEach(async () => {
  const current = root;
  root = null;
  if (current) await act(async () => current.unmount());
  document.body.innerHTML = "";
});

describe("PanelApi.getRenderedSize registry-miss fallback (R-21)", () => {
  it("a collapsed docked panel reports its collapsed size, not its expanded preference", async () => {
    // jsdom never confirms a container measurement (no ResizeObserver, zero
    // rects), so the allocator never commits and the getter's local
    // fallback value is what a caller observes. The registry itself only
    // misses at teardown-ordered moments — a retained api handle outliving
    // the panel's registration is the reachable one.
    const dockedApi = { current: null as PanelApi | null };
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const mounted = root;
    await act(async () => {
      mounted.render(
        <StrictMode>
          <PanelProvider>
            <PanelGroup orientation="horizontal">
              <Panel
                panelId="sidebar"
                side="start"
                apiRef={dockedApi}
                defaultSize={200}
                collapsible
                defaultCollapsed
                collapsedSize={24}
              >
                sidebar
              </Panel>
              <PanelResizeHandle />
              <Panel panelId="main">main</Panel>
            </PanelGroup>
          </PanelProvider>
        </StrictMode>,
      );
    });
    const docked = dockedApi.current;
    if (!docked) throw new Error("Expected the docked apiRef to populate");

    // Registry hit: collapsed-aware.
    expect(docked.getRenderedSize()).toBe(24);

    // Retain the api handle past unregistration: the registry read now
    // misses and the getter falls back to its captured local value. The
    // docked fallback must stay collapsed-aware (the peer fallback always
    // was) — never the expanded preferred size.
    const current = root;
    root = null;
    if (current) await act(async () => current.unmount());
    expect(docked.getRenderedSize()).toBe(24);
  });
});
