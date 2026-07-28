// @vitest-environment jsdom

// R-31: container-resize transition suppression must be scoped to the group
// whose container is actually resizing. A nested group that shares the
// outer group's axis observes a main-axis container change whenever an
// outer docked sibling animates open or closed; if that observation raised
// a provider-wide "no transitions" flag (as it did pre-fix), it would
// cancel the outer panel's own collapse animation mid-flight — every
// three-level IDE layout (horizontal → vertical → horizontal) snapped.
//
// jsdom fires no real ResizeObserver, so the observer callback is driven by
// stubbing the global and invoking the captured callback with a synthetic
// entry — the same honest seam the R-13 diagnostics tests use. Everything
// downstream (main-size extraction, the group-local flag, the panels'
// inline `transition` styles) runs for real.

import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTAINER_RESIZE_IDLE_MS } from "../../core/timing";
import { PanelResizeHandle } from "../../handle/panel-resize-handle";
import { Panel } from "../../panel/panel";
import { PanelProvider } from "../../provider/panel-provider";
import { PanelGroup } from "../panel-group";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

afterEach(async () => {
  const current = root;
  root = null;
  if (current) await act(async () => current.unmount());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

type ObserverRecord = {
  callback: ResizeObserverCallback;
  targets: Element[];
};

function stubResizeObserver(): ObserverRecord[] {
  const observers: ObserverRecord[] = [];
  class FakeResizeObserver {
    record: ObserverRecord;
    constructor(callback: ResizeObserverCallback) {
      this.record = { callback, targets: [] };
      observers.push(this.record);
    }
    observe(target: Element) {
      this.record.targets.push(target);
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  return observers;
}

async function fire(
  observers: ObserverRecord[],
  target: Element,
  inlineSize: number,
) {
  const entry = {
    target,
    contentBoxSize: [{ inlineSize, blockSize: 400 }],
  } as unknown as ResizeObserverEntry;
  await act(async () => {
    for (const record of observers) {
      if (record.targets.includes(target)) {
        record.callback([entry], {} as ResizeObserver);
      }
    }
  });
}

/** Wait out the observer's idle window so both groups' resize flags clear. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) =>
      setTimeout(resolve, CONTAINER_RESIZE_IDLE_MS + 60),
    );
  });
}

const sidebarStyle = (id: string): string => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Expected #${id} to be rendered`);
  return element.style.transition;
};

describe("container-resize transition suppression is group-local (R-31)", () => {
  it("a nested same-axis group's container resize does not cancel the outer group's transitions", async () => {
    const observers = stubResizeObserver();
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const mounted = root;
    await act(async () => {
      mounted.render(
        <StrictMode>
          <PanelProvider>
            <PanelGroup orientation="horizontal" groupId="outer">
              <Panel
                id="outer-sidebar"
                panelId="sidebar"
                side="start"
                defaultSize={200}
              >
                sidebar
              </Panel>
              <PanelResizeHandle />
              <Panel panelId="main">
                <PanelGroup orientation="horizontal" groupId="inner">
                  <Panel
                    id="inner-sidebar"
                    panelId="inner-side"
                    side="start"
                    defaultSize={120}
                  >
                    inner side
                  </Panel>
                  <PanelResizeHandle />
                  <Panel panelId="inner-main">inner main</Panel>
                </PanelGroup>
              </Panel>
            </PanelGroup>
          </PanelProvider>
        </StrictMode>,
      );
    });

    const groups = document.querySelectorAll(
      "[data-resizable-panels-panel-group]",
    );
    expect(groups).toHaveLength(2);
    const [outerGroup, innerGroup] = groups;

    // Confirm both containers so the allocator commits, then let the
    // first-measurement resize windows lapse: transitions are live.
    await fire(observers, outerGroup, 1000);
    await fire(observers, innerGroup, 780);
    await settle();
    expect(sidebarStyle("outer-sidebar")).toContain("width");
    expect(sidebarStyle("inner-sidebar")).toContain("width");

    // The inner group's container changes along its main axis — exactly
    // what happens continuously while an outer docked sibling animates.
    await fire(observers, innerGroup, 700);

    // The churning group suppresses its own panels' transitions...
    expect(sidebarStyle("inner-sidebar")).toBe("none");
    // ...but the outer group — whose container did not move — must keep
    // animating. Pre-fix the provider-wide flag turned this to "none",
    // snapping the outer panel's in-flight collapse.
    expect(sidebarStyle("outer-sidebar")).toContain("width");

    // The suppression clears once the inner container goes idle.
    await settle();
    expect(sidebarStyle("inner-sidebar")).toContain("width");

    // And the same scoping holds in the other direction: outer churn
    // suppresses outer panels without freezing the nested group.
    await fire(observers, outerGroup, 900);
    expect(sidebarStyle("outer-sidebar")).toBe("none");
    expect(sidebarStyle("inner-sidebar")).toContain("width");
  });
});
