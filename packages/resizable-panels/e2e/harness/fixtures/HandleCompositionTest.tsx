import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useRef } from "react";

/**
 * §5 handle event composition harness. The resize handle receives consumer
 * interaction handlers that count invocations (written imperatively to a DOM
 * node so render stays pure and StrictMode can't inflate them). Query params
 * opt into consumer interference:
 *
 * - `?prevent=pointerdown|keydown|dblclick` — the consumer handler calls
 *   `event.preventDefault()`. These are the cancellable events: prevention
 *   must stop the library behavior (no drag session / no keyboard resize /
 *   no double-click reset).
 * - `?throw=pointerup` — the consumer onPointerUp throws. These are required
 *   terminal events: internal handling and cleanup must still run (a
 *   following drag works) and the consumer exception rethrows after cleanup.
 */
export default function HandleCompositionTest() {
  const params = new URLSearchParams(window.location.search);
  const prevent = new Set((params.get("prevent") ?? "").split(","));
  const throwOnPointerUp = params.get("throw") === "pointerup";
  const eventsRef = useRef<HTMLDivElement>(null);

  const count = (key: string) => {
    const el = eventsRef.current;
    if (!el) return;
    el.dataset[key] = String(Number(el.dataset[key] ?? "0") + 1);
  };

  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup orientation="horizontal" groupId="handle-composition">
          <Panel
            panelId="left"
            side="start"
            defaultSize={300}
            minSize={100}
            maxSize={500}
          >
            left
          </Panel>
          <PanelResizeHandle
            data-testid="composed-handle"
            onPointerDown={(event) => {
              count("pointerdown");
              if (prevent.has("pointerdown")) event.preventDefault();
            }}
            onPointerMove={() => count("pointermove")}
            onPointerUp={() => {
              count("pointerup");
              if (throwOnPointerUp) {
                throw new Error("consumer onPointerUp failure");
              }
            }}
            onPointerCancel={() => count("pointercancel")}
            onLostPointerCapture={() => count("lostpointercapture")}
            onKeyDown={(event) => {
              count("keydown");
              if (prevent.has("keydown")) event.preventDefault();
            }}
            onDoubleClick={(event) => {
              count("dblclick");
              if (prevent.has("dblclick")) event.preventDefault();
            }}
            onClick={() => count("click")}
          />
          <Panel panelId="main" minSize={100}>
            main
          </Panel>
        </PanelGroup>
        <div
          ref={eventsRef}
          data-testid="handle-events"
          data-pointerdown="0"
          data-pointermove="0"
          data-pointerup="0"
          data-pointercancel="0"
          data-lostpointercapture="0"
          data-keydown="0"
          data-dblclick="0"
          data-click="0"
        />
      </div>
    </PanelProvider>
  );
}
