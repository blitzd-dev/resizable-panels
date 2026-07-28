import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { Fragment, useState } from "react";

function OrderProbe() {
  return (
    <button
      type="button"
      data-testid="order-probe"
      style={{ position: "fixed", left: -10000 }}
      onClick={(event) => {
        event.currentTarget.dataset.order = Array.from(
          document.querySelectorAll(
            "[data-resizable-panels-panel-group] > [data-resizable-panels-panel-id]",
          ),
        )
          .map((entry) => entry.getAttribute("data-resizable-panels-panel-id"))
          .join(",");
      }}
    />
  );
}

export default function DynamicOrderTest() {
  const [ids, setIds] = useState(["a", "c"]);

  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup orientation="horizontal">
          {ids.map((id, index) => (
            <Fragment key={id}>
              <Panel panelId={id} minSize={100}>
                <div className="panel-body">{id}</div>
              </Panel>
              {index < ids.length - 1 && <PanelResizeHandle />}
            </Fragment>
          ))}
          <OrderProbe />
        </PanelGroup>
        <div className="toolbar-overlay">
          <div className="toolbar">
            <button
              type="button"
              data-testid="insert-b"
              onClick={() => setIds(["a", "b", "c"])}
            >
              insert b
            </button>
            <button
              type="button"
              data-testid="reorder"
              onClick={() => setIds(["c", "a", "b"])}
            >
              reorder
            </button>
            <button
              type="button"
              data-testid="remove-b"
              onClick={() =>
                setIds((current) => current.filter((id) => id !== "b"))
              }
            >
              remove b
            </button>
          </div>
        </div>
      </div>
    </PanelProvider>
  );
}
