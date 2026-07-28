import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useState } from "react";

/**
 * Regression fixture for R-05: a docked panel with a string `defaultSize`
 * ("50%") must keep tracking its container — like CSS — for as long as no
 * drag, imperative action, or restore commits a pixel preference. The spec
 * steps the container width with pauses longer than the deleted 150ms
 * bootstrap idle window (the exact case that used to freeze mid-settle
 * pixels as the permanent preference), then drags once and asserts the
 * committed preference is fixed from that point on. `maxSize="75%"` keeps
 * the percentage-bounds re-resolution behavior observable after the commit.
 */

const WIDTHS = [320, 480, 640] as const;

export default function StringDefaultLiveTrackingTest() {
  const [width, setWidth] = useState<number>(320);

  return (
    <PanelProvider>
      <div className="fixture-root">
        <div
          data-testid="live-tracking-container"
          style={{ width, height: 240 }}
        >
          <PanelGroup orientation="horizontal">
            <Panel
              panelId="half"
              side="start"
              defaultSize="50%"
              minSize={40}
              maxSize="75%"
            >
              half
            </Panel>
            <PanelResizeHandle />
            <Panel panelId="content" minSize={40}>
              content
            </Panel>
          </PanelGroup>
        </div>
        <div className="toolbar-overlay">
          <div className="toolbar">
            {WIDTHS.map((option) => (
              <button
                key={option}
                type="button"
                data-testid={`set-width-${option}`}
                onClick={() => setWidth(option)}
              >
                {option}px
              </button>
            ))}
          </div>
        </div>
      </div>
    </PanelProvider>
  );
}
