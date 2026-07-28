// @vitest-environment jsdom
// Fail-first (R-36): the LIBRARY surface for usePanelGroupState. This file
// imports the hook from the public barrel; at baseline the export does not
// exist, so the whole file fails to load — the intended "export absent"
// signal, isolated here so every other unit file stays green.
//
// Contract under test: provider-level, groupId-keyed, same resolution model
// as usePanelControls (exact match or undefined). Lifecycle guards mirror the
// R-01 registry-staleness family: a subscriber that predates a group
// remount must re-resolve, not go stale at undefined forever.
//
// jsdom trap: there is no ResizeObserver measurement, so containerSize stays
// 0 and `measured` never flips. Panels therefore declare NUMERIC minSize and
// maxSize (a default maxSize "100%" resolves against containerSize 0). The
// assertions here read only shape/resolution, never painted pixels; live
// measurement is the e2e spec's job.
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type PanelGroupState, usePanelGroupState } from "../../index.js";
import { Panel } from "../../panel/panel";
import { PanelProvider } from "../../provider/panel-provider";
import { PanelGroup } from "../panel-group";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(async () => root.unmount());
  }
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

/** Let the group's publisher effect / rAF-scheduled init settle. */
async function settleFrame() {
  await act(async () => {
    await new Promise((resolve) => {
      requestAnimationFrame(() => resolve(null));
    });
  });
}

/** Records what `usePanelGroupState` resolves for a groupId, from a probe
 * mounted at provider level (the parent-of-the-group vantage). */
function StateProbe({
  groupId,
  out,
}: {
  groupId: string;
  out: { current: PanelGroupState | undefined };
}) {
  out.current = usePanelGroupState(groupId);
  return null;
}

/** A group that publishes `groupId` when `show` is true. Numeric bounds so
 * the jsdom-zero container still yields sane resolved min/max. */
function App({ show, probes }: { show: boolean; probes: React.ReactNode }) {
  return (
    <PanelProvider>
      {probes}
      {show ? (
        <PanelGroup orientation="horizontal" groupId="g">
          <Panel
            side="start"
            panelId="left"
            defaultSize={200}
            minSize={120}
            maxSize={400}
          />
          <Panel panelId="main" minSize={100} maxSize={800} />
        </PanelGroup>
      ) : null}
    </PanelProvider>
  );
}

/** Same as `App` but the panels are ANONYMOUS (no panelId). An anonymous-only
 * group creates its registry lazily via `publishGroupState`, so a subscriber
 * that attaches before publication must still resolve (L1). */
function AnonApp({ show, probes }: { show: boolean; probes: React.ReactNode }) {
  return (
    <PanelProvider>
      {probes}
      {show ? (
        <PanelGroup orientation="horizontal" groupId="g">
          <Panel side="start" defaultSize={200} minSize={120} maxSize={400} />
          <Panel minSize={100} maxSize={800} />
        </PanelGroup>
      ) : null}
    </PanelProvider>
  );
}

describe("usePanelGroupState resolution (R-36)", () => {
  it("returns undefined for a groupId no mounted group publishes", async () => {
    const out: { current: PanelGroupState | undefined } = {
      current: undefined,
    };
    await render(
      <App show={true} probes={<StateProbe groupId="ghost" out={out} />} />,
    );
    await settleFrame();
    expect(out.current).toBeUndefined();
  });

  it("resolves to a snapshot once the matching group publishes its groupId", async () => {
    const out: { current: PanelGroupState | undefined } = {
      current: undefined,
    };
    await render(
      <App show={true} probes={<StateProbe groupId="g" out={out} />} />,
    );
    await settleFrame();
    // Shape only — jsdom does not measure, so no pixel assertions.
    expect(out.current).toBeDefined();
    expect(typeof out.current?.containerSize).toBe("number");
    expect(typeof out.current?.measured).toBe("boolean");
    expect(typeof out.current?.overconstrainedBy).toBe("number");
    expect(typeof out.current?.unallocatedPx).toBe("number");
  });
});

describe("usePanelGroupState lifecycle (R-01 family)", () => {
  it("a subscriber that predates a group remount re-resolves, never goes stale", async () => {
    const out: { current: PanelGroupState | undefined } = {
      current: undefined,
    };
    // The probe mounts ONCE and outlives the group's mount/unmount cycle.
    const probes = <StateProbe groupId="g" out={out} />;
    const { root } = await render(<App show={true} probes={probes} />);
    await settleFrame();
    expect(out.current).toBeDefined();

    await act(async () => root.render(<App show={false} probes={probes} />));
    expect(out.current).toBeUndefined();

    // Remount: a dead subscription (the R-01 symptom) would stay undefined
    // forever; the contract requires it to re-resolve through the new publication.
    await act(async () => root.render(<App show={true} probes={probes} />));
    await settleFrame();
    expect(out.current).toBeDefined();
  });

  // L1: an ANONYMOUS-only group creates its registry only in
  // `publishGroupState` (no panel registration precedes publication to create
  // it). A subscriber established before that publication must still attach and
  // resolve. The panel-level `subscribe`/`subscribeGroup` paths do NOT share
  // this hole: an identified panel's `registerPanel` materializes the registry
  // before `publishGroup`, so their `groups.get(token)` attach always finds it.
  it("resolves for an anonymous-only group mounted in a later commit (consumer-first)", async () => {
    const out: { current: PanelGroupState | undefined } = {
      current: undefined,
    };
    const probes = <StateProbe groupId="g" out={out} />;
    const { root } = await render(<AnonApp show={false} probes={probes} />);
    await settleFrame();
    expect(out.current).toBeUndefined();

    await act(async () => root.render(<AnonApp show={true} probes={probes} />));
    await settleFrame();
    expect(out.current).toBeDefined();
  });

  it("re-resolves for an anonymous-only group across unmount/remount", async () => {
    const out: { current: PanelGroupState | undefined } = {
      current: undefined,
    };
    const probes = <StateProbe groupId="g" out={out} />;
    const { root } = await render(<AnonApp show={true} probes={probes} />);
    await settleFrame();
    expect(out.current).toBeDefined();

    await act(async () =>
      root.render(<AnonApp show={false} probes={probes} />),
    );
    expect(out.current).toBeUndefined();

    await act(async () => root.render(<AnonApp show={true} probes={probes} />));
    await settleFrame();
    expect(out.current).toBeDefined();
  });

  it("returns to undefined after the group tears down", async () => {
    const out: { current: PanelGroupState | undefined } = {
      current: undefined,
    };
    const probes = <StateProbe groupId="g" out={out} />;
    const { root } = await render(<App show={true} probes={probes} />);
    await settleFrame();
    expect(out.current).toBeDefined();

    await act(async () => root.render(<App show={false} probes={probes} />));
    expect(out.current).toBeUndefined();
  });

  it("resolves under StrictMode double-publish without a duplicate-groupId warning", async () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    const out: { current: PanelGroupState | undefined } = {
      current: undefined,
    };
    await render(
      <StrictMode>
        <App show={true} probes={<StateProbe groupId="g" out={out} />} />
      </StrictMode>,
    );
    await settleFrame();
    expect(out.current).toBeDefined();
    // Double-invoked publish re-registers the SAME owner; it must not be
    // mistaken for a genuine duplicate groupId.
    const duplicate = warn.mock.calls.filter((args) =>
      String(args[0]).includes("Duplicate groupId"),
    );
    expect(duplicate).toEqual([]);
    warn.mockRestore();
  });
});
