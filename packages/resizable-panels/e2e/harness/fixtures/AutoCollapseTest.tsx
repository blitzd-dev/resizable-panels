import {
  Panel,
  type PanelApi,
  type PanelChangeDetails,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelControls,
} from "@blitzd/resizable-panels";
import { useRef } from "react";

/**
 * R-37 auto-collapse fixture (Batch 4).
 *
 * `collapsible="auto"` folds a docked panel to its rail when its declared
 * minimum stops fitting the container, releasing it when space returns.
 *
 * Query params select the scenario:
 *   (default)      two auto panels (nav primary, inspector trailing) + a
 *                  proportional main; sweep the viewport to fold trailing-first.
 *   ?controlled    inspector is controlled (`collapsed`) + auto → auto inert.
 *   ?zero          inspector auto with collapsedSize:0 → refuses to arm.
 */
type Counts = { collapse: number; expand: number };

function Readout({ panelId }: { panelId: string }) {
  const ctrl = usePanelControls({ groupId: "auto-collapse", panelId });
  if (!ctrl) return null;
  return (
    <span
      data-testid={`readout-${panelId}`}
      data-collapsed={String(ctrl.collapsed)}
      data-rendered={String(Math.round(ctrl.renderedSize))}
    />
  );
}

export default function AutoCollapseTest() {
  const params = new URLSearchParams(window.location.search);
  const controlled = params.has("controlled");
  const zero = params.has("zero");
  // Keep the inspector's collapsed rail draggable so a pointer drag can reopen
  // a width-folded panel (X5 drag-expand scenario).
  const resizable = params.has("resizable");
  const inspRef = useRef<PanelApi>(null);

  // Per-panel edge-triggered event log: count + last reason/trigger.
  const eventsRef = useRef<HTMLDivElement>(null);
  const counts = useRef<Record<string, Counts>>({});
  const record = (
    panelId: string,
    collapsed: boolean,
    details: PanelChangeDetails,
  ) => {
    counts.current[panelId] ??= { collapse: 0, expand: 0 };
    const c = counts.current[panelId];
    if (collapsed) c.collapse += 1;
    else c.expand += 1;
    const el = eventsRef.current;
    if (!el) return;
    el.dataset[`${panelId}Collapse`] = String(c.collapse);
    el.dataset[`${panelId}Expand`] = String(c.expand);
    el.dataset[`${panelId}Reason`] = details.reason;
    el.dataset[`${panelId}Trigger`] = details.trigger;
  };

  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup
          orientation="horizontal"
          groupId="auto-collapse"
          persistence={{ key: "auto-collapse" }}
        >
          <Panel
            panelId="nav"
            side="start"
            defaultSize={200}
            minSize={200}
            maxSize={500}
            collapsible="auto"
            collapsedSize={48}
            onCollapsedChange={(c, d) => record("nav", c, d)}
          >
            nav
            <Readout panelId="nav" />
          </Panel>
          <PanelResizeHandle />
          <Panel panelId="main" defaultSize={400} minSize={300}>
            main
            <Readout panelId="main" />
          </Panel>
          <PanelResizeHandle />
          <Panel
            apiRef={inspRef}
            panelId="inspector"
            side="end"
            defaultSize={240}
            minSize={240}
            maxSize={500}
            collapsible="auto"
            collapsedSize={zero ? 0 : 48}
            resizableWhenCollapsed={resizable}
            {...(controlled ? { collapsed: false } : null)}
            onCollapsedChange={(c, d) => record("inspector", c, d)}
          >
            inspector
            <Readout panelId="inspector" />
          </Panel>
        </PanelGroup>

        <div className="toolbar-overlay">
          <div className="toolbar">
            <button
              type="button"
              data-testid="expand-inspector"
              onClick={() => inspRef.current?.expand()}
            >
              expand inspector
            </button>
            <button
              type="button"
              data-testid="collapse-inspector"
              onClick={() => inspRef.current?.collapse()}
            >
              collapse inspector
            </button>
          </div>
        </div>

        <div
          ref={eventsRef}
          data-testid="auto-events"
          data-nav-collapse="0"
          data-nav-expand="0"
          data-inspector-collapse="0"
          data-inspector-expand="0"
        />
      </div>
    </PanelProvider>
  );
}
