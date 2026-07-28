import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { PanelBody, Toolbar } from "./shared";

/**
 * Nested persistence harness. Outer horizontal group persists under one
 * `persistence.key`, inner vertical group under another, both within a single
 * `PanelProvider`. Layout shape mirrors NestedTest so the existing helpers
 * (sidebar, editor, terminal, inspector) keep working.
 *
 * Tests assert that:
 *  - each group writes only its own key
 *  - each group restores independently across reload
 *  - seeding one key doesn't accidentally drive the other
 */

export const OUTER_KEY = "resizable-panels-persist-outer";
export const INNER_KEY = "resizable-panels-persist-inner";

export default function NestedPersistenceTest() {
  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup
          orientation="horizontal"
          groupId="nested-persist-outer"
          persistence={{ key: OUTER_KEY }}
        >
          <Panel
            panelId="sidebar"
            side="start"
            defaultSize="22%"
            minSize="15%"
            maxSize="40%"
            className="panel-surface"
          >
            <PanelBody groupId="nested-persist-outer" label="sidebar" />
          </Panel>
          <PanelResizeHandle />
          <Panel panelId="main" minSize="20%">
            <PanelGroup
              orientation="vertical"
              groupId="nested-persist-inner"
              persistence={{ key: INNER_KEY }}
            >
              <Panel panelId="editor" minSize="15%">
                <PanelBody
                  groupId="nested-persist-inner"
                  label="editor"
                  variant="grow"
                />
              </Panel>
              <PanelResizeHandle />
              <Panel
                panelId="terminal"
                side="end"
                defaultSize="35%"
                minSize="15%"
                maxSize="65%"
                className="panel-surface"
              >
                <PanelBody groupId="nested-persist-inner" label="terminal" />
              </Panel>
            </PanelGroup>
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="inspector"
            side="end"
            defaultSize="22%"
            minSize="15%"
            maxSize="40%"
            className="panel-surface"
          >
            <PanelBody groupId="nested-persist-outer" label="inspector" />
          </Panel>
        </PanelGroup>
        <Toolbar
          panels={[
            { groupId: "nested-persist-outer", panelId: "sidebar" },
            { groupId: "nested-persist-inner", panelId: "terminal" },
            { groupId: "nested-persist-outer", panelId: "inspector" },
          ]}
        />
      </div>
    </PanelProvider>
  );
}
