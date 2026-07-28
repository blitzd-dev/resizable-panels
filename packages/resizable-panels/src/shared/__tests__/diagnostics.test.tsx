// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PanelGroup } from "../../group/panel-group";
import { PanelResizeHandle } from "../../handle/panel-resize-handle";
import { Panel } from "../../panel/panel";
import { PanelProvider } from "../../provider/panel-provider";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("development diagnostics", () => {
  it("stays silent for a valid group under Strict Mode", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <StrictMode>
          <PanelProvider>
            <PanelGroup orientation="horizontal">
              <Panel panelId="first" defaultSize={200}>
                first
              </Panel>
              <PanelResizeHandle />
              <Panel panelId="second">second</Panel>
            </PanelGroup>
          </PanelProvider>
        </StrictMode>,
      );
    });

    expect(warn).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it("warns once for an invalid cascade value and stays silent for valid ones (R-25)", async () => {
    const warnings: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((message) => {
      warnings.push(String(message));
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const renderWithCascade = async (cascade: string | undefined) => {
      await act(async () => {
        root.render(
          <StrictMode>
            <PanelProvider>
              <PanelGroup
                orientation="horizontal"
                // Runtime misuse through untyped code; the typo must fall
                // back to the default reversible semantics with a warning.
                cascade={cascade as never}
              >
                <Panel panelId="first" defaultSize={200}>
                  first
                </Panel>
                <PanelResizeHandle />
                <Panel panelId="second">second</Panel>
              </PanelGroup>
            </PanelProvider>
          </StrictMode>,
        );
      });
    };

    await renderWithCascade("latching");
    await renderWithCascade("reversible");
    await renderWithCascade(undefined);
    expect(
      warnings.filter((message) => message.includes("<PanelGroup cascade>")),
    ).toHaveLength(0);

    await renderWithCascade("sticky");
    const cascadeWarnings = warnings.filter((message) =>
      message.includes(
        '<PanelGroup cascade> must be "reversible" or "latching". Falling back to "reversible".',
      ),
    );
    expect(cascadeWarnings).toHaveLength(1);
    await act(async () => root.unmount());
  });

  it("reports duplicate ids, impossible bounds, and invalid handle topology", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 800,
      height: 600,
      top: 0,
      right: 800,
      bottom: 600,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const warnings: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((message) => {
      warnings.push(String(message));
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <StrictMode>
          <PanelProvider>
            <PanelGroup orientation="horizontal">
              <Panel
                panelId="duplicate"
                side="start"
                defaultSize={300}
                minSize={400}
                maxSize={200}
                collapsedSize={450}
                collapseBelow={500}
              >
                first
              </Panel>
              <PanelResizeHandle />
              <Panel panelId="duplicate" containerResizeBehavior="fixed">
                second
              </Panel>
              <PanelResizeHandle />
            </PanelGroup>
          </PanelProvider>
        </StrictMode>,
      );
    });

    expect(
      warnings.some((message) =>
        message.includes('Duplicate panelId "duplicate"'),
      ),
    ).toBe(true);
    expect(
      warnings.some((message) => message.includes("minSize (400px)")),
    ).toBe(true);
    expect(
      warnings.some((message) =>
        message.includes("collapsedSize (450px) cannot exceed minSize"),
      ),
    ).toBe(true);
    expect(
      warnings.some((message) =>
        message.includes("collapseBelow (500px) must resolve between"),
      ),
    ).toBe(true);
    expect(
      warnings.some((message) =>
        message.includes("must be a direct DOM sibling between two adjacent"),
      ),
    ).toBe(true);
    expect(
      warnings.some((message) =>
        message.includes("requires at least one expanded panel"),
      ),
    ).toBe(true);

    await act(async () => root.unmount());
  });

  it("names the component that is missing its required provider", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    expect(() => {
      act(() => root.render(<PanelResizeHandle />));
    }).toThrow("<PanelResizeHandle> must be used within a <PanelGroup>");
  });

  it("warns when slotProps styles set library-reserved keys, once per panel (R-15)", async () => {
    const warnings: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((message) => {
      warnings.push(String(message));
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <StrictMode>
          <PanelProvider>
            <PanelGroup orientation="horizontal">
              <Panel
                panelId="docked"
                side="start"
                defaultSize={200}
                slotProps={{
                  viewport: {
                    style: { overflow: "visible", background: "red" },
                  },
                  content: { style: { transition: "none" } },
                }}
              >
                docked
              </Panel>
              <PanelResizeHandle />
              <Panel
                panelId="peer"
                slotProps={{ content: { style: { inset: 4 } } }}
              >
                peer
              </Panel>
            </PanelGroup>
          </PanelProvider>
        </StrictMode>,
      );
    });

    const viewportWarnings = warnings.filter((message) =>
      message.includes('<Panel panelId="docked"> slotProps.viewport.style'),
    );
    // Strict Mode double-invokes; the warning still fires exactly once.
    expect(viewportWarnings).toHaveLength(1);
    expect(viewportWarnings[0]).toContain("sets overflow");
    expect(viewportWarnings[0]).toContain("library owns");
    // The non-reserved key on the same slot is never reported.
    expect(viewportWarnings[0]).not.toContain("background");
    expect(
      warnings.filter((message) =>
        message.includes(
          '<Panel panelId="docked"> slotProps.content.style sets transition',
        ),
      ),
    ).toHaveLength(1);
    expect(
      warnings.filter((message) =>
        message.includes(
          '<Panel panelId="peer"> slotProps.content.style sets inset',
        ),
      ),
    ).toHaveLength(1);

    await act(async () => root.unmount());
  });

  it("stays silent for slotProps styles that only set non-reserved keys (R-15)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <StrictMode>
          <PanelProvider>
            <PanelGroup orientation="horizontal">
              <Panel
                panelId="docked"
                side="start"
                defaultSize={200}
                slotProps={{
                  viewport: { style: { background: "red" } },
                  content: { style: { color: "blue", padding: 8 } },
                }}
              >
                docked
              </Panel>
              <PanelResizeHandle />
              <Panel panelId="peer">peer</Panel>
            </PanelGroup>
          </PanelProvider>
        </StrictMode>,
      );
    });

    expect(warn).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});

describe("zero-size group warning (R-13)", () => {
  // jsdom never fires a real ResizeObserver, so the warning's trigger — the
  // observer callback CONFIRMING a zero main-axis box — is exercised by
  // stubbing the ResizeObserver global and invoking the captured callback
  // with a synthetic entry. That is the honest seam: the warning lives
  // inside that callback, and everything downstream of the entry (main-size
  // extraction, the registered-children gate, warn-once) runs for real.
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

  async function mountGroupAndObserve(inlineSize: number): Promise<string[]> {
    const observers = stubResizeObserver();
    const warnings: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((message) => {
      warnings.push(String(message));
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <StrictMode>
          <PanelProvider>
            <PanelGroup orientation="horizontal">
              <Panel panelId="a" defaultSize={200}>
                a
              </Panel>
              <PanelResizeHandle />
              <Panel panelId="b">b</Panel>
            </PanelGroup>
          </PanelProvider>
        </StrictMode>,
      );
    });
    const group = container.querySelector<HTMLElement>(
      "[data-resizable-panels-panel-group]",
    );
    if (!group) throw new Error("Expected group element");
    const entry = {
      target: group,
      contentBoxSize: [{ inlineSize, blockSize: 300 }],
    } as unknown as ResizeObserverEntry;
    await act(async () => {
      for (const record of observers) {
        if (record.targets.includes(group)) {
          record.callback([entry], {} as ResizeObserver);
        }
      }
    });
    await act(async () => root.unmount());
    return warnings;
  }

  it("warns once when the observer confirms a zero-size box along the group axis", async () => {
    const warnings = await mountGroupAndObserve(0);
    const zeroWarnings = warnings.filter((message) =>
      message.includes("measured a width of 0px"),
    );
    expect(zeroWarnings).toHaveLength(1);
    expect(zeroWarnings[0]).toContain("fills its parent");
    expect(zeroWarnings[0]).toContain("className");
    expect(zeroWarnings[0]).toContain("style prop");
  });

  it("stays silent when the observer reports a nonzero box", async () => {
    const warnings = await mountGroupAndObserve(800);
    expect(warnings).toHaveLength(0);
  });
});
