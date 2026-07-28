import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useEffect } from "react";

export default function AccessibilitySsrTest({
  initialCollapsed,
}: {
  initialCollapsed?: boolean;
} = {}) {
  const collapsed =
    initialCollapsed ??
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("collapsed") !== "0"
      : true);

  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
    return () => {
      delete document.documentElement.dataset.hydrated;
    };
  }, []);

  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup orientation="horizontal">
          <Panel
            panelId="ssr-docked"
            side="start"
            defaultSize={240}
            minSize={120}
            defaultCollapsed={collapsed}
          >
            <button type="button" data-testid="ssr-docked-action">
              docked action
            </button>
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="ssr-peer"
            defaultSize={240}
            minSize={120}
            collapsible
            defaultCollapsed={collapsed}
          >
            <button type="button" data-testid="ssr-peer-action">
              peer action
            </button>
          </Panel>
          <PanelResizeHandle />
          <Panel panelId="ssr-main">main</Panel>
        </PanelGroup>
      </div>
    </PanelProvider>
  );
}
