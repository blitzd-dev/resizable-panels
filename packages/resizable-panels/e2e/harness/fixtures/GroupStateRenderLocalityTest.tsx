import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelActions,
  usePanelGroupState,
} from "@blitzd/resizable-panels";
import { memo, Profiler, useRef } from "react";

/**
 * Render-locality fixture (R-36). A parent-level `usePanelGroupState`
 * consumer and a dispatch-only `usePanelActions` consumer sit beside a group
 * that fits comfortably at the test viewport, so a seam drag redistributes
 * peer sizes without changing containerSize / overconstrainedBy /
 * unallocatedPx. Each consumer is Profiler-wrapped with its own window
 * counter (same convention as LargeLayoutInstrumentationTest) so the spec can
 * assert an unchanged snapshot yields zero re-renders during a drag tick and
 * an idle frame.
 */
declare global {
  interface Window {
    __groupStateLocality?: {
      groupStateCommits: number;
      actionsCommits: number;
    };
  }
}

function bump(key: "groupStateCommits" | "actionsCommits") {
  if (!window.__groupStateLocality) {
    window.__groupStateLocality = { groupStateCommits: 0, actionsCommits: 0 };
  }
  window.__groupStateLocality[key] += 1;
}

const GroupStateConsumer = memo(function GroupStateConsumer() {
  const state = usePanelGroupState("locality");
  return (
    <Profiler
      id="group-state-consumer"
      onRender={() => bump("groupStateCommits")}
    >
      <div
        data-testid="locality-group-state"
        data-container-size={
          state ? String(Math.round(state.containerSize)) : ""
        }
      />
    </Profiler>
  );
});

const ActionsConsumer = memo(function ActionsConsumer() {
  const actions = usePanelActions();
  return (
    <Profiler id="actions-consumer" onRender={() => bump("actionsCommits")}>
      <div
        data-testid="locality-actions"
        data-has-actions={String(!!actions)}
      />
    </Profiler>
  );
});

export default function GroupStateRenderLocalityTest() {
  // Keep a stable root: nothing here re-renders during a drag, so any consumer
  // commit must originate from its own store snapshot changing.
  const rootRef = useRef<HTMLDivElement>(null);
  return (
    <PanelProvider>
      <div ref={rootRef} className="fixture-root">
        <GroupStateConsumer />
        <ActionsConsumer />
        <PanelGroup
          orientation="horizontal"
          groupId="locality"
          data-testid="locality-group"
          style={{ width: 900, height: 300 }}
        >
          <Panel panelId="a" defaultSize={300} minSize={80}>
            a
          </Panel>
          <PanelResizeHandle data-testid="locality-handle" />
          <Panel panelId="b" minSize={80}>
            b
          </Panel>
        </PanelGroup>
      </div>
    </PanelProvider>
  );
}
