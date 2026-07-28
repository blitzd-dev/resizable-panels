import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { PanelBody } from "./shared";

/**
 * Scaled-ancestor harness: the group renders at 200% size inside a
 * `transform: scale(0.5)` wrapper — the "zoomed-out preview" pattern.
 * Pointer coordinates arrive in visual px while the layout model runs in
 * CSS layout px; the spec asserts drags track the cursor 1:1 and that
 * min/max clamps stay in layout units.
 */
export default function ScaledContainerTest() {
  return (
    <PanelProvider>
      <div className="fixture-root" style={{ overflow: "hidden" }}>
        <div
          style={{
            width: "200%",
            height: "200%",
            transform: "scale(0.5)",
            transformOrigin: "top left",
          }}
        >
          <PanelGroup orientation="horizontal" groupId="scaled">
            <Panel
              panelId="nav"
              side="start"
              defaultSize={200}
              minSize={100}
              maxSize={400}
              className="panel-surface"
            >
              <PanelBody groupId="scaled" label="nav" />
            </Panel>
            <PanelResizeHandle data-testid="scaled-handle" />
            <Panel>
              <PanelBody groupId="scaled" label="main" variant="grow" />
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </PanelProvider>
  );
}
