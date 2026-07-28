import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { Fragment } from "react";
import { PanelBody } from "./shared";

/**
 * Four peers with `minSize="10%"`, no dockeds. Exercises the peer-to-peer
 * explicit seam handle code path between adjacent peers.
 */
export default function MultiPeerTest() {
  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup orientation="horizontal" groupId="multi-peer">
          {(["a", "b", "c", "d"] as const).map((id, index, ids) => (
            <Fragment key={id}>
              <Panel panelId={id} minSize="10%" className="panel-surface">
                <PanelBody groupId="multi-peer" label={id} uppercase />
              </Panel>
              {index < ids.length - 1 && <PanelResizeHandle />}
            </Fragment>
          ))}
        </PanelGroup>
      </div>
    </PanelProvider>
  );
}
