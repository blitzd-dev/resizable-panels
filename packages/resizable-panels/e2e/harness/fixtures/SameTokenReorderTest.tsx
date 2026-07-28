import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { type ReactNode, useState } from "react";

const items: Record<string, ReactNode> = {
  a: (
    <Panel key="a" panelId="a" minSize={100}>
      a
    </Panel>
  ),
  b: (
    <Panel key="b" panelId="b" minSize={100}>
      b
    </Panel>
  ),
  c: (
    <Panel key="c" panelId="c" minSize={100}>
      c
    </Panel>
  ),
  h1: (
    <PanelResizeHandle
      key="h1"
      id="same-token-h1"
      data-testid="same-token-h1"
    />
  ),
  h2: (
    <PanelResizeHandle
      key="h2"
      id="same-token-h2"
      data-testid="same-token-h2"
    />
  ),
};

export default function SameTokenReorderTest() {
  const [order, setOrder] = useState(["a", "h1", "b", "h2", "c"]);
  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup orientation="horizontal">
          {order.map((key) => items[key])}
        </PanelGroup>
        <button
          type="button"
          data-testid="same-token-reorder"
          onClick={() => setOrder(["c", "h1", "a", "h2", "b"])}
        >
          reorder
        </button>
      </div>
    </PanelProvider>
  );
}
