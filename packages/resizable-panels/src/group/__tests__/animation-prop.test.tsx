// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { PanelResizeHandle } from "../../handle/panel-resize-handle";
import { Panel } from "../../panel/panel";
import { PanelProvider } from "../../provider/panel-provider";
import { PanelGroup, type PanelGroupProps } from "../panel-group";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

afterEach(async () => {
  const current = root;
  root = null;
  if (current) await act(async () => current.unmount());
  document.body.innerHTML = "";
});

async function renderGroup(animation: PanelGroupProps["animation"]) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const mounted = root;
  await act(async () => {
    mounted.render(
      <StrictMode>
        <PanelProvider>
          <PanelGroup orientation="horizontal" animation={animation}>
            <Panel panelId="docked" side="start" defaultSize={200}>
              docked
            </Panel>
            <PanelResizeHandle />
            <Panel panelId="peer" collapsible>
              peer
            </Panel>
          </PanelGroup>
        </PanelProvider>
      </StrictMode>,
    );
  });
  const docked = container.querySelector<HTMLElement>('[data-kind="docked"]');
  const peer = container.querySelector<HTMLElement>('[data-kind="peer"]');
  if (!docked || !peer) throw new Error("Expected both panels to render");
  return { docked, peer };
}

describe("<PanelGroup animation> (R-16)", () => {
  it("renders the default 300ms transition when the prop is omitted", async () => {
    const { docked, peer } = await renderGroup(undefined);
    expect(docked.style.transition).toBe(
      "width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
    );
    // The collapsible peer animates its min floor alongside flex-basis on the
    // same curve (F1), so both appear in the shorthand.
    expect(peer.style.transition).toBe(
      "flex-basis 300ms cubic-bezier(0.4, 0, 0.2, 1), min-width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
    );
  });

  it("animation={false} disables every library-owned panel transition", async () => {
    const { docked, peer } = await renderGroup(false);
    expect(docked.style.transition).toBe("none");
    expect(peer.style.transition).toBe("none");
  });

  it("custom duration and easing reach the computed transition", async () => {
    const { docked, peer } = await renderGroup({
      durationMs: 500,
      easing: "linear",
    });
    expect(docked.style.transition).toBe("width 500ms linear");
    expect(peer.style.transition).toBe(
      "flex-basis 500ms linear, min-width 500ms linear",
    );
  });

  it("a partial override keeps the other default", async () => {
    const { docked } = await renderGroup({ durationMs: 120 });
    expect(docked.style.transition).toBe(
      "width 120ms cubic-bezier(0.4, 0, 0.2, 1)",
    );
  });
});
