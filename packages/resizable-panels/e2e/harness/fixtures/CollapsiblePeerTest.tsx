import {
  Panel,
  type PanelApi,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelControls,
} from "@blitzd/resizable-panels";
import { useRef } from "react";

function Controls({
  panelRef,
}: {
  panelRef: React.RefObject<PanelApi | null>;
}) {
  const controls = usePanelControls({
    groupId: "collapsible-peer",
    panelId: "peer-a",
  });
  return (
    <div className="toolbar-overlay">
      <div className="toolbar">
        <button
          type="button"
          data-testid="collapse-peer"
          onClick={() => panelRef.current?.collapse()}
        >
          collapse
        </button>
        <button
          type="button"
          data-testid="expand-peer"
          onClick={() => panelRef.current?.expand()}
        >
          expand
        </button>
        <button
          type="button"
          data-testid="resize-peer"
          onClick={() => panelRef.current?.setSize(360)}
        >
          resize
        </button>
        <button
          type="button"
          data-testid="maximize-peer"
          onClick={() => panelRef.current?.maximize()}
        >
          maximize
        </button>
        <span
          data-testid="peer-state"
          data-collapsed={String(controls?.collapsed ?? false)}
          data-preferred={String(Math.round(controls?.size ?? 0))}
          data-rendered={String(Math.round(controls?.renderedSize ?? 0))}
        />
      </div>
    </div>
  );
}

export default function CollapsiblePeerTest() {
  const cascade = new URLSearchParams(window.location.search).has("cascade");
  const panelRef = useRef<PanelApi>(null);
  const eventsRef = useRef<HTMLDivElement>(null);
  const countsRef = useRef({ resize: 0, collapse: 0, expand: 0 });
  const record = (key: keyof typeof countsRef.current) => {
    countsRef.current[key] += 1;
    if (eventsRef.current) {
      eventsRef.current.dataset[key] = String(countsRef.current[key]);
    }
  };

  return (
    <PanelProvider>
      <div className="fixture-root">
        {cascade ? (
          <PanelGroup orientation="horizontal">
            <Panel
              panelId="cascade-a"
              defaultSize={300}
              minSize={100}
              maxSize={600}
            >
              cascade a
            </Panel>
            <PanelResizeHandle />
            <Panel
              panelId="cascade-b"
              defaultSize={300}
              minSize={100}
              collapsible
              defaultCollapsed
              collapsedSize={40}
            >
              cascade b
            </Panel>
            <PanelResizeHandle />
            <Panel
              panelId="cascade-c"
              defaultSize={300}
              minSize={100}
              maxSize={400}
            >
              cascade c
            </Panel>
            <PanelResizeHandle data-testid="cascade-handle" />
            <Panel panelId="cascade-d" defaultSize={300} minSize={100}>
              cascade d
            </Panel>
          </PanelGroup>
        ) : (
          <PanelGroup
            orientation="horizontal"
            groupId="collapsible-peer"
            persistence={{ key: "collapsible-peer" }}
          >
            <Panel
              apiRef={panelRef}
              panelId="peer-a"
              defaultSize={300}
              minSize={150}
              maxSize={600}
              collapsible
              collapsedSize={40}
              collapseBelow={80}
              onSizeChange={() => record("resize")}
              onCollapsedChange={(collapsed) =>
                record(collapsed ? "collapse" : "expand")
              }
            >
              peer a
            </Panel>
            <PanelResizeHandle
              data-testid="peer-handle"
              keyboardStep={10}
              keyboardStepFine={2}
              keyboardStepCoarse={40}
              hitAreaMargins={{ fine: 6, coarse: 18 }}
            />
            <Panel panelId="peer-b" minSize={100}>
              peer b
            </Panel>
          </PanelGroup>
        )}
        <Controls panelRef={panelRef} />
        <div
          ref={eventsRef}
          data-testid="peer-events"
          data-resize="0"
          data-collapse="0"
          data-expand="0"
        />
      </div>
    </PanelProvider>
  );
}
