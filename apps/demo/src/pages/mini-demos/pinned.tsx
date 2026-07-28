import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { MiniDemoFrame, MiniPanel } from "@/components/showcase/mini-demo";
import { MiniDemoCard } from "./card";

export function PinnedPanelDemo() {
  return (
    <MiniDemoCard
      slug="pinned"
      title="pinned — excluded from cascades"
      caption="pinned keeps a panel out of sibling cascades — it holds its width while you can still resize it from its own handle."
      docsSlug="building-layouts"
      code={`<Panel id="nav" side="start" defaultSize="20%" minSize="10%" pinned>
  nav
</Panel>
<Panel id="list" side="start" defaultSize="22%" minSize="12%">list</Panel>
<Panel>main</Panel>`}
    >
      <MiniDemoFrame
        frameClassName="h-40"
        panels={[
          { groupId: "pinned", panelId: "pinned-nav", label: "nav" },
          { groupId: "pinned", panelId: "pinned-list", label: "list" },
        ]}
      >
        <PanelGroup groupId="pinned" orientation="horizontal">
          <Panel
            panelId="pinned-nav"
            side="start"
            defaultSize="20%"
            minSize="10%"
            maxSize="40%"
            pinned
          >
            <MiniPanel
              groupId="pinned"
              panelId="pinned-nav"
              label="nav (pinned)"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="pinned-list"
            side="start"
            defaultSize="22%"
            minSize="12%"
            maxSize="40%"
          >
            <MiniPanel groupId="pinned" panelId="pinned-list" label="list" />
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

export function PinnedPxSidebarDemo() {
  return (
    <MiniDemoCard
      slug="pinned-px-sidebar"
      title="Pinned px sidebar with % siblings"
      caption="A fixed 240px nav that no cascade can squeeze, sitting beside percentage siblings — the sidebar keeps its visual budget."
      docsSlug="building-layouts"
      code={`<PanelGroup orientation="horizontal">
  <Panel
    id="nav"
    side="start"
    defaultSize={240}
    minSize={200}
    maxSize={320}
    pinned
  >
    nav
  </Panel>
  <Panel id="list" side="start" defaultSize="22%" minSize="12%" maxSize="40%">
    list
  </Panel>
  <Panel minSize="15%">main</Panel>
  <Panel id="insp" side="end" defaultSize="22%" minSize="12%" maxSize="40%">
    inspector
  </Panel>
</PanelGroup>`}
    >
      <MiniDemoFrame
        frameClassName="h-40"
        panels={[
          { groupId: "pinned-px-sidebar", panelId: "pxpin-nav", label: "nav" },
          {
            groupId: "pinned-px-sidebar",
            panelId: "pxpin-list",
            label: "list",
          },
          {
            groupId: "pinned-px-sidebar",
            panelId: "pxpin-insp",
            label: "inspector",
          },
        ]}
      >
        <PanelGroup groupId="pinned-px-sidebar" orientation="horizontal">
          <Panel
            panelId="pxpin-nav"
            side="start"
            defaultSize={240}
            minSize={200}
            maxSize={320}
            pinned
          >
            <MiniPanel
              groupId="pinned-px-sidebar"
              panelId="pxpin-nav"
              label="nav (pinned px)"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="pxpin-list"
            side="start"
            defaultSize="22%"
            minSize="12%"
            maxSize="40%"
          >
            <MiniPanel
              groupId="pinned-px-sidebar"
              panelId="pxpin-list"
              label="list (%)"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel minSize="15%">
            <MiniPanel label="main" />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="pxpin-insp"
            side="end"
            defaultSize="22%"
            minSize="12%"
            maxSize="40%"
          >
            <MiniPanel
              groupId="pinned-px-sidebar"
              panelId="pxpin-insp"
              label="inspector (%)"
            />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}

export function MultiplePinnedDemo() {
  return (
    <MiniDemoCard
      slug="multiple-pinned"
      title="Multiple pinned panels — px on one side, % on the other"
      caption="Two pinned panels — px on one side, % on the other — that every cascade chain skips; only the unpinned dockeds participate."
      docsSlug="building-layouts"
      code={`<PanelGroup orientation="horizontal">
  <Panel id="nav"   side="start" defaultSize="14%" minSize="10%" maxSize="20%" pinned>
    nav (% pinned)
  </Panel>
  <Panel id="list"  side="start" defaultSize="22%" minSize="12%" maxSize="40%">
    list
  </Panel>
  <Panel minSize="12%">main</Panel>
  <Panel id="insp"  side="end"   defaultSize="22%" minSize="12%" maxSize="40%">
    inspector
  </Panel>
  <Panel id="settings" side="end" defaultSize={120} minSize={80} maxSize={180} pinned>
    settings (px pinned)
  </Panel>
</PanelGroup>`}
    >
      <MiniDemoFrame
        frameClassName="h-40"
        panels={[
          { groupId: "multiple-pinned", panelId: "multipin-nav", label: "nav" },
          {
            groupId: "multiple-pinned",
            panelId: "multipin-list",
            label: "list",
          },
          {
            groupId: "multiple-pinned",
            panelId: "multipin-insp",
            label: "inspector",
          },
          {
            groupId: "multiple-pinned",
            panelId: "multipin-settings",
            label: "settings",
          },
        ]}
      >
        <PanelGroup groupId="multiple-pinned" orientation="horizontal">
          <Panel
            panelId="multipin-nav"
            side="start"
            defaultSize="14%"
            minSize="10%"
            maxSize="20%"
            pinned
          >
            <MiniPanel
              groupId="multiple-pinned"
              panelId="multipin-nav"
              label="nav (% pin)"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="multipin-list"
            side="start"
            defaultSize="22%"
            minSize="12%"
            maxSize="40%"
          >
            <MiniPanel
              groupId="multiple-pinned"
              panelId="multipin-list"
              label="list"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel minSize="12%">
            <MiniPanel label="main" />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="multipin-insp"
            side="end"
            defaultSize="22%"
            minSize="12%"
            maxSize="40%"
          >
            <MiniPanel
              groupId="multiple-pinned"
              panelId="multipin-insp"
              label="inspector"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="multipin-settings"
            side="end"
            defaultSize={120}
            minSize={80}
            maxSize={180}
            pinned
          >
            <MiniPanel
              groupId="multiple-pinned"
              panelId="multipin-settings"
              label="settings (px pin)"
            />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}
