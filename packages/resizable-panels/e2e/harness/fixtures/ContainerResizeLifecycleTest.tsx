import {
  Panel,
  PanelGroup,
  PanelProvider,
  usePanelInteractionState,
} from "@blitzd/resizable-panels";
import { useState } from "react";

function ResizeState() {
  const { isContainerResizing } = usePanelInteractionState();
  return (
    <output
      data-testid="container-resize-state"
      data-resizing={String(isContainerResizing)}
    />
  );
}

function Group({ id, width }: { id: string; width: number }) {
  return (
    <div data-testid={`container-${id}`} style={{ width, height: 240 }}>
      <PanelGroup orientation="horizontal">
        <Panel panelId={`${id}-left`} defaultSize="50%" minSize={40}>
          {id} left
        </Panel>
        <Panel panelId={`${id}-right`} defaultSize="50%" minSize={40}>
          {id} right
        </Panel>
      </PanelGroup>
    </div>
  );
}

export default function ContainerResizeLifecycleTest() {
  const [firstWidth, setFirstWidth] = useState(400);
  const [secondWidth, setSecondWidth] = useState(400);
  const [showFirst, setShowFirst] = useState(true);

  return (
    <PanelProvider>
      <div className="fixture-root">
        {showFirst ? <Group id="first" width={firstWidth} /> : null}
        <Group id="second" width={secondWidth} />
        <div className="toolbar-overlay">
          <div className="toolbar">
            <button
              type="button"
              data-testid="resize-first"
              onClick={() => setFirstWidth((width) => width + 40)}
            >
              resize first
            </button>
            <button
              type="button"
              data-testid="resize-second"
              onClick={() => setSecondWidth((width) => width + 40)}
            >
              resize second
            </button>
            <button
              type="button"
              data-testid="unmount-first"
              onClick={() => setShowFirst(false)}
            >
              unmount first
            </button>
          </div>
        </div>
        <ResizeState />
      </div>
    </PanelProvider>
  );
}
