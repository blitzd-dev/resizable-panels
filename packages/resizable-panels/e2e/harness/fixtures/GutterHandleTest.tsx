import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";

/**
 * R-14 — space-occupying gutter handles. One horizontal group whose single
 * handle declares `gutterSize={10}`: the slot must occupy real layout space
 * (panels + gutter sum to the container), the whole gutter plus the default
 * hit-area margins must accept drags, and keyboard resize must keep working.
 * The handle carries an inline background so the spec can verify consumer
 * styling fills exactly the gutter box.
 */
export default function GutterHandleTest() {
  // `?overconstrained` renders a group whose single gutter (200px) alone
  // exceeds the 150px container, so the true shortfall is
  // Σfloors(200) + Σgutter(200) − container(150) = 250. It exercises the G2
  // arithmetic: the allocator only sees `max(0, container − gutters) = 0`, so
  // the gutter overflow (Σgutter − container = 50) must be added back at the
  // group so the reported shortfall does not undercount.
  const overconstrained = new URLSearchParams(window.location.search).has(
    "overconstrained",
  );
  if (overconstrained) {
    return (
      <PanelProvider>
        <div className="fixture-root">
          <PanelGroup
            orientation="horizontal"
            groupId="gutter-overconstrained"
            data-testid="gutter-overconstrained-group"
            style={{ width: 150, height: 200 }}
          >
            <Panel panelId="left" defaultSize={300} minSize={100}>
              <div className="panel-body">left</div>
            </Panel>
            <PanelResizeHandle
              data-testid="gutter-handle"
              handleId="gutter-seam"
              gutterSize={200}
            />
            <Panel panelId="right" minSize={100}>
              <div className="panel-body">right</div>
            </Panel>
          </PanelGroup>
        </div>
      </PanelProvider>
    );
  }
  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup orientation="horizontal" groupId="gutter">
          <Panel panelId="left" defaultSize={300} minSize={100}>
            <div className="panel-body">left</div>
          </Panel>
          <PanelResizeHandle
            data-testid="gutter-handle"
            handleId="gutter-seam"
            gutterSize={10}
            style={{ background: "rgb(90, 90, 120)" }}
          />
          <Panel panelId="right" minSize={100}>
            <div className="panel-body">right</div>
          </Panel>
        </PanelGroup>
      </div>
    </PanelProvider>
  );
}
