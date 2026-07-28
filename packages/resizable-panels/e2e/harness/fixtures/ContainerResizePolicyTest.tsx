import {
  Panel,
  type PanelApi,
  PanelGroup,
  type PanelGroupValueChangeDetails,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useRef } from "react";

export default function ContainerResizePolicyTest() {
  const params = new URLSearchParams(window.location.search);
  const disabled = params.has("disabled");
  const collapsedHandle = params.has("collapsed-handle");
  const proportionalNav = params.get("nav") === "proportional";
  const eventRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<PanelApi>(null);

  const record = (_value: unknown, details: PanelGroupValueChangeDetails) => {
    if (!eventRef.current) return;
    eventRef.current.dataset.reason = details.reason;
    eventRef.current.dataset.trigger = details.trigger;
    eventRef.current.dataset.count = String(
      Number(eventRef.current.dataset.count ?? 0) + 1,
    );
  };

  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup
          orientation="horizontal"
          disabled={disabled}
          onValueChange={record}
        >
          <Panel
            panelId="nav"
            apiRef={navRef}
            side="start"
            defaultSize={240}
            minSize={100}
            maxSize={500}
            slotProps={{
              viewport: {
                className: collapsedHandle
                  ? "collapsed-border-test"
                  : undefined,
              },
            }}
            containerResizeBehavior={proportionalNav ? "proportional" : "fixed"}
          >
            nav
          </Panel>
          <PanelResizeHandle data-testid="nav-handle" />
          <Panel panelId="editor" defaultSize={360} minSize={120} maxSize={900}>
            editor
          </Panel>
          <PanelResizeHandle data-testid="editor-handle" />
          <Panel
            panelId="preview"
            defaultSize={600}
            minSize={120}
            maxSize={900}
          >
            preview
          </Panel>
        </PanelGroup>
        {collapsedHandle ? (
          <div className="collapsed-handle-controls">
            <button
              type="button"
              data-testid="collapse-nav"
              onClick={() => navRef.current?.collapse()}
            >
              Collapse nav
            </button>
            <button
              type="button"
              data-testid="expand-nav"
              onClick={() => navRef.current?.expand()}
            >
              Expand nav
            </button>
          </div>
        ) : null}
        <div
          ref={eventRef}
          data-testid="policy-events"
          data-reason=""
          data-trigger=""
          data-count="0"
        />
      </div>
    </PanelProvider>
  );
}
