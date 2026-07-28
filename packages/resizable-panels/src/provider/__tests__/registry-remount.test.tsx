// @vitest-environment jsdom
// Protected contract (R-01): provider-registry subscriptions survive
// registry-emptying remounts. When every identified panel in a group
// unmounts while the group (and its `groupId` publication) stay mounted,
// already-mounted `usePanelControls` / `usePanelRegistry` consumers must
// resolve the panel again on remount AND keep observing its later updates.
// The store may never replace a group's registry while the group lives —
// subscribers stay attached to the original store and would otherwise
// render `undefined` forever.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { PanelGroup } from "../../group/panel-group";
import { Panel } from "../../panel/panel";
import type { PanelControls, PanelLocator } from "../../types";
import { PanelProvider } from "../panel-provider";
import { usePanelControls, usePanelRegistry } from "../public-hooks";

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

/** Records the reactive `usePanelRegistry` snapshot for a groupId. */
function RegistryProbe({
  groupId,
  out,
}: {
  groupId: string;
  out: { current: Readonly<Record<string, PanelControls>> };
}) {
  out.current = usePanelRegistry(groupId);
  return null;
}

/** A group whose ONLY identified panel is conditionally rendered. The
 * anonymous peer never registers in the public store, so hiding the sidebar
 * empties the group's registry while the group itself stays mounted. */
function App({
  showPanel,
  probes,
}: {
  showPanel: boolean;
  probes: React.ReactNode;
}) {
  return (
    <PanelProvider>
      {probes}
      <PanelGroup orientation="horizontal" groupId="g">
        {showPanel ? (
          <Panel
            side="start"
            panelId="sidebar"
            defaultSize={200}
            minSize={0}
            maxSize={1000}
          />
        ) : null}
        <Panel />
      </PanelGroup>
    </PanelProvider>
  );
}

describe("registry subscriptions survive identified-panel remounts (R-01)", () => {
  it("usePanelControls resolves a remounted panel and keeps observing its updates", async () => {
    const out: { current: PanelControls | undefined } = { current: undefined };
    const probes = (
      <ControlsProbe locator={{ groupId: "g", panelId: "sidebar" }} out={out} />
    );
    const { root } = await render(<App showPanel={true} probes={probes} />);
    expect(out.current?.size).toBe(200);

    await act(async () => {
      root.render(<App showPanel={false} probes={probes} />);
    });
    expect(out.current).toBeUndefined();

    await act(async () => {
      root.render(<App showPanel={true} probes={probes} />);
    });
    // The panel registered again — the pre-remount subscriber must see it.
    expect(out.current?.size).toBe(200);

    // Liveness, not just one-time resolution: a mutation made through the
    // re-resolved controls must notify the subscriber that predates the
    // remount. A dead subscription would keep reporting the stale size.
    await act(async () => {
      out.current?.setSize(260);
    });
    expect(out.current?.size).toBe(260);
  });

  it("usePanelRegistry recovers the group snapshot after the remount and keeps observing updates", async () => {
    const out: { current: Readonly<Record<string, PanelControls>> } = {
      current: {},
    };
    const probes = <RegistryProbe groupId="g" out={out} />;
    const { root } = await render(<App showPanel={true} probes={probes} />);
    expect(out.current.sidebar?.size).toBe(200);

    await act(async () => {
      root.render(<App showPanel={false} probes={probes} />);
    });
    expect(out.current.sidebar).toBeUndefined();

    await act(async () => {
      root.render(<App showPanel={true} probes={probes} />);
    });
    expect(out.current.sidebar?.size).toBe(200);

    await act(async () => {
      out.current.sidebar?.setSize(260);
    });
    expect(out.current.sidebar?.size).toBe(260);
  });
});
