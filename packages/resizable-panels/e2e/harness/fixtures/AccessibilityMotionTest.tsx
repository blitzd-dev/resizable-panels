import {
  Panel,
  type PanelApi,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelActions,
} from "@blitzd/resizable-panels";
import { useRef } from "react";

function MotionControls({
  dockedRef,
  peerRef,
}: {
  dockedRef: React.RefObject<PanelApi | null>;
  peerRef: React.RefObject<PanelApi | null>;
}) {
  const actions = usePanelActions();
  return (
    <div className="toolbar-overlay">
      <div className="toolbar">
        <button type="button" onClick={() => dockedRef.current?.collapse()}>
          collapse docked
        </button>
        <button type="button" onClick={() => dockedRef.current?.expand()}>
          expand docked
        </button>
        <button type="button" onClick={() => peerRef.current?.collapse()}>
          collapse peer
        </button>
        <button type="button" onClick={() => peerRef.current?.expand()}>
          expand peer
        </button>
        <button
          type="button"
          onClick={() =>
            actions.collapse(
              { groupId: "motion", panelId: "motion-docked" },
              { transition: "none" },
            )
          }
        >
          collapse docked immediately
        </button>
      </div>
    </div>
  );
}

export default function AccessibilityMotionTest() {
  const dockedRef = useRef<PanelApi>(null);
  const peerRef = useRef<PanelApi>(null);

  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup orientation="horizontal" groupId="motion">
          <Panel
            panelId="motion-docked"
            apiRef={dockedRef}
            side="start"
            defaultSize={240}
            minSize={120}
          >
            <button type="button" data-testid="docked-action">
              docked action
            </button>
          </Panel>
          <PanelResizeHandle data-testid="motion-docked-handle" />
          <Panel
            panelId="motion-peer"
            apiRef={peerRef}
            defaultSize={280}
            minSize={120}
            collapsible
            collapseBelow={80}
          >
            <button type="button" data-testid="peer-action">
              peer action
            </button>
          </Panel>
          <PanelResizeHandle data-testid="motion-peer-handle" />
          <Panel panelId="motion-main" minSize={120}>
            main
          </Panel>
        </PanelGroup>
        <MotionControls dockedRef={dockedRef} peerRef={peerRef} />
      </div>
    </PanelProvider>
  );
}
