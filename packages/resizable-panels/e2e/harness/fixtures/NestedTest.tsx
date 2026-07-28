import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { PanelBody, Toolbar } from "./shared";

/**
 * IDE-shaped nested layout: outer horizontal (sidebar | peer | inspector),
 * inner vertical inside the peer (editor / terminal). Tests both axes at
 * once and exercises the cross-axis ResizeObserver filtering that fixed
 * the close-animation regression.
 */
export default function NestedTest() {
  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup orientation="horizontal" groupId="nested-outer">
          <Panel
            panelId="sidebar"
            side="start"
            defaultSize="22%"
            minSize="15%"
            maxSize="40%"
            className="panel-surface"
          >
            <PanelBody groupId="nested-outer" label="sidebar" />
          </Panel>
          <PanelResizeHandle data-testid="sidebar-handle" />
          <Panel panelId="main" minSize="20%">
            <PanelGroup orientation="vertical" groupId="nested-inner">
              <Panel panelId="editor" minSize="15%">
                <PanelBody
                  groupId="nested-inner"
                  label="editor"
                  variant="grow"
                />
              </Panel>
              <PanelResizeHandle data-testid="terminal-handle" />
              <Panel
                panelId="terminal"
                side="end"
                defaultSize="35%"
                minSize="15%"
                maxSize="65%"
                className="panel-surface"
              >
                <PanelBody groupId="nested-inner" label="terminal" />
              </Panel>
            </PanelGroup>
          </Panel>
          <PanelResizeHandle data-testid="inspector-handle" />
          <Panel
            panelId="inspector"
            side="end"
            defaultSize="22%"
            minSize="15%"
            maxSize="40%"
            className="panel-surface"
          >
            <PanelBody groupId="nested-outer" label="inspector" />
          </Panel>
        </PanelGroup>
        <Toolbar
          panels={[
            { groupId: "nested-outer", panelId: "sidebar" },
            { groupId: "nested-inner", panelId: "terminal" },
            { groupId: "nested-outer", panelId: "inspector" },
          ]}
        />
      </div>
    </PanelProvider>
  );
}
