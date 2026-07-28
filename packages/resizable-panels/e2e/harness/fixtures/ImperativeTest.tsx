import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelActions,
  usePanelControls,
} from "@blitzd/resizable-panels";
import { PanelBody } from "./shared";

const LEFT = { groupId: "imperative", panelId: "left" } as const;

/**
 * Imperative-control harness: a toolbar outside the group drives a docked
 * panel via `usePanelActions().setSize` / `.setCollapsed` /
 * `.expand(target, { transition: "none" })`. Specs collapse the panel, then
 * (a) call setSize while collapsed and assert the new size is adopted by the
 * panel content before expanding, and (b) call expand with transition "none"
 * and assert the expansion never starts a transition.
 */
function ImperativeToolbar() {
  const actions = usePanelActions();
  const left = usePanelControls(LEFT);
  const expanded = left ? !left.collapsed : false;
  return (
    <div className="toolbar-overlay">
      <div className="toolbar">
        <button
          type="button"
          className="toolbar-toggle"
          data-testid="toggle-left"
          aria-pressed={expanded}
          onClick={() => actions.setCollapsed(LEFT, expanded)}
        >
          {expanded ? "Collapse" : "Expand"} left
        </button>
        <button
          type="button"
          className="toolbar-toggle"
          onClick={() => actions.setSize(LEFT, 280)}
        >
          setSize 280
        </button>
        <button
          type="button"
          className="toolbar-toggle"
          data-testid="expand-immediately-left"
          onClick={() => actions.expand(LEFT, { transition: "none" })}
        >
          expand left without transition
        </button>
      </div>
    </div>
  );
}

export default function ImperativeTest() {
  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup orientation="horizontal" groupId="imperative">
          <Panel
            panelId="left"
            side="start"
            defaultSize={160}
            minSize={80}
            maxSize={320}
            className="panel-surface"
          >
            <PanelBody groupId="imperative" label="left" />
          </Panel>
          <PanelResizeHandle />
          <Panel>
            <PanelBody groupId="imperative" label="main" variant="grow" />
          </Panel>
        </PanelGroup>
        <ImperativeToolbar />
      </div>
    </PanelProvider>
  );
}
