import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { PanelBody, Toolbar } from "./shared";

/**
 * R-31 regression fixture: three-level axis-REALIGNING nesting. The outer
 * horizontal group holds a collapsible dock; the center panel nests a
 * vertical group whose editor area nests a third, horizontal splits group —
 * so the innermost group shares the OUTER group's axis. While the dock
 * animates closed, the center grows every frame and the splits group's
 * ResizeObserver sees genuine MAIN-axis container churn. Pre-fix that churn
 * raised the provider-wide `isResizing` flag and stripped the transition
 * from every panel in the tree — including the animating dock itself, which
 * snapped shut. Suppression is now group-local, so only the splits group's
 * own panels track instantly and the dock keeps its 300ms collapse.
 */
export default function NestedAnimationIntegrityTest() {
  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup orientation="horizontal" groupId="nai-outer">
          <Panel
            panelId="dock"
            side="start"
            defaultSize={260}
            minSize={120}
            maxSize={400}
            className="panel-surface"
          >
            <PanelBody groupId="nai-outer" label="dock" />
          </Panel>
          <PanelResizeHandle data-testid="dock-handle" />
          <Panel panelId="center" minSize="20%">
            <PanelGroup orientation="vertical" groupId="nai-center">
              <Panel panelId="editor-area" minSize="20%">
                <PanelGroup orientation="horizontal" groupId="nai-splits">
                  <Panel panelId="split-a" defaultSize="50%" minSize={60}>
                    <PanelBody
                      groupId="nai-splits"
                      label="split-a"
                      variant="grow"
                    />
                  </Panel>
                  <PanelResizeHandle data-testid="splits-handle" />
                  <Panel panelId="split-b" minSize={60}>
                    <PanelBody
                      groupId="nai-splits"
                      label="split-b"
                      variant="grow"
                    />
                  </Panel>
                </PanelGroup>
              </Panel>
              <PanelResizeHandle data-testid="bottom-handle" />
              <Panel
                panelId="bottom"
                side="end"
                defaultSize={140}
                minSize={80}
                maxSize={320}
                className="panel-surface"
              >
                <PanelBody groupId="nai-center" label="bottom" />
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
        <Toolbar panels={[{ groupId: "nai-outer", panelId: "dock" }]} />
      </div>
    </PanelProvider>
  );
}
