import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { PanelBody, Toolbar } from "./shared";

/**
 * Five-panel symmetric layout: two start-side dockeds + peer + two end-side
 * dockeds. Each handle has both an outward and an inward cascade chain
 * running in opposite directions — this page is the natural target for
 * exercising both ends of `distributeAlongChain` and verifying that
 * cascade direction is correctly derived from `side` × drag direction.
 */
export default function CascadeSymmetricTest() {
  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup orientation="horizontal" groupId="cascade-symmetric">
          <Panel
            panelId="nav"
            side="start"
            defaultSize="16%"
            minSize="10%"
            maxSize="30%"
            className="panel-surface"
          >
            <PanelBody groupId="cascade-symmetric" label="nav" />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="list"
            side="start"
            defaultSize="20%"
            minSize="12%"
            maxSize="35%"
            className="panel-surface"
          >
            <PanelBody groupId="cascade-symmetric" label="list" />
          </Panel>
          <PanelResizeHandle />
          <Panel panelId="main" minSize="12%">
            <PanelBody
              groupId="cascade-symmetric"
              label="main"
              variant="grow"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="inspector"
            side="end"
            defaultSize="20%"
            minSize="12%"
            maxSize="35%"
            className="panel-surface"
          >
            <PanelBody groupId="cascade-symmetric" label="inspector" />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="settings"
            side="end"
            defaultSize="16%"
            minSize="10%"
            maxSize="30%"
            className="panel-surface"
          >
            <PanelBody groupId="cascade-symmetric" label="settings" />
          </Panel>
        </PanelGroup>
        <Toolbar
          panels={["nav", "list", "inspector", "settings"].map((panelId) => ({
            groupId: "cascade-symmetric",
            panelId,
          }))}
        />
      </div>
    </PanelProvider>
  );
}
