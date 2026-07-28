import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { Fragment, useRef } from "react";

export default function CoincidentHandlesTest() {
  const lifecycleRef = useRef<HTMLOutputElement>(null);
  const params = new URLSearchParams(window.location.search);
  const rtl = params.has("rtl");
  const panels = params.has("run")
    ? [
        { id: "a", size: 200 },
        { id: "b", size: 0 },
        { id: "c", size: 0 },
        { id: "d", size: 400 },
      ]
    : [
        { id: "a", size: 200 },
        { id: "b", size: 200 },
        { id: "c", size: 200 },
      ];
  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup
          groupId="coincident-handles"
          orientation="horizontal"
          dir={rtl ? "rtl" : "ltr"}
          style={{ width: 600 }}
          onResizeStart={(event) => {
            if (lifecycleRef.current) {
              lifecycleRef.current.dataset.startHandle = event.handleId ?? "";
            }
          }}
          onValueChange={(_value, details) => {
            if (details.trigger === "pointer" && lifecycleRef.current) {
              lifecycleRef.current.dataset.updateHandle =
                details.handleId ?? "";
            }
          }}
          onResizeEnd={(event) => {
            if (lifecycleRef.current) {
              lifecycleRef.current.dataset.endHandle = event.handleId ?? "";
            }
          }}
        >
          {panels.map(({ id, size }, index) => (
            <Fragment key={id}>
              <Panel panelId={id} defaultSize={size} minSize={0}>
                {id}
              </Panel>
              {index < panels.length - 1 && (
                <PanelResizeHandle
                  handleId={`${id}-${panels[index + 1].id}`}
                  data-testid={`${id}-${panels[index + 1].id}-handle`}
                />
              )}
            </Fragment>
          ))}
        </PanelGroup>
        <output ref={lifecycleRef} data-testid="coincident-lifecycle" />
      </div>
    </PanelProvider>
  );
}
