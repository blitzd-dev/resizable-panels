import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { MiniDemoFrame, MiniPanel } from "@/components/showcase/mini-demo";
import { MiniDemoCard } from "./card";

export function PixelSizingDemo() {
  return (
    <MiniDemoCard
      slug="pixel-sizing"
      title="Pixel sizing"
      caption="One sized side panel, one grow filler — the numbers are pixels."
      docsSlug="sizing"
      code={`<PanelGroup orientation="horizontal">
  <Panel side="start" defaultSize={180} minSize={120} maxSize={260}>
    left
  </Panel>
  <Panel>main</Panel>
</PanelGroup>`}
    >
      <MiniDemoFrame
        panels={[
          { groupId: "pixel-sizing", panelId: "basic-left", label: "left" },
        ]}
      >
        <PanelGroup groupId="pixel-sizing" orientation="horizontal">
          <Panel
            panelId="basic-left"
            side="start"
            defaultSize={180}
            minSize={120}
            maxSize={260}
          >
            <MiniPanel
              groupId="pixel-sizing"
              panelId="basic-left"
              label="left"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel>
            <MiniPanel label="main" />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}

export function PercentDemo() {
  return (
    <MiniDemoCard
      slug="percentage-bounds"
      title="Percentage bounds"
      caption="String specs resolve against the group — both panels stay between 10% and 50% as you drag or resize the window."
      docsSlug="sizing"
      code={`<PanelGroup orientation="horizontal">
  <Panel side="start" defaultSize="33%" minSize="10%" maxSize="50%">
    left
  </Panel>
  <Panel>middle</Panel>
  <Panel side="end" defaultSize="33%" minSize="10%" maxSize="50%">
    right
  </Panel>
</PanelGroup>`}
    >
      <MiniDemoFrame
        panels={[
          {
            groupId: "percentage-bounds",
            panelId: "mini-pct-left",
            label: "left",
          },
          {
            groupId: "percentage-bounds",
            panelId: "mini-pct-right",
            label: "right",
          },
        ]}
      >
        <PanelGroup groupId="percentage-bounds" orientation="horizontal">
          <Panel
            panelId="mini-pct-left"
            side="start"
            defaultSize="33%"
            minSize="10%"
            maxSize="50%"
          >
            <MiniPanel
              groupId="percentage-bounds"
              panelId="mini-pct-left"
              label="left"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel>
            <MiniPanel label="middle" />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="mini-pct-right"
            side="end"
            defaultSize="33%"
            minSize="10%"
            maxSize="50%"
          >
            <MiniPanel
              groupId="percentage-bounds"
              panelId="mini-pct-right"
              label="right"
            />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}

export function CalcDemo() {
  return (
    <MiniDemoCard
      slug="calc-mixed"
      title="calc() & mixed units"
      caption="calc() composes any units — a percentage layout with a fixed pixel gutter or floor."
      docsSlug="sizing"
      code={`<Panel
  side="start"
  defaultSize="calc(50% - 24px)"
  minSize="calc(33% + 0px)"
  maxSize="80%"
>
  left
</Panel>`}
    >
      <MiniDemoFrame
        panels={[
          { groupId: "calc-mixed", panelId: "mini-calc", label: "left" },
        ]}
      >
        <PanelGroup groupId="calc-mixed" orientation="horizontal">
          <Panel
            panelId="mini-calc"
            side="start"
            defaultSize="calc(50% - 24px)"
            minSize="calc(33% + 0px)"
            maxSize="80%"
          >
            <MiniPanel groupId="calc-mixed" panelId="mini-calc" label="left" />
          </Panel>
          <PanelResizeHandle />
          <Panel>
            <MiniPanel label="right" />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}

export function MixedUnitsDemo() {
  return (
    <MiniDemoCard
      slug="mixed-units"
      title="Mixed units in one layout"
      caption="px, %, em, and calc() in one group — each re-resolves against its own reference as you drag, resize, and zoom."
      docsSlug="sizing"
      code={`<PanelGroup orientation="horizontal">
  <Panel id="nav"  side="start" defaultSize={200}  minSize={140}    maxSize={320}>
    nav (px)
  </Panel>
  <Panel id="list" side="start" defaultSize="22%"  minSize="12%"    maxSize="40%">
    list (%)
  </Panel>
  <Panel minSize="calc(15% + 1rem)">main</Panel>
  <Panel id="insp" side="end"   defaultSize="14em" minSize="10em"   maxSize="22em">
    inspector (em)
  </Panel>
</PanelGroup>`}
    >
      <MiniDemoFrame
        frameClassName="h-40"
        panels={[
          { groupId: "mixed-units", panelId: "mixed-nav", label: "nav" },
          { groupId: "mixed-units", panelId: "mixed-list", label: "list" },
          { groupId: "mixed-units", panelId: "mixed-insp", label: "inspector" },
        ]}
      >
        <PanelGroup groupId="mixed-units" orientation="horizontal">
          <Panel
            panelId="mixed-nav"
            side="start"
            defaultSize={200}
            minSize={140}
            maxSize={320}
          >
            <MiniPanel
              groupId="mixed-units"
              panelId="mixed-nav"
              label="nav (px)"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="mixed-list"
            side="start"
            defaultSize="22%"
            minSize="12%"
            maxSize="40%"
          >
            <MiniPanel
              groupId="mixed-units"
              panelId="mixed-list"
              label="list (%)"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel minSize="calc(15% + 1rem)">
            <MiniPanel label="main" />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="mixed-insp"
            side="end"
            defaultSize="14em"
            minSize="10em"
            maxSize="22em"
          >
            <MiniPanel
              groupId="mixed-units"
              panelId="mixed-insp"
              label="inspector (em)"
            />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}
