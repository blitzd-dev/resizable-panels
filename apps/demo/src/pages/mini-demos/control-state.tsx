import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type PanelStorage,
  usePanelControls,
} from "@blitzd/resizable-panels";
import { useMemo } from "react";
import {
  MiniDemoFrame,
  MiniPanel,
  ToggleButton,
} from "@/components/showcase/mini-demo";
import { Button } from "@/components/ui/button";
import { MiniDemoCard } from "./card";

function ImperativeToolbar() {
  const left = usePanelControls({ groupId: "imperative", panelId: "mini-imp" });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ToggleButton groupId="imperative" panelId="mini-imp" label="left" />
      <Button variant="secondary" size="xs" onClick={() => left?.setSize(100)}>
        setSize 100
      </Button>
      <Button variant="secondary" size="xs" onClick={() => left?.setSize(280)}>
        setSize 280
      </Button>
      <Button variant="secondary" size="xs" onClick={() => left?.maximize()}>
        maximize
      </Button>
      <span className="ml-auto font-mono text-[11px] text-muted-foreground">
        {Math.round(left?.size ?? 0)}px ·{" "}
        {left?.collapsed ? "collapsed" : "expanded"}
      </span>
    </div>
  );
}

export function ImperativeControlDemo() {
  return (
    <MiniDemoCard
      slug="imperative"
      title="usePanelLayout()"
      caption="Read or drive any panel from anywhere in the layout — set an exact size, maximize to its resolved maxSize, or toggle it from a sibling."
      docsSlug="imperative-and-actions"
      code={`function Toolbar() {
  const layout = usePanelLayout();
  const left = layout.panels["left"];
  return (
    <>
      <button onClick={() => layout.setSize("left", 280)}>
        set left to 280px ({Math.round(left?.size ?? 0)}px now)
      </button>
      <button onClick={() => layout.maximize("left")}>
        maximize left
      </button>
    </>
  );
}`}
    >
      <MiniDemoFrame
        toolbar={<ImperativeToolbar />}
        panels={[{ groupId: "imperative", panelId: "mini-imp", label: "left" }]}
      >
        <PanelGroup groupId="imperative" orientation="horizontal">
          <Panel
            panelId="mini-imp"
            side="start"
            defaultSize={160}
            minSize={80}
            maxSize={320}
          >
            <MiniPanel groupId="imperative" panelId="mini-imp" label="left" />
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

export function PersistenceDemo() {
  // Per-instance in-memory adapter so this demo doesn't fight other tabs
  // for localStorage and resets when you navigate away.
  const storage = useMemo<PanelStorage>(() => {
    const map = new Map<string, string>();
    return {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => {
        map.set(k, v);
      },
    };
  }, []);
  return (
    <MiniDemoCard
      slug="persistence"
      title="persistence"
      caption="Drag, close, and reopen — the group restores each panel's size and open state from any { getItem, setItem } adapter (in-memory here)."
      docsSlug="persistence"
      code={`<PanelGroup orientation="horizontal" persistence={{ key: "mini-demo/persist" }}>
  <Panel id="left"  side="start" defaultSize={180}>left</Panel>
  <Panel>main</Panel>
  <Panel id="right" side="end"   defaultSize={180}>right</Panel>
</PanelGroup>`}
    >
      <MiniDemoFrame
        panels={[
          {
            groupId: "persistence",
            panelId: "mini-persist-left",
            label: "left",
          },
          {
            groupId: "persistence",
            panelId: "mini-persist-right",
            label: "right",
          },
        ]}
      >
        <PanelGroup
          groupId="persistence"
          orientation="horizontal"
          persistence={{ key: "mini-demo/persist", storage }}
        >
          <Panel
            panelId="mini-persist-left"
            side="start"
            defaultSize={180}
            minSize={100}
            maxSize={260}
          >
            <MiniPanel
              groupId="persistence"
              panelId="mini-persist-left"
              label="left"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel>
            <MiniPanel label="main" />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="mini-persist-right"
            side="end"
            defaultSize={180}
            minSize={100}
            maxSize={260}
          >
            <MiniPanel
              groupId="persistence"
              panelId="mini-persist-right"
              label="right"
            />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}

export function NoIdDemo() {
  return (
    <MiniDemoCard
      slug="no-id"
      title="No id (uncontrolled)"
      caption="An id is only for imperative control or persistence — without one the panel still drags and animates, it just won't appear in usePanelLayout().panels."
      docsSlug="imperative-and-actions"
      code={`<Panel side="start" defaultSize={180}>
  left
</Panel>`}
    >
      <MiniDemoFrame>
        <PanelGroup orientation="horizontal">
          <Panel side="start" defaultSize={180}>
            <MiniPanel label="left" />
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
