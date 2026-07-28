import {
  Panel,
  type PanelApi,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useRef, useState } from "react";

const pixels = (ref: React.RefObject<PanelApi | null>) => ({
  preferred: ref.current?.getSize(),
  rendered: ref.current?.getRenderedSize(),
});

/**
 * Never-squish sweep fixture (PLAN Batch 1 item 7 / R-34).
 *
 * An UNTOUCHED docked panel with a string default (`"30%"`) and a hard pixel
 * minimum, next to a peer with its own minimum. The spec sweeps the group
 * width 900 → 240 through the width input and asserts that neither panel is
 * ever painted below its resolved minSize, that `getRenderedSize()` matches
 * the measured box, and that below Σ floors (280 + 200 = 480) the group
 * declares the over-constraint (`data-overconstrained`, overflow, one dev
 * warning).
 *
 * `?behavior=proportional` switches the docked panel's
 * `containerResizeBehavior`; the default is `"fixed"` — the docked default,
 * and the path where R-34 paints the raw percentage indefinitely.
 */
export default function NeverSquishTest() {
  const params = new URLSearchParams(window.location.search);
  const behavior =
    params.get("behavior") === "proportional" ? "proportional" : "fixed";
  // `?width=N` sets the initial group width so the over-constrained state can
  // be exercised on a cold mount (F2 grow-in probe); defaults to 900.
  const initialWidth = Number(params.get("width"));
  const [extent, setExtent] = useState(
    Number.isFinite(initialWidth) && initialWidth > 0 ? initialWidth : 900,
  );
  const dockRef = useRef<PanelApi>(null);
  const peerRef = useRef<PanelApi>(null);

  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup
          orientation="horizontal"
          data-testid="never-squish-group"
          style={{ width: extent, height: 300 }}
        >
          <Panel
            panelId="dock"
            apiRef={dockRef}
            side="start"
            defaultSize="30%"
            minSize={280}
            containerResizeBehavior={behavior}
          >
            dock
          </Panel>
          <PanelResizeHandle data-testid="dock-handle" />
          <Panel panelId="peer" apiRef={peerRef} minSize={200}>
            peer
          </Panel>
        </PanelGroup>
        <div className="toolbar-overlay">
          <div className="toolbar">
            <input
              data-testid="width-input"
              type="number"
              value={extent}
              onChange={(event) => {
                const next = Number(event.currentTarget.value);
                if (Number.isFinite(next) && next >= 0) setExtent(next);
              }}
            />
            <button
              type="button"
              data-testid="read-never-squish-state"
              onClick={(event) => {
                event.currentTarget.dataset.snapshot = JSON.stringify({
                  dock: pixels(dockRef),
                  peer: pixels(peerRef),
                });
              }}
            >
              Read state
            </button>
            {/* G1: record the `constrained` flag from a docked size action.
                In an over-constrained group the paint is floored at minSize, so
                a request above the floor must report constrained even when the
                local min/max clamp alone would not. */}
            <button
              type="button"
              data-testid="probe-dock-constrained"
              onClick={(event) => {
                const setSizeResult = dockRef.current?.setSize(350);
                const maximizeResult = dockRef.current?.maximize();
                const flag = (result: unknown) =>
                  result &&
                  typeof result === "object" &&
                  "constrained" in result
                    ? (result as { constrained: boolean }).constrained
                    : undefined;
                event.currentTarget.dataset.constrained = JSON.stringify({
                  setSize: flag(setSizeResult),
                  maximize: flag(maximizeResult),
                });
              }}
            >
              Probe constrained
            </button>
          </div>
        </div>
      </div>
    </PanelProvider>
  );
}
