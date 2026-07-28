import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelCollapsed,
} from "@blitzd/resizable-panels";
import { useRef, useState } from "react";
import { PanelBody } from "./shared";

const SIDE = { groupId: "controlled-collapsed", panelId: "side" } as const;

/**
 * R-33 harness: a controlled sidebar. Parent React state owns `collapsed`;
 * `onCollapsedChange` is the proposal channel. The mode toggle decides
 * whether the parent ACCEPTS proposals (re-renders with the proposed value)
 * or DECLINES them (ignores the proposal — the prop stays authoritative,
 * and a drag past collapseBelow must snap back at release).
 *
 * Readouts the spec keys on:
 * - `proposal-log`: `<count>:<value>/<reason>/<trigger>` of the last
 *   proposal (`0:none` before any).
 * - `effective`: the EFFECTIVE state from usePanelCollapsed — must report
 *   the prop even while a gesture presents a threshold crossing.
 * - `parent-state`: the parent's own state variable.
 */
function EffectiveReadout() {
  const collapsed = usePanelCollapsed(SIDE);
  return (
    <span data-testid="effective" className="readout">
      {collapsed ? "collapsed" : "expanded"}
    </span>
  );
}

export default function ControlledCollapsedTest() {
  const [collapsed, setCollapsed] = useState(false);
  const [accept, setAccept] = useState(false);
  const acceptRef = useRef(accept);
  acceptRef.current = accept;
  const [proposals, setProposals] = useState<string[]>([]);
  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup orientation="horizontal" groupId="controlled-collapsed">
          <Panel
            id="side"
            panelId="side"
            side="start"
            defaultSize={220}
            minSize={140}
            maxSize={320}
            collapsedSize={0}
            collapseBelow={60}
            collapsed={collapsed}
            onCollapsedChange={(next, details) => {
              setProposals((prev) => [
                ...prev,
                `${next ? "collapse" : "expand"}/${details.reason}/${details.trigger}`,
              ]);
              if (acceptRef.current) setCollapsed(next);
            }}
            className="panel-surface"
          >
            <PanelBody groupId="controlled-collapsed" label="side" />
          </Panel>
          <PanelResizeHandle data-testid="controlled-handle" />
          <Panel>
            <PanelBody
              groupId="controlled-collapsed"
              label="main"
              variant="grow"
            />
          </Panel>
        </PanelGroup>
        <div className="toolbar-overlay">
          <div className="toolbar">
            <button
              type="button"
              className="toolbar-toggle"
              data-testid="external-toggle"
              aria-pressed={!collapsed}
              onClick={() => setCollapsed((current) => !current)}
            >
              {collapsed ? "Expand" : "Collapse"} side (parent state)
            </button>
            <button
              type="button"
              className="toolbar-toggle"
              data-testid="mode-toggle"
              aria-pressed={accept}
              onClick={() => setAccept((current) => !current)}
            >
              mode: {accept ? "accept" : "decline"}
            </button>
            <span data-testid="proposal-log" className="readout">
              {proposals.length}:{proposals.at(-1) ?? "none"}
            </span>
            <EffectiveReadout />
            <span data-testid="parent-state" className="readout">
              parent {collapsed ? "collapsed" : "expanded"}
            </span>
          </div>
        </div>
      </div>
    </PanelProvider>
  );
}
