import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { MiniDemoFrame, MiniPanel } from "@/components/showcase/mini-demo";
import { MiniDemoCard } from "./card";

export function VerticalDemo() {
  return (
    <MiniDemoCard
      slug="vertical"
      title="Vertical group"
      caption="The same Panel on the vertical axis — side='start' is the top edge, side='end' the bottom."
      docsSlug="building-layouts"
      code={`<PanelGroup orientation="vertical">
  <Panel side="start" defaultSize={80} minSize={60} maxSize={140}>
    top
  </Panel>
  <Panel>main</Panel>
  <Panel side="end" defaultSize={80} minSize={60} maxSize={140}>
    bottom
  </Panel>
</PanelGroup>`}
    >
      <MiniDemoFrame
        frameClassName="h-64"
        panels={[
          { groupId: "vertical", panelId: "mini-vert-top", label: "top" },
          { groupId: "vertical", panelId: "mini-vert-bot", label: "bottom" },
        ]}
      >
        <PanelGroup groupId="vertical" orientation="vertical">
          <Panel
            panelId="mini-vert-top"
            side="start"
            defaultSize={80}
            minSize={60}
            maxSize={140}
          >
            <MiniPanel groupId="vertical" panelId="mini-vert-top" label="top" />
          </Panel>
          <PanelResizeHandle />
          <Panel>
            <MiniPanel label="main" />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="mini-vert-bot"
            side="end"
            defaultSize={80}
            minSize={60}
            maxSize={140}
          >
            <MiniPanel
              groupId="vertical"
              panelId="mini-vert-bot"
              label="bottom"
            />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}

export function NestedDemo() {
  return (
    <MiniDemoCard
      slug="nested"
      title="Nested groups"
      caption="A vertical group inside a horizontal one builds an IDE shell — percentages resolve per group, so 35% is 35% of the column."
      docsSlug="building-layouts"
      code={`<PanelGroup orientation="horizontal">
  <Panel side="start" defaultSize="22%" minSize="15%" maxSize="40%">
    sidebar
  </Panel>
  <Panel>
    <PanelGroup orientation="vertical">
      <Panel>editor</Panel>
      <Panel side="end" defaultSize="35%" minSize="15%" maxSize="65%">
        terminal
      </Panel>
    </PanelGroup>
  </Panel>
  <Panel side="end" defaultSize="22%" minSize="15%" maxSize="40%">
    inspector
  </Panel>
</PanelGroup>`}
    >
      <MiniDemoFrame
        frameClassName="h-72"
        panels={[
          { groupId: "nested", panelId: "mini-ide-sidebar", label: "sidebar" },
          {
            groupId: "nested-editor",
            panelId: "mini-ide-term",
            label: "terminal",
          },
          {
            groupId: "nested",
            panelId: "mini-ide-inspector",
            label: "inspector",
          },
        ]}
      >
        <PanelGroup groupId="nested" orientation="horizontal">
          <Panel
            panelId="mini-ide-sidebar"
            side="start"
            defaultSize="22%"
            minSize="15%"
            maxSize="40%"
          >
            <MiniPanel
              groupId="nested"
              panelId="mini-ide-sidebar"
              label="sidebar"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel>
            <PanelGroup groupId="nested-editor" orientation="vertical">
              <Panel>
                <MiniPanel label="editor" />
              </Panel>
              <PanelResizeHandle />
              <Panel
                panelId="mini-ide-term"
                side="end"
                defaultSize="35%"
                minSize="15%"
                maxSize="65%"
              >
                <MiniPanel
                  groupId="nested-editor"
                  panelId="mini-ide-term"
                  label="terminal"
                />
              </Panel>
            </PanelGroup>
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="mini-ide-inspector"
            side="end"
            defaultSize="22%"
            minSize="15%"
            maxSize="40%"
          >
            <MiniPanel
              groupId="nested"
              panelId="mini-ide-inspector"
              label="inspector"
            />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}

export function FourColumnsDemo() {
  return (
    <MiniDemoCard
      slug="four-columns"
      title="Four columns (email-app)"
      caption="Three docked columns around a peer that absorbs the slack — close any of them and the peer expands, held above a usable floor by minSize."
      docsSlug="building-layouts"
      code={`<PanelGroup orientation="horizontal">
  <Panel id="nav"  side="start" defaultSize="18%" minSize="12%" maxSize="30%">nav</Panel>
  <Panel id="list" side="start" defaultSize="22%" minSize="15%" maxSize="35%">list</Panel>
  <Panel minSize="20%">main</Panel>
  <Panel id="insp" side="end"   defaultSize="22%" minSize="15%" maxSize="35%">inspector</Panel>
</PanelGroup>`}
    >
      <MiniDemoFrame
        frameClassName="h-40"
        panels={[
          { groupId: "four-columns", panelId: "mini-4col-nav", label: "nav" },
          { groupId: "four-columns", panelId: "mini-4col-list", label: "list" },
          {
            groupId: "four-columns",
            panelId: "mini-4col-insp",
            label: "inspector",
          },
        ]}
      >
        <PanelGroup groupId="four-columns" orientation="horizontal">
          <Panel
            panelId="mini-4col-nav"
            side="start"
            defaultSize="18%"
            minSize="12%"
            maxSize="30%"
          >
            <MiniPanel
              groupId="four-columns"
              panelId="mini-4col-nav"
              label="nav"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="mini-4col-list"
            side="start"
            defaultSize="22%"
            minSize="15%"
            maxSize="35%"
          >
            <MiniPanel
              groupId="four-columns"
              panelId="mini-4col-list"
              label="list"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel minSize="20%">
            <MiniPanel label="main" />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="mini-4col-insp"
            side="end"
            defaultSize="22%"
            minSize="15%"
            maxSize="35%"
          >
            <MiniPanel
              groupId="four-columns"
              panelId="mini-4col-insp"
              label="inspector"
            />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}

export function QuadrantDemo() {
  return (
    <MiniDemoCard
      slug="quadrants"
      title="2 × 2 quadrants"
      caption="A vertical group on each side of a horizontal one makes a true grid — the inner row heights are independent."
      docsSlug="building-layouts"
      code={`<PanelGroup orientation="horizontal">
  <Panel side="start" defaultSize="50%" minSize="20%" maxSize="80%">
    <PanelGroup orientation="vertical">
      <Panel>top-left</Panel>
      <Panel side="end" defaultSize="40%" minSize="15%" maxSize="80%">
        bottom-left
      </Panel>
    </PanelGroup>
  </Panel>
  <Panel>
    <PanelGroup orientation="vertical">
      <Panel>top-right</Panel>
      <Panel side="end" defaultSize="40%" minSize="15%" maxSize="80%">
        bottom-right
      </Panel>
    </PanelGroup>
  </Panel>
</PanelGroup>`}
    >
      <MiniDemoFrame
        frameClassName="h-72"
        panels={[
          {
            groupId: "quadrants",
            panelId: "mini-q-left-col",
            label: "left col",
          },
          {
            groupId: "quadrants-left",
            panelId: "mini-q-bl",
            label: "bottom-left",
          },
          {
            groupId: "quadrants-right",
            panelId: "mini-q-br",
            label: "bottom-right",
          },
        ]}
      >
        <PanelGroup groupId="quadrants" orientation="horizontal">
          <Panel
            panelId="mini-q-left-col"
            side="start"
            defaultSize="50%"
            minSize="20%"
            maxSize="80%"
          >
            <PanelGroup groupId="quadrants-left" orientation="vertical">
              <Panel>
                <MiniPanel label="top-left" />
              </Panel>
              <PanelResizeHandle />
              <Panel
                panelId="mini-q-bl"
                side="end"
                defaultSize="40%"
                minSize="15%"
                maxSize="80%"
              >
                <MiniPanel
                  groupId="quadrants-left"
                  panelId="mini-q-bl"
                  label="bottom-left"
                />
              </Panel>
            </PanelGroup>
          </Panel>
          <PanelResizeHandle />
          <Panel>
            <PanelGroup groupId="quadrants-right" orientation="vertical">
              <Panel>
                <MiniPanel label="top-right" />
              </Panel>
              <PanelResizeHandle />
              <Panel
                panelId="mini-q-br"
                side="end"
                defaultSize="40%"
                minSize="15%"
                maxSize="80%"
              >
                <MiniPanel
                  groupId="quadrants-right"
                  panelId="mini-q-br"
                  label="bottom-right"
                />
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}

export function MinOnlyDemo() {
  return (
    <MiniDemoCard
      slug="min-only"
      title={`Four peers, only minSize="10%"`}
      caption="Four bare peers auto-distribute evenly, each pinning at its 10% floor before the seam cascades to the next neighbor."
      docsSlug="building-layouts"
      code={`<PanelGroup orientation="horizontal">
  <Panel minSize="10%">a</Panel>
  <Panel minSize="10%">b</Panel>
  <Panel minSize="10%">c</Panel>
  <Panel minSize="10%">d</Panel>
</PanelGroup>`}
    >
      <MiniDemoFrame>
        <PanelGroup orientation="horizontal">
          <Panel minSize="10%">
            <MiniPanel label="a" />
          </Panel>
          <PanelResizeHandle />
          <Panel minSize="10%">
            <MiniPanel label="b" />
          </Panel>
          <PanelResizeHandle />
          <Panel minSize="10%">
            <MiniPanel label="c" />
          </Panel>
          <PanelResizeHandle />
          <Panel minSize="10%">
            <MiniPanel label="d" />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}
