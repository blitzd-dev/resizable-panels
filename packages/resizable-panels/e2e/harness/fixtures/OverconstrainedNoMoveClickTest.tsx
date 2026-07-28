import {
  Panel,
  type PanelApi,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useRef, useState } from "react";

/**
 * Regression fixture for R-02: an over-constrained group (docked preferred
 * sizes + the peer floor exceed the container) where both dockeds render
 * below their preferred size. The spec presses and releases a seam without
 * moving the pointer and asserts the documented §4 contract: "Pointer
 * down/up without movement emits lifecycle only" — no `onValueChange`, and
 * preferred sizes survive untouched (proven by growing the container).
 */

const PREFERRED = 300;
const NARROW = 520; // 300 + 300 preferred + 80 peer floor > 520 → over-constrained
const ROOMY = 900; // 300 + 300 preferred + 80 peer floor < 900 → preferences express

const pixels = (ref: React.RefObject<PanelApi | null>) => ({
  preferred: ref.current?.getSize(),
  rendered: ref.current?.getRenderedSize(),
});

export default function OverconstrainedNoMoveClickTest() {
  const [extent, setExtent] = useState(NARROW);
  const leftRef = useRef<PanelApi>(null);
  const rightRef = useRef<PanelApi>(null);
  const eventsRef = useRef<HTMLOutputElement>(null);
  const countsRef = useRef({ start: 0, end: 0, value: 0 });
  const record = (phase: "start" | "end" | "value") => {
    countsRef.current[phase] += 1;
    const output = eventsRef.current;
    if (output) output.dataset[phase] = String(countsRef.current[phase]);
  };

  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup
          orientation="horizontal"
          data-testid="no-move-click-group"
          style={{ width: extent, height: 300 }}
          onResizeStart={() => record("start")}
          onResizeEnd={() => record("end")}
          onValueChange={(_value, details) => {
            record("value");
            const output = eventsRef.current;
            if (output) {
              output.dataset.lastValueReason = details.reason;
              output.dataset.lastValueTrigger = details.trigger;
            }
          }}
        >
          <Panel
            panelId="left"
            side="start"
            apiRef={leftRef}
            defaultSize={PREFERRED}
            minSize={150}
          >
            left
          </Panel>
          <PanelResizeHandle handleId="left-seam" data-testid="left-seam" />
          <Panel panelId="content" minSize={80}>
            content
          </Panel>
          <PanelResizeHandle handleId="right-seam" data-testid="right-seam" />
          <Panel
            panelId="right"
            side="end"
            apiRef={rightRef}
            defaultSize={PREFERRED}
            minSize={150}
          >
            right
          </Panel>
        </PanelGroup>
        <button
          type="button"
          data-testid="set-narrow"
          onClick={() => setExtent(NARROW)}
        >
          Narrow
        </button>
        <button
          type="button"
          data-testid="set-roomy"
          onClick={() => setExtent(ROOMY)}
        >
          Roomy
        </button>
        <button
          type="button"
          data-testid="read-no-move-click-state"
          onClick={(event) => {
            event.currentTarget.dataset.snapshot = JSON.stringify({
              left: pixels(leftRef),
              right: pixels(rightRef),
            });
          }}
        >
          Read state
        </button>
        <output
          ref={eventsRef}
          data-testid="no-move-click-events"
          data-start="0"
          data-end="0"
          data-value="0"
          data-last-value-reason=""
          data-last-value-trigger=""
        />
      </div>
    </PanelProvider>
  );
}
