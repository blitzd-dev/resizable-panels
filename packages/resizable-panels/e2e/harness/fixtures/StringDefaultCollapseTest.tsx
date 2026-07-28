import {
  Panel,
  type PanelApi,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useRef, useState } from "react";

/**
 * Regression fixture for R-32 (an R-05 follow-up): collapsing a docked panel
 * whose string `defaultSize` ("30%") is still UNINITIALIZED (live-tracking,
 * never dragged) must not re-resolve the raw string against the panel's own
 * shrinking box. The panel content's containing block is the panel, not the
 * group — while collapsed or animating, content must hold the frozen
 * expanded reference in pixels.
 *
 * Two groups:
 * - "dock" starts expanded; the spec toggles it via the imperative API and
 *   samples content geometry mid-animation.
 * - "boot" mounts `defaultCollapsed` — the panel has NEVER been expanded, so
 *   there is no frozen pre-collapse width; its would-be expanded width is
 *   the live-resolved default.
 *
 * Width buttons let the spec prove the R-05 contract survives the fix: a
 * collapse/expand toggle is not an "interaction" and must not commit pixels.
 */

const WIDTHS = [600, 800, 1000] as const;

export default function StringDefaultCollapseTest() {
  const dockRef = useRef<PanelApi>(null);
  const bootRef = useRef<PanelApi>(null);
  const [width, setWidth] = useState<number>(800);

  return (
    <PanelProvider>
      <div className="fixture-root">
        <div className="toolbar-overlay">
          <div className="toolbar">
            <button
              type="button"
              data-testid="collapse-dock"
              onClick={() => dockRef.current?.collapse()}
            >
              collapse dock
            </button>
            <button
              type="button"
              data-testid="expand-dock"
              onClick={() => dockRef.current?.expand()}
            >
              expand dock
            </button>
            <button
              type="button"
              data-testid="expand-boot"
              onClick={() => bootRef.current?.expand()}
            >
              expand boot
            </button>
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
        <div data-testid="collapse-container" style={{ width, height: 220 }}>
          <PanelGroup orientation="horizontal" groupId="string-collapse">
            <Panel
              apiRef={dockRef}
              panelId="dock"
              side="start"
              defaultSize="30%"
              minSize={40}
            >
              <div className="panel-body">dock</div>
            </Panel>
            <PanelResizeHandle />
            <Panel panelId="main" minSize={40}>
              <div className="panel-body">main</div>
            </Panel>
          </PanelGroup>
        </div>
        <div data-testid="boot-container" style={{ width, height: 220 }}>
          <PanelGroup orientation="horizontal" groupId="string-collapse-boot">
            <Panel
              apiRef={bootRef}
              panelId="boot"
              side="start"
              defaultSize="30%"
              minSize={40}
              defaultCollapsed
            >
              <div className="panel-body">boot</div>
            </Panel>
            <PanelResizeHandle />
            <Panel panelId="boot-main" minSize={40}>
              <div className="panel-body">main</div>
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </PanelProvider>
  );
}
