import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelGroupState,
} from "@blitzd/resizable-panels";
import { useRef, useState } from "react";

/**
 * usePanelGroupState e2e fixture (R-36). A parent-level consumer reads the
 * published state for a group shaped like the Batch 1 never-squish sweep:
 * docked `defaultSize="30%" minSize={280}` + peer `minSize={200}`, overlay
 * handle (gutter 0), swept via the width input. The readout surfaces the
 * snapshot fields as DOM attributes so the spec can assert `containerSize`
 * tracks the resize, `measured` flips, and `overconstrainedBy` agrees with
 * the group's `data-overconstrained` at every width.
 */
function StateReadout() {
  const state = usePanelGroupState("group-state");
  // Latch the pre-measurement `measured === false` so the spec can assert the
  // false→true flip without racing the first ResizeObserver callback.
  const everUnmeasured = useRef(false);
  if (state && !state.measured) everUnmeasured.current = true;
  return (
    <div
      data-testid="group-state-readout"
      data-defined={String(state !== undefined)}
      data-measured={state ? String(state.measured) : ""}
      data-ever-unmeasured={String(everUnmeasured.current)}
      data-container-size={state ? String(Math.round(state.containerSize)) : ""}
      data-overconstrained-by={
        state ? String(Math.round(state.overconstrainedBy)) : ""
      }
      data-unallocated={state ? String(Math.round(state.unallocatedPx)) : ""}
    />
  );
}

export default function GroupStateTest() {
  const params = new URLSearchParams(window.location.search);
  const initialWidth = Number(params.get("width"));
  const [extent, setExtent] = useState(
    Number.isFinite(initialWidth) && initialWidth > 0 ? initialWidth : 900,
  );

  return (
    <PanelProvider>
      <div className="fixture-root">
        <StateReadout />
        <PanelGroup
          orientation="horizontal"
          groupId="group-state"
          data-testid="group-state-group"
          style={{ width: extent, height: 300 }}
        >
          <Panel panelId="dock" side="start" defaultSize="30%" minSize={280}>
            dock
          </Panel>
          <PanelResizeHandle data-testid="group-state-handle" />
          <Panel panelId="peer" minSize={200}>
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
          </div>
        </div>
      </div>
    </PanelProvider>
  );
}
