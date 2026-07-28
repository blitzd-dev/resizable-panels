import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelInteractionState,
} from "@blitzd/resizable-panels";
import { useRef, useState } from "react";

function DraggingState() {
  const { isPointerDragging } = usePanelInteractionState();
  return (
    <output
      data-testid="resize-session-state"
      data-dragging={String(isPointerDragging)}
    />
  );
}

export default function ResizeSessionLifecycleTest() {
  const [showFirstHandle, setShowFirstHandle] = useState(true);
  const eventsRef = useRef<HTMLOutputElement>(null);
  const countsRef = useRef({ start: 0, update: 0, end: 0 });
  const record = (
    phase: "start" | "update" | "end",
    handleId: string | undefined,
  ) => {
    countsRef.current[phase] += 1;
    const output = eventsRef.current;
    if (!output) return;
    output.dataset[phase] = String(countsRef.current[phase]);
    output.dataset.lastHandle = handleId ?? "";
    output.dataset.lastPhase = phase;
  };
  const lifecycleProps = {
    onResizeStart: (event: { handleId?: string }) =>
      record("start", event.handleId),
    onResizeEnd: (event: { handleId?: string; canceled: boolean }) => {
      record("end", event.handleId);
      if (eventsRef.current) {
        eventsRef.current.dataset.lastCanceled = String(event.canceled);
      }
    },
    onValueChange: (
      _value: unknown,
      details: { trigger: string; handleId?: string },
    ) => {
      if (details.trigger !== "pointer") return;
      record("update", details.handleId);
    },
  };

  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup orientation="horizontal" {...lifecycleProps}>
          <Panel
            panelId="session-left"
            side="start"
            defaultSize={300}
            minSize={100}
            maxSize={500}
          >
            left
          </Panel>
          {showFirstHandle ? (
            <PanelResizeHandle
              handleId="session-handle-first"
              data-testid="session-handle-first"
            />
          ) : null}
          <Panel
            panelId="session-middle"
            side="start"
            defaultSize={300}
            minSize={100}
            maxSize={500}
          >
            middle
          </Panel>
          <PanelResizeHandle
            handleId="session-handle-second"
            data-testid="session-handle-second"
          />
          <Panel panelId="session-right" minSize={100}>
            right
          </Panel>
        </PanelGroup>
        <PanelGroup
          orientation="horizontal"
          {...lifecycleProps}
          style={{ position: "fixed", right: 20, bottom: 20, width: 400 }}
        >
          <Panel
            panelId="other-left"
            side="start"
            defaultSize={200}
            minSize={100}
            maxSize={300}
          >
            other left
          </Panel>
          <PanelResizeHandle
            handleId="session-handle-other-group"
            data-testid="session-handle-other-group"
          />
          <Panel panelId="other-right" minSize={100}>
            other right
          </Panel>
        </PanelGroup>
        <div className="toolbar-overlay">
          <div className="toolbar">
            <button
              type="button"
              data-testid="unmount-first-handle"
              onClick={() => setShowFirstHandle(false)}
            >
              unmount first handle
            </button>
          </div>
        </div>
        <DraggingState />
        <output
          ref={eventsRef}
          data-testid="resize-session-events"
          data-start="0"
          data-update="0"
          data-end="0"
          data-last-handle=""
          data-last-phase=""
          data-last-canceled=""
        />
      </div>
    </PanelProvider>
  );
}
