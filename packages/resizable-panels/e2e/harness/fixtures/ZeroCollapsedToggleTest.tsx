import {
  Panel,
  type PanelApi,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelControls,
} from "@blitzd/resizable-panels";
import { useRef } from "react";

/**
 * R-18 — Enter reopens a zero-collapsed panel. A docked panel that
 * collapses to a 0px rail leaves its seam drag-dead by design; the handle
 * must nevertheless stay focusable (`data-toggle-only`), and Enter must
 * expand the panel back to its preferred size. The toolbar is rendered
 * BEFORE the group in DOM order so the spec can prove Tab reaches the
 * handle. Resize lifecycle counters prove drags on the dead seam stay
 * silent.
 */
function ZedState() {
  const controls = usePanelControls({
    groupId: "zero-toggle",
    panelId: "zed",
  });
  return (
    <span
      data-testid="zed-state"
      data-collapsed={String(controls?.collapsed ?? false)}
      data-preferred={String(Math.round(controls?.size ?? 0))}
      data-rendered={String(Math.round(controls?.renderedSize ?? 0))}
    />
  );
}

export default function ZeroCollapsedToggleTest() {
  const panelRef = useRef<PanelApi>(null);
  const lifecycleRef = useRef<HTMLDivElement>(null);
  const countsRef = useRef({ start: 0, end: 0 });
  const record = (key: keyof typeof countsRef.current) => {
    countsRef.current[key] += 1;
    if (lifecycleRef.current) {
      lifecycleRef.current.dataset[key] = String(countsRef.current[key]);
    }
  };

  return (
    <PanelProvider>
      <div className="fixture-root">
        <div className="toolbar-overlay">
          <div className="toolbar">
            <button
              type="button"
              data-testid="resize-zed"
              onClick={() => panelRef.current?.setSize(260)}
            >
              resize
            </button>
            <button
              type="button"
              data-testid="collapse-zed"
              onClick={() => panelRef.current?.collapse()}
            >
              collapse
            </button>
            <button
              type="button"
              data-testid="expand-zed"
              onClick={() => panelRef.current?.expand()}
            >
              expand
            </button>
            <ZedState />
          </div>
        </div>
        <PanelGroup
          orientation="horizontal"
          groupId="zero-toggle"
          onResizeStart={() => record("start")}
          onResizeEnd={() => record("end")}
        >
          <Panel
            apiRef={panelRef}
            side="start"
            panelId="zed"
            defaultSize={220}
            minSize={120}
            collapsedSize={0}
          >
            <div className="panel-body">zed</div>
          </Panel>
          <PanelResizeHandle data-testid="zed-handle" handleId="zed-seam" />
          <Panel panelId="main" minSize={100}>
            <div className="panel-body">main</div>
          </Panel>
        </PanelGroup>
        <div
          ref={lifecycleRef}
          data-testid="zed-lifecycle"
          data-start="0"
          data-end="0"
        />
      </div>
    </PanelProvider>
  );
}
