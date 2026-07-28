import type { PanelGroupValue } from "@blitzd/resizable-panels";
import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { DemoPanel } from "@/components/demo-panel";

// A PanelGroupValue: sizes in pixels, plus a collapsed bit where a panel can
// collapse. Keyed by panelId; key order is irrelevant — the children below own
// the visual order.
const seed: PanelGroupValue = {
  main: { size: 320 },
  sidebar: { size: 200, collapsed: false },
};

export default function UncontrolledDefault() {
  return (
    <PanelGroup orientation="horizontal" defaultValue={seed}>
      <Panel panelId="sidebar" collapsible minSize={120}>
        <DemoPanel label="sidebar" />
      </Panel>
      <PanelResizeHandle />
      <Panel panelId="main" minSize={120}>
        <DemoPanel label="main" muted />
      </Panel>
    </PanelGroup>
  );
}
