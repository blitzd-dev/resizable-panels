// @vitest-environment jsdom
// R-33: per-panel controlled `collapsed`. The prop is authoritative; every
// path that would change collapsed state emits a PROPOSAL through
// `onCollapsedChange(collapsed, details)` and applies nothing. The parent
// accepts by re-rendering with the new prop value — and that acceptance
// re-render is NOT a change event (no double-fire). Persistence restores
// skip the collapsed field for controlled panels while sizes still restore.
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PanelGroup, type PanelGroupApi } from "../../group/panel-group";
import { PanelResizeHandle } from "../../handle/panel-resize-handle";
import { PanelProvider } from "../../provider/panel-provider";
import type { PanelChangeDetails } from "../../types";
import { Panel, type PanelApi } from "../panel";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(async () => root.unmount());
  }
  vi.unstubAllGlobals();
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
  return { container, root };
}

type ProposalLog = Array<{ collapsed: boolean; details: PanelChangeDetails }>;

function panelState(container: HTMLElement, panelId: string) {
  return container
    .querySelector(`[data-resizable-panels-panel-id="${panelId}"]`)
    ?.getAttribute("data-state");
}

/** Controlled sidebar whose parent state is driven only through accepted
 * proposals (`accept` ref) or an imperative external setter. */
function ControlledApp({
  proposals,
  accept,
  panelApiRef,
  groupApiRef,
  externalRef,
}: {
  proposals: ProposalLog;
  accept: { current: boolean };
  panelApiRef: { current: PanelApi | null };
  groupApiRef: { current: PanelGroupApi | null };
  /** Lets tests drive the parent state directly (external toggle). */
  externalRef: { current: (collapsed: boolean) => void };
}) {
  const [collapsed, setCollapsed] = useState(false);
  externalRef.current = setCollapsed;
  return (
    <PanelProvider>
      <PanelGroup orientation="horizontal" groupId="g" apiRef={groupApiRef}>
        <Panel
          side="start"
          panelId="side"
          defaultSize={200}
          minSize={100}
          maxSize={1000}
          collapsible
          collapsed={collapsed}
          apiRef={panelApiRef}
          onCollapsedChange={(next, details) => {
            proposals.push({ collapsed: next, details });
            if (accept.current) setCollapsed(next);
          }}
        >
          side
        </Panel>
        <PanelResizeHandle aria-label="Resize side" />
        <Panel panelId="main">main</Panel>
      </PanelGroup>
    </PanelProvider>
  );
}

function mountControlled(accept = false) {
  const proposals: ProposalLog = [];
  const acceptRef = { current: accept };
  const panelApiRef = { current: null as PanelApi | null };
  const groupApiRef = { current: null as PanelGroupApi | null };
  const externalRef = { current: (() => {}) as (collapsed: boolean) => void };
  const app = (
    <ControlledApp
      proposals={proposals}
      accept={acceptRef}
      panelApiRef={panelApiRef}
      groupApiRef={groupApiRef}
      externalRef={externalRef}
    />
  );
  return { proposals, acceptRef, panelApiRef, groupApiRef, externalRef, app };
}

describe("controlled collapsed (R-33)", () => {
  it("the prop is authoritative: imperative actions propose without applying", async () => {
    const { proposals, panelApiRef, app } = mountControlled();
    const { container } = await render(app);

    let result: ReturnType<PanelApi["collapse"]> | undefined;
    await act(async () => {
      result = panelApiRef.current?.collapse();
    });
    // `applied: true` means "proposed" on a controlled panel.
    expect(result).toEqual({ applied: true, value: true });
    // The prop did not change, so nothing rendered or reported collapsed.
    expect(panelState(container, "side")).toBe("expanded");
    expect(panelApiRef.current?.isCollapsed()).toBe(false);
    expect(proposals).toEqual([
      {
        collapsed: true,
        details: { reason: "collapse", trigger: "api" },
      },
    ]);
  });

  it("proposing the current prop value reports unchanged and emits nothing", async () => {
    const { proposals, panelApiRef, app } = mountControlled();
    await render(app);

    let result: ReturnType<PanelApi["expand"]> | undefined;
    await act(async () => {
      result = panelApiRef.current?.expand();
    });
    expect(result).toEqual({
      applied: false,
      reason: "unchanged",
      value: false,
    });
    expect(proposals).toEqual([]);
  });

  it("proposals fire per attempt: a declined toggle re-proposes on retry", async () => {
    const { proposals, panelApiRef, app } = mountControlled();
    const { container } = await render(app);

    await act(async () => {
      panelApiRef.current?.toggle();
    });
    await act(async () => {
      panelApiRef.current?.toggle();
    });
    // Declined both times: still expanded, but each attempt emitted.
    expect(panelState(container, "side")).toBe("expanded");
    expect(proposals.map((p) => p.collapsed)).toEqual([true, true]);
    expect(proposals[0]?.details).toEqual({
      reason: "collapse",
      trigger: "api",
    });
  });

  it("group setValue proposes the collapsed bit and reports the effective state", async () => {
    const { proposals, panelApiRef, groupApiRef, app } = mountControlled();
    const { container } = await render(app);

    await act(async () => {
      groupApiRef.current?.setValue({
        side: { size: 240, collapsed: true },
        main: { size: 400 },
      });
    });
    // The collapsed bit was proposed, never applied; the size applied.
    expect(proposals).toEqual([
      {
        collapsed: true,
        details: { reason: "set-value", trigger: "api" },
      },
    ]);
    expect(panelState(container, "side")).toBe("expanded");
    expect(panelApiRef.current?.getSize()).toBe(240);
    // getValue() and the applied layout report the EFFECTIVE (prop) state.
    expect(groupApiRef.current?.getValue().side?.collapsed).toBe(false);
  });

  it("maximize's expand half proposes with the direction reason", async () => {
    const { proposals, panelApiRef, externalRef, app } = mountControlled();
    const { container } = await render(app);
    await act(async () => {
      externalRef.current(true);
    });
    expect(panelState(container, "side")).toBe("collapsed");
    proposals.length = 0;

    await act(async () => {
      panelApiRef.current?.maximize();
    });
    expect(proposals).toEqual([
      { collapsed: false, details: { reason: "expand", trigger: "api" } },
    ]);
    // Declined: still collapsed.
    expect(panelState(container, "side")).toBe("collapsed");
  });

  it("reset proposes the declarative default with the reset reason", async () => {
    const { proposals, panelApiRef, externalRef, app } = mountControlled();
    await render(app);
    await act(async () => {
      externalRef.current(true);
    });
    proposals.length = 0;

    await act(async () => {
      panelApiRef.current?.reset();
    });
    expect(proposals).toEqual([
      { collapsed: false, details: { reason: "reset", trigger: "api" } },
    ]);
    expect(panelApiRef.current?.isCollapsed()).toBe(true);
  });

  it("acceptance applies through the prop with no duplicate onCollapsedChange", async () => {
    const { proposals, panelApiRef, app } = mountControlled(true);
    const { container } = await render(app);

    await act(async () => {
      panelApiRef.current?.collapse();
    });
    // The parent accepted inside the proposal callback: the panel rendered
    // the new state, and the acceptance re-render emitted NO second event.
    expect(panelState(container, "side")).toBe("collapsed");
    expect(panelApiRef.current?.isCollapsed()).toBe(true);
    expect(proposals).toEqual([
      { collapsed: true, details: { reason: "collapse", trigger: "api" } },
    ]);

    await act(async () => {
      panelApiRef.current?.expand();
    });
    expect(panelState(container, "side")).toBe("expanded");
    expect(proposals).toHaveLength(2);
    expect(proposals[1]).toEqual({
      collapsed: false,
      details: { reason: "expand", trigger: "api" },
    });
  });

  it("a direct parent state change renders without emitting any event", async () => {
    const { proposals, panelApiRef, externalRef, app } = mountControlled();
    const { container } = await render(app);

    await act(async () => {
      externalRef.current(true);
    });
    // Parent-driven prop changes are steering, not change events.
    expect(panelState(container, "side")).toBe("collapsed");
    expect(panelApiRef.current?.isCollapsed()).toBe(true);
    expect(proposals).toEqual([]);
  });
});

describe("controlled collapsed vs persistence (R-33)", () => {
  it("restore skips collapsed for the controlled panel, restores its size, and still restores an uncontrolled sibling", async () => {
    const stored = JSON.stringify({
      version: 1,
      orientation: "horizontal",
      panels: {
        side: { size: 300, collapsed: true },
        main: { size: 500, collapsed: true },
      },
    });
    const setItem = vi.fn();
    const storage = { getItem: () => stored, setItem };
    const proposals: ProposalLog = [];
    const panelApiRef = { current: null as PanelApi | null };

    const { container } = await render(
      <PanelProvider>
        <PanelGroup
          orientation="horizontal"
          persistence={{ key: "workspace", storage }}
        >
          <Panel
            side="start"
            panelId="side"
            defaultSize={200}
            minSize={100}
            maxSize={1000}
            collapsible
            collapsed={false}
            apiRef={panelApiRef}
            onCollapsedChange={(next, details) => {
              proposals.push({ collapsed: next, details });
            }}
          >
            side
          </Panel>
          <PanelResizeHandle aria-label="Resize side" />
          <Panel panelId="main" collapsible>
            main
          </Panel>
        </PanelGroup>
      </PanelProvider>,
    );

    // Size restored; collapsed skipped (prop authoritative); no proposal
    // fired for the restore.
    expect(panelApiRef.current?.getSize()).toBe(300);
    expect(panelApiRef.current?.isCollapsed()).toBe(false);
    expect(panelState(container, "side")).toBe("expanded");
    expect(proposals).toEqual([]);
    // Group-level persistence stays enabled for the rest of the group: the
    // uncontrolled sibling restored its collapsed bit.
    expect(panelState(container, "main")).toBe("collapsed");

    // Write-back records the EFFECTIVE (prop) value for the controlled
    // panel, not the stored bit it skipped.
    await act(async () => {
      panelApiRef.current?.setSize(320);
    });
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    expect(setItem).toHaveBeenCalled();
    const [, written] = setItem.mock.calls.at(-1) as [string, string];
    const parsed = JSON.parse(written) as {
      panels: Record<string, { size: number; collapsed?: boolean }>;
    };
    expect(parsed.panels.side?.collapsed).toBe(false);
    expect(parsed.panels.side?.size).toBe(320);
  });
});

describe("controlled collapsed diagnostics (R-33)", () => {
  it("warns when collapsed and defaultCollapsed are combined", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const conflicting = {
      collapsed: false,
      defaultCollapsed: true,
    } as Record<string, unknown>;
    await render(
      <PanelProvider>
        <PanelGroup orientation="horizontal">
          <Panel side="start" panelId="side" defaultSize={200} {...conflicting}>
            side
          </Panel>
          <Panel>main</Panel>
        </PanelGroup>
      </PanelProvider>,
    );
    expect(
      warn.mock.calls.some(([message]) =>
        String(message).includes(
          "cannot receive both collapsed and defaultCollapsed",
        ),
      ),
    ).toBe(true);
  });

  it("warns when a controlled panel sits inside a group with controlled value", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await render(
      <PanelProvider>
        <PanelGroup
          orientation="horizontal"
          value={{ side: { size: 200, collapsed: false } }}
        >
          <Panel
            side="start"
            panelId="side"
            defaultSize={200}
            collapsible
            collapsed={false}
          >
            side
          </Panel>
          <Panel>main</Panel>
        </PanelGroup>
      </PanelProvider>,
    );
    expect(
      warn.mock.calls.some(([message]) =>
        String(message).includes(
          "controlled collapsed prop inside a <PanelGroup> with a controlled value",
        ),
      ),
    ).toBe(true);
  });

  it("warns when collapsed is provided on a non-collapsible panel and stays inert", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = await render(
      <PanelProvider>
        <PanelGroup orientation="horizontal">
          {/* Peers default to collapsible={false}. */}
          <Panel panelId="plain" collapsed={true}>
            plain
          </Panel>
          <Panel>main</Panel>
        </PanelGroup>
      </PanelProvider>,
    );
    expect(
      warn.mock.calls.some(([message]) =>
        String(message).includes("collapsed requires collapsible"),
      ),
    ).toBe(true);
    expect(panelState(container, "plain")).toBe("expanded");
  });
});

describe("controlled collapsed vs controlled group value (R-33)", () => {
  it("the panel prop wins: group-value applications propose, and re-renders with the same value do not re-propose", async () => {
    const proposals: ProposalLog = [];
    const panelApiRef = { current: null as PanelApi | null };
    const groupApiRef = { current: null as PanelGroupApi | null };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    void warn; // diagnosed misconfiguration — warning asserted above.

    function App({ groupValue }: { groupValue: number }) {
      return (
        <PanelProvider>
          <PanelGroup
            orientation="horizontal"
            apiRef={groupApiRef}
            value={{
              side: { size: groupValue, collapsed: true },
              main: { size: 400 },
            }}
          >
            <Panel
              side="start"
              panelId="side"
              defaultSize={200}
              minSize={100}
              maxSize={1000}
              collapsible
              collapsed={false}
              apiRef={panelApiRef}
              onCollapsedChange={(next, details) => {
                proposals.push({ collapsed: next, details });
              }}
            >
              side
            </Panel>
            <PanelResizeHandle aria-label="Resize side" />
            <Panel panelId="main">main</Panel>
          </PanelGroup>
        </PanelProvider>
      );
    }

    const { container, root } = await render(<App groupValue={220} />);
    // The group's controlled commit carries collapsed: true for `side`, but
    // the PANEL prop wins — the panel stays expanded and the commit does
    // not spam proposals (it is an acceptance echo, not an explicit apply).
    expect(panelState(container, "side")).toBe("expanded");
    expect(proposals).toEqual([]);
    expect(panelApiRef.current?.isCollapsed()).toBe(false);

    // A group-value re-render (size change) still must not fight the bit.
    await act(async () => {
      root.render(<App groupValue={260} />);
    });
    expect(panelState(container, "side")).toBe("expanded");
    expect(proposals).toEqual([]);

    // An explicit setValue DOES propose the conflicting bit once.
    await act(async () => {
      groupApiRef.current?.setValue({
        side: { size: 260, collapsed: true },
        main: { size: 400 },
      });
    });
    expect(proposals).toEqual([
      { collapsed: true, details: { reason: "set-value", trigger: "api" } },
    ]);
    expect(panelState(container, "side")).toBe("expanded");
  });
});
