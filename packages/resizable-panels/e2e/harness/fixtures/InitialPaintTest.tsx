import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useLayoutEffect, useState } from "react";

/**
 * Starts at zero width, then becomes visible on the next presented frame.
 * The outer automatic peer contains a second group, matching the ancestor →
 * mini-demo measurement cascade that exposed the initial allocation flash.
 * There are intentionally no panel hook consumers on this page.
 */
export default function InitialPaintTest() {
  const [width, setWidth] = useState<number | string>(0);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => setWidth("100vw"));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <PanelProvider>
      <div data-testid="initial-paint-shell" style={{ height: 240, width }}>
        <PanelGroup data-testid="initial-outer" orientation="horizontal">
          <Panel side="start" defaultSize={180} minSize={120} maxSize={320}>
            outer dock
          </Panel>
          <PanelResizeHandle />
          <Panel>
            <PanelGroup data-testid="initial-nested" orientation="horizontal">
              <Panel side="start" defaultSize="33%" minSize="10%" maxSize="50%">
                nested dock
              </Panel>
              <PanelResizeHandle />
              <Panel>nested peer</Panel>
              <PanelResizeHandle />
              <Panel side="end" defaultSize="33%" minSize="10%" maxSize="50%">
                nested end dock
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
    </PanelProvider>
  );
}
