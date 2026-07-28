import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useRef } from "react";

const fmt = (value: { size: number } | undefined) =>
  value === undefined ? "?" : String(Math.round(value.size));

/**
 * `cascade="latching"` harness (R-25). Three peers so a push through the
 * middle panel cascades into the far one:
 *
 * - default: a 150 (min 100) | b 100 (min 20) | c auto — dragging the b|c
 *   seam left shrinks b to its min then cascades into a; reversing while
 *   held must regrow b first and leave a at its pushed size.
 * - `?collapsible`: far 120 (min 60) | col 200 (collapseBelow 120,
 *   hysteresis 24, rail 8) | main auto — the col|main seam drives col
 *   through its threshold, cascades into far, and the reversal must reopen
 *   col from the rebased geometry while far stays pushed.
 * - `?rtl`: the default layout under dir="rtl" — the latch must be
 *   direction-correct against the visually mirrored axis.
 */
export default function CascadeLatchingTest() {
  const lifecycleRef = useRef<HTMLOutputElement>(null);
  const params = new URLSearchParams(window.location.search);
  const rtl = params.has("rtl");
  const collapsible = params.has("collapsible");
  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup
          groupId="cascade-latching"
          orientation="horizontal"
          cascade="latching"
          dir={rtl ? "rtl" : "ltr"}
          style={{ width: 600 }}
          onResizeStart={(event) => {
            const out = lifecycleRef.current;
            if (!out) return;
            out.dataset.startHandle = event.handleId ?? "";
            out.dataset.startValue = Object.entries(event.value)
              .map(([id, value]) => `${id}:${fmt(value)}`)
              .join(" ");
          }}
          onResizeEnd={(event) => {
            const out = lifecycleRef.current;
            if (!out) return;
            out.dataset.endHandle = event.handleId ?? "";
            out.dataset.endInitial = Object.entries(event.initialValue)
              .map(([id, value]) => `${id}:${fmt(value)}`)
              .join(" ");
            out.dataset.endCanceled = String(event.canceled);
          }}
        >
          {collapsible ? (
            <>
              <Panel panelId="far" defaultSize={120} minSize={60}>
                far
              </Panel>
              <PanelResizeHandle handleId="h1" data-testid="far-col-handle" />
              <Panel
                panelId="col"
                defaultSize={200}
                minSize={180}
                collapsible
                collapseBelow={120}
                collapseBelowHysteresis={24}
                collapsedSize={8}
                resizableWhenCollapsed
              >
                col
              </Panel>
              <PanelResizeHandle handleId="h2" data-testid="col-main-handle" />
              <Panel panelId="main" minSize={50}>
                main
              </Panel>
            </>
          ) : (
            <>
              <Panel panelId="a" defaultSize={150} minSize={100}>
                a
              </Panel>
              <PanelResizeHandle handleId="h1" data-testid="a-b-handle" />
              <Panel panelId="b" defaultSize={100} minSize={20}>
                b
              </Panel>
              <PanelResizeHandle handleId="h2" data-testid="b-c-handle" />
              <Panel panelId="c" minSize={50}>
                c
              </Panel>
            </>
          )}
        </PanelGroup>
        <output ref={lifecycleRef} data-testid="latching-lifecycle" />
      </div>
    </PanelProvider>
  );
}
