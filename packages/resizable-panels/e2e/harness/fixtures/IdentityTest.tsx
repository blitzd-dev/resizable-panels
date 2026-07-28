import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";

/** Proves public ids are optional metadata, not structural identity. */
export default function IdentityTest() {
  const percentage = new URLSearchParams(window.location.search).has(
    "percentage",
  );
  return (
    <PanelProvider>
      <div className="fixture-root" data-testid="identity-root">
        <PanelGroup orientation="horizontal">
          <Panel
            side="start"
            defaultSize={percentage ? "18%" : 180}
            minSize={percentage ? "12%" : 120}
            maxSize={percentage ? "30%" : 320}
            className="panel-surface"
          >
            id-less docked
          </Panel>
          <PanelResizeHandle />
          <Panel>peer</Panel>
        </PanelGroup>
      </div>
    </PanelProvider>
  );
}
