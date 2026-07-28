import {
  Panel,
  PanelGroup,
  type PanelGroupApi,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useRef } from "react";

export default function ContentBoxMeasurementTest() {
  const orientation = new URLSearchParams(window.location.search).has(
    "vertical",
  )
    ? "vertical"
    : "horizontal";
  const groupRef = useRef<PanelGroupApi>(null);

  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup
          apiRef={groupRef}
          orientation={orientation}
          persistence={{ key: `content-box-${orientation}` }}
          data-testid="content-box-group"
          style={{
            boxSizing: "border-box",
            width: 600,
            height: 400,
            padding: "29px 37px 43px 23px",
            borderStyle: "solid",
            borderWidth: "11px 13px 17px 7px",
          }}
        >
          <Panel panelId="first" defaultSize="50%" minSize={0}>
            first
          </Panel>
          <PanelResizeHandle data-testid="content-box-handle" />
          <Panel panelId="second" defaultSize="50%" minSize={0}>
            second
          </Panel>
        </PanelGroup>
        <button
          type="button"
          data-testid="read-content-box-layout"
          onClick={(event) => {
            event.currentTarget.dataset.layout = JSON.stringify(
              groupRef.current?.getValue(),
            );
          }}
        >
          Read layout
        </button>
        <button
          type="button"
          data-testid="reset-content-box-layout"
          onClick={() => groupRef.current?.resetValue()}
        >
          Reset layout
        </button>
      </div>
    </PanelProvider>
  );
}
