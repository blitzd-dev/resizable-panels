import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelActions,
  usePanelControls,
} from "@blitzd/resizable-panels";
import { PanelBody } from "./shared";

const NAV = { groupId: "collapse-below", panelId: "nav" } as const;

/**
 * collapseBelow harness: dragging the docked panel narrower than the
 * threshold collapses it immediately instead of letting it stick at an
 * unusable width. Expanding restores the last usable size.
 * The readout's "Npx · expanded|collapsed" text is asserted by the spec.
 */
function CollapseBelowToolbar() {
  const actions = usePanelActions();
  const ctrl = usePanelControls(NAV);
  const expanded = ctrl ? !ctrl.collapsed : false;
  return (
    <div className="toolbar-overlay">
      <div className="toolbar">
        <button
          type="button"
          className="toolbar-toggle"
          data-testid="toggle-nav"
          aria-pressed={expanded}
          onClick={() => actions.toggle(NAV)}
        >
          {expanded ? "Collapse" : "Expand"} nav
        </button>
        <span className="readout">
          {Math.round(ctrl?.renderedSize ?? 0)}px ·{" "}
          {expanded ? "expanded" : "collapsed"}
        </span>
      </div>
    </div>
  );
}

function RailPanelBody() {
  const ctrl = usePanelControls(NAV);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <button
        type="button"
        data-testid="rail-expand"
        aria-label="Expand navigation"
        onClick={() => ctrl?.expand()}
        style={{ position: "absolute", left: 4, top: 4, width: 40 }}
      >
        nav
      </button>
    </div>
  );
}

function CollapseBelowHandle({ rail }: { rail: boolean }) {
  const ctrl = usePanelControls(NAV);
  return (
    <PanelResizeHandle
      data-testid="collapse-below-handle"
      onClick={() => {
        if (rail && ctrl?.collapsed) ctrl.expand();
      }}
    />
  );
}

export default function CollapseBelowTest() {
  const search = new URLSearchParams(window.location.search);
  const instant = search.has("instant");
  const rail = search.has("rail");
  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup orientation="horizontal" groupId="collapse-below">
          <Panel
            id="nav"
            panelId="nav"
            side="start"
            defaultSize={220}
            minSize={140}
            maxSize={320}
            collapsedSize={rail ? 48 : 0}
            resizableWhenCollapsed={rail}
            collapseBelow={60}
            collapseBelowBehavior={instant ? "instant" : "animated"}
            className="panel-surface"
          >
            {rail ? (
              <RailPanelBody />
            ) : (
              <PanelBody groupId="collapse-below" label="nav" />
            )}
          </Panel>
          <CollapseBelowHandle rail={rail} />
          <Panel>
            <PanelBody groupId="collapse-below" label="main" variant="grow" />
          </Panel>
        </PanelGroup>
        <CollapseBelowToolbar />
      </div>
    </PanelProvider>
  );
}
