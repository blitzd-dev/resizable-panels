import {
  Panel,
  type PanelApi,
  PanelGroup,
  type PanelGroupApi,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useRef, useState } from "react";

const pixels = (ref: React.RefObject<PanelApi | null>) => ({
  preferred: ref.current?.getSize(),
  rendered: ref.current?.getRenderedSize(),
});

function Rail({
  id,
  apiRef,
  side,
  defaultSize,
  minSize,
  collapsedSize,
}: {
  id: string;
  apiRef: React.RefObject<PanelApi | null>;
  side?: "start" | "end";
  defaultSize: number;
  minSize: number;
  collapsedSize: number;
}) {
  const common = {
    panelId: id,
    apiRef,
    defaultSize,
    minSize,
    maxSize: 300,
    collapsible: true as const,
    defaultCollapsed: true,
    collapsedSize,
  };
  return side ? <Panel {...common} side={side} /> : <Panel {...common} />;
}

export default function OverconstrainedRailsTest() {
  const params = new URLSearchParams(window.location.search);
  const orientation = params.has("vertical") ? "vertical" : "horizontal";
  const peerRails = params.has("peer");
  const [extent, setExtent] = useState(90);
  const groupRef = useRef<PanelGroupApi>(null);
  const startRef = useRef<PanelApi>(null);
  const contentRef = useRef<PanelApi>(null);
  const endRef = useRef<PanelApi>(null);

  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup
          apiRef={groupRef}
          orientation={orientation}
          persistence={{
            key: `overconstrained-rails-${orientation}${
              peerRails ? "-peer" : ""
            }`,
          }}
          data-testid="overconstrained-group"
          style={{
            width: orientation === "horizontal" ? extent : 300,
            height: orientation === "vertical" ? extent : 300,
          }}
        >
          <Rail
            id="start"
            apiRef={startRef}
            side={peerRails ? undefined : "start"}
            defaultSize={160}
            minSize={80}
            collapsedSize={80}
          />
          <PanelResizeHandle data-testid="start-handle" />
          <Panel
            panelId="content"
            apiRef={contentRef}
            defaultSize={100}
            minSize={30}
            maxSize={300}
          />
          <PanelResizeHandle data-testid="end-handle" />
          <Rail
            id="end"
            apiRef={endRef}
            side={peerRails ? undefined : "end"}
            defaultSize={120}
            minSize={40}
            collapsedSize={40}
          />
        </PanelGroup>
        <button
          type="button"
          data-testid="set-tiny"
          onClick={() => setExtent(90)}
        >
          Tiny
        </button>
        <button
          type="button"
          data-testid="set-roomy"
          onClick={() => setExtent(240)}
        >
          Roomy
        </button>
        <button
          type="button"
          data-testid="set-zero"
          onClick={() => setExtent(0)}
        >
          Zero
        </button>
        <button
          type="button"
          data-testid="read-overconstrained-state"
          onClick={(event) => {
            event.currentTarget.dataset.snapshot = JSON.stringify({
              layout: groupRef.current?.getValue(),
              start: pixels(startRef),
              content: pixels(contentRef),
              end: pixels(endRef),
            });
          }}
        >
          Read state
        </button>
      </div>
    </PanelProvider>
  );
}
