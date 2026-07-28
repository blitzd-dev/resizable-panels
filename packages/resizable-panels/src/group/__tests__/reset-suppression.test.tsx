// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PanelResizeHandle } from "../../handle/panel-resize-handle";
import { Panel, type PanelApi } from "../../panel/panel";
import { PanelProvider } from "../../provider/panel-provider";
import { PanelGroup } from "../panel-group";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

afterEach(async () => {
  const current = root;
  root = null;
  if (current) await act(async () => current.unmount());
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

// A collapsible peer animates its min floor alongside flex-basis on the same
// curve (F1), so both terms appear in the resting transition shorthand.
const DEFAULT_PEER_TRANSITION =
  "flex-basis 300ms cubic-bezier(0.4, 0, 0.2, 1), min-width 300ms cubic-bezier(0.4, 0, 0.2, 1)";

/** The §10 suppression footprint is user-observable as `transition: none`
 * on every panel for the two-frame skip window: the resetting peer's own
 * flag and the provider-wide broadcast each force it. Reading the inline
 * transition immediately after the action observes the window before the
 * rAF countdown can clear it. */
function peerTransition(container: HTMLElement, panelId: string): string {
  const element = container.querySelector<HTMLElement>(
    `[data-resizable-panels-panel-id="${panelId}"]`,
  );
  if (!element) throw new Error(`Expected panel "${panelId}" to render`);
  return element.style.transition;
}

async function renderPeers(leftDefaultSize?: number) {
  // A measurable container: the allocator only commits once the group's
  // content box resolves to a nonzero main size.
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
  const leftApi = { current: null as PanelApi | null };
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
              panelId="left"
              apiRef={leftApi}
              collapsible
              minSize={50}
              {...(leftDefaultSize !== undefined
                ? { defaultSize: leftDefaultSize }
                : {})}
            >
              left
            </Panel>
            <PanelResizeHandle />
            <Panel panelId="right" collapsible minSize={50}>
              right
            </Panel>
          </PanelGroup>
        </PanelProvider>
      </StrictMode>,
    );
  });
  const api = leftApi.current;
  if (!api) throw new Error("Expected the left peer apiRef to populate");
  return { api, container };
}

describe('peer reset({transition:"none"}) suppression footprint (R-20)', () => {
  it("a no-op automatic-pool reset leaves no skip-animation footprint", async () => {
    const { api, container } = await renderPeers();
    // Two automatic peers split the 800px container evenly; the pool
    // re-resolution reproduces the identical allocation, so nothing
    // changes and nothing may be suppressed.
    expect(api.getSize()).toBeCloseTo(400, 0);

    let result: ReturnType<PanelApi["reset"]> | undefined;
    await act(async () => {
      result = api.reset({ transition: "none" });
    });
    expect(result?.applied).toBe(false);
    // Neither the resetting peer's local flag nor the provider broadcast
    // raised: both panels keep their animated transition.
    expect(peerTransition(container, "left")).toBe(DEFAULT_PEER_TRANSITION);
    expect(peerTransition(container, "right")).toBe(DEFAULT_PEER_TRANSITION);
  });

  it("an automatic-pool reset that reallocates suppresses for the same paint", async () => {
    const { api, container } = await renderPeers();
    await act(async () => {
      api.setSize(100);
    });
    expect(api.getSize()).toBeCloseTo(100, 0);

    let result: ReturnType<PanelApi["reset"]> | undefined;
    await act(async () => {
      result = api.reset({ transition: "none" });
    });
    expect(result?.applied).toBe(true);
    expect(api.getSize()).toBeCloseTo(400, 0);
    // The accepted reallocation snaps: local and provider-wide flags are
    // both up for the commit that paints it.
    expect(peerTransition(container, "left")).toBe("none");
    expect(peerTransition(container, "right")).toBe("none");
  });

  it("a no-op explicit-default reset leaves no skip-animation footprint", async () => {
    const { api, container } = await renderPeers(300);
    // The peer already sits at its declarative default.
    expect(api.getSize()).toBeCloseTo(300, 0);

    let result: ReturnType<PanelApi["reset"]> | undefined;
    await act(async () => {
      result = api.reset({ transition: "none" });
    });
    expect(result?.applied).toBe(false);
    expect(peerTransition(container, "left")).toBe(DEFAULT_PEER_TRANSITION);
    expect(peerTransition(container, "right")).toBe(DEFAULT_PEER_TRANSITION);
  });
});
