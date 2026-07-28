import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { Fragment, memo, Profiler, useState } from "react";

declare global {
  interface Window {
    __largeLayoutMetrics?: {
      handleCommits: number;
      mutationObservers?: number;
      resizeObserveCalls?: number;
      resizeObservers?: number;
    };
    __resizablePanelsHandleStateMetrics?: {
      publications: number;
      childScans: number;
      handleComputations: number;
      boundaryTraversals: number;
    };
  }
}

const InstrumentedHandle = memo(function InstrumentedHandle({
  index,
}: {
  index: number;
}) {
  return (
    <Profiler
      id={`handle-${index}`}
      onRender={() => {
        if (!window.__largeLayoutMetrics) {
          window.__largeLayoutMetrics = { handleCommits: 0 };
        }
        const metrics = window.__largeLayoutMetrics;
        metrics.handleCommits += 1;
      }}
    >
      <PanelResizeHandle data-testid={`large-handle-${index}`} />
    </Profiler>
  );
});

export default function LargeLayoutInstrumentationTest() {
  const params = new URLSearchParams(window.location.search);
  const initialCount = Number(params.get("panels")) === 100 ? 100 : 50;
  const initialPanelIds = Array.from(
    { length: initialCount },
    (_, index) => `large-panel-${index}`,
  );
  const [panelIds, setPanelIds] = useState(initialPanelIds);

  return (
    <PanelProvider>
      <div className="fixture-root">
        <button
          type="button"
          data-testid="large-toggle-topology"
          onClick={() =>
            setPanelIds((ids) =>
              ids.length === initialCount
                ? [...ids, `large-panel-${initialCount}`]
                : initialPanelIds,
            )
          }
        >
          toggle topology
        </button>
        <PanelGroup orientation="horizontal" data-testid="large-group">
          {panelIds.map((panelId, index) => (
            <Fragment key={panelId}>
              {index > 0 ? <InstrumentedHandle index={index - 1} /> : null}
              <Panel panelId={panelId} minSize={0}>
                <span>{index}</span>
              </Panel>
            </Fragment>
          ))}
        </PanelGroup>
      </div>
    </PanelProvider>
  );
}
