import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { PanelBody, Toolbar } from "./shared";

/**
 * Full-viewport four-columns layout for end-to-end testing. No demo card,
 * nav, or other chrome — the layout fills the entire viewport so tests can
 * exercise it at any width via `page.setViewportSize`.
 *
 * Mirrors the Four Columns mini-demo's panel config exactly, so behavioral
 * tests written against this page also pin down the catalog demo's
 * behavior.
 */
export default function FourColumnsTest() {
  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup orientation="horizontal" groupId="four-columns">
          <Panel
            id="nav"
            panelId="nav"
            side="start"
            defaultSize="18%"
            minSize="12%"
            maxSize="30%"
            className="panel-surface"
          >
            <PanelBody groupId="four-columns" label="nav" />
          </Panel>
          <PanelResizeHandle data-testid="nav-list-handle" />
          <Panel
            panelId="list"
            side="start"
            defaultSize="22%"
            minSize="15%"
            maxSize="35%"
            className="panel-surface"
          >
            <PanelBody groupId="four-columns" label="list" />
          </Panel>
          <PanelResizeHandle data-testid="list-main-handle" />
          <Panel id="main" panelId="main" minSize="20%">
            <PanelBody groupId="four-columns" label="main" variant="grow" />
          </Panel>
          <PanelResizeHandle data-testid="main-inspector-handle" />
          <Panel
            panelId="inspector"
            side="end"
            defaultSize="22%"
            minSize="15%"
            maxSize="35%"
            className="panel-surface"
          >
            <PanelBody groupId="four-columns" label="inspector" />
          </Panel>
        </PanelGroup>
        <Toolbar
          panels={["nav", "list", "inspector"].map((panelId) => ({
            groupId: "four-columns",
            panelId,
          }))}
        />
      </div>
    </PanelProvider>
  );
}
