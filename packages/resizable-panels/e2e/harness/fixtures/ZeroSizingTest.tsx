import {
  Panel,
  type PanelApi,
  PanelGroup,
  type PanelGroupApi,
  PanelProvider,
  PanelResizeHandle,
  type PanelStorage,
} from "@blitzd/resizable-panels";
import { useMemo, useRef, useState } from "react";

export default function ZeroSizingTest() {
  const explicitZero = new URLSearchParams(window.location.search).has(
    "explicit-zero",
  );
  const groupRef = useRef<PanelGroupApi>(null);
  const firstRef = useRef<PanelApi>(null);
  const stateRef = useRef<HTMLDivElement>(null);
  const [automaticWidth, setAutomaticWidth] = useState(600);
  const storage = useMemo<PanelStorage>(
    () => ({
      getItem: () => null,
      setItem: (_key, value) => {
        if (stateRef.current) stateRef.current.dataset.storage = value;
      },
    }),
    [],
  );

  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup
          apiRef={groupRef}
          orientation="horizontal"
          persistence={{
            key: explicitZero ? "explicit-zero" : "automatic-reset",
            storage,
          }}
          style={{ width: explicitZero ? 100 : automaticWidth }}
          onValueChange={(value, details) => {
            if (!stateRef.current) return;
            stateRef.current.dataset.callback = JSON.stringify(value);
            stateRef.current.dataset.reason = details.reason;
          }}
        >
          <Panel
            apiRef={firstRef}
            panelId="first"
            defaultSize={explicitZero ? 0 : undefined}
            minSize={0}
            maxSize={explicitZero ? 100 : 600}
            collapsible={explicitZero}
            onSizeChange={(size) => {
              if (stateRef.current) {
                stateRef.current.dataset.resize = String(size);
              }
            }}
            onCollapsedChange={(collapsed) => {
              if (!stateRef.current) return;
              if (collapsed) stateRef.current.dataset.collapse = "true";
              else stateRef.current.dataset.expand = "true";
            }}
          >
            first
          </Panel>
          <PanelResizeHandle data-testid="zero-handle" />
          <Panel
            panelId="second"
            defaultSize={explicitZero ? 100 : undefined}
            minSize={0}
            maxSize={explicitZero ? 100 : 600}
          >
            second
          </Panel>
        </PanelGroup>
        <div className="toolbar-overlay">
          <div className="toolbar">
            <button
              type="button"
              data-testid="read-zero-layout"
              onClick={(event) => {
                event.currentTarget.dataset.layout = JSON.stringify(
                  groupRef.current?.getValue(),
                );
              }}
            >
              read
            </button>
            <button
              type="button"
              data-testid="resize-first"
              onClick={() => firstRef.current?.setSize(200)}
            >
              resize
            </button>
            <button
              type="button"
              data-testid="zero-first"
              onClick={() => firstRef.current?.setSize(0)}
            >
              zero
            </button>
            <button
              type="button"
              data-testid="grow-zero-container"
              onClick={() => setAutomaticWidth(700)}
            >
              grow container
            </button>
            <button
              type="button"
              data-testid="reset-zero-layout"
              onClick={() => groupRef.current?.resetValue()}
            >
              reset
            </button>
            <button
              type="button"
              data-testid="collapse-zero"
              onClick={() => firstRef.current?.collapse()}
            >
              collapse
            </button>
            <button
              type="button"
              data-testid="expand-zero"
              onClick={() => firstRef.current?.expand()}
            >
              expand
            </button>
          </div>
        </div>
        <div
          ref={stateRef}
          data-testid="zero-state"
          data-storage=""
          data-callback=""
          data-reason=""
          data-resize=""
          data-collapse="false"
          data-expand="false"
        />
      </div>
    </PanelProvider>
  );
}
