import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { MiniDemoFrame, MiniPanel } from "@/components/showcase/mini-demo";
import { MiniDemoCard } from "./card";

export function CascadeOutwardDemo() {
  return (
    <MiniDemoCard
      slug="cascade-outward"
      title="Cascade outward — peer at min"
      caption="With the peer pinned at its min, dragging a docked handle outward walks the cascade past it to the next docked."
      docsSlug="sizing"
      code={`<PanelGroup orientation="horizontal">
  <Panel id="nav"  side="start" defaultSize="20%" minSize="10%" maxSize="40%">nav</Panel>
  <Panel id="list" side="start" defaultSize="22%" minSize="12%" maxSize="40%">list</Panel>
  <Panel minSize="15%">main</Panel>
  <Panel id="insp" side="end"   defaultSize="22%" minSize="12%" maxSize="40%">inspector</Panel>
</PanelGroup>`}
    >
      <MiniDemoFrame
        frameClassName="h-40"
        panels={[
          { groupId: "cascade-outward", panelId: "casc-out-nav", label: "nav" },
          {
            groupId: "cascade-outward",
            panelId: "casc-out-list",
            label: "list",
          },
          {
            groupId: "cascade-outward",
            panelId: "casc-out-insp",
            label: "inspector",
          },
        ]}
      >
        <PanelGroup groupId="cascade-outward" orientation="horizontal">
          <Panel
            panelId="casc-out-nav"
            side="start"
            defaultSize="20%"
            minSize="10%"
            maxSize="40%"
          >
            <MiniPanel
              groupId="cascade-outward"
              panelId="casc-out-nav"
              label="nav"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="casc-out-list"
            side="start"
            defaultSize="22%"
            minSize="12%"
            maxSize="40%"
          >
            <MiniPanel
              groupId="cascade-outward"
              panelId="casc-out-list"
              label="list"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel minSize="15%">
            <MiniPanel label="main" />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="casc-out-insp"
            side="end"
            defaultSize="22%"
            minSize="12%"
            maxSize="40%"
          >
            <MiniPanel
              groupId="cascade-outward"
              panelId="casc-out-insp"
              label="inspector"
            />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}

export function CascadeInwardDemo() {
  return (
    <MiniDemoCard
      slug="cascade-inward"
      title="Cascade inward — past your own min"
      caption="Drag a handle inward past a docked's own min and the next sibling toward the edge starts yielding, so the handle keeps tracking the cursor."
      docsSlug="sizing"
      code={`<PanelGroup orientation="horizontal">
  <Panel id="nav"  side="start" defaultSize="20%" minSize="10%" maxSize="40%">nav</Panel>
  <Panel id="list" side="start" defaultSize="22%" minSize="12%" maxSize="40%">list</Panel>
  <Panel>main</Panel>
</PanelGroup>

// Drag list's right handle leftward. Watch nav shrink once list hits 12%.`}
    >
      <MiniDemoFrame
        frameClassName="h-40"
        panels={[
          { groupId: "cascade-inward", panelId: "casc-in-nav", label: "nav" },
          { groupId: "cascade-inward", panelId: "casc-in-list", label: "list" },
        ]}
      >
        <PanelGroup groupId="cascade-inward" orientation="horizontal">
          <Panel
            panelId="casc-in-nav"
            side="start"
            defaultSize="20%"
            minSize="10%"
            maxSize="40%"
          >
            <MiniPanel
              groupId="cascade-inward"
              panelId="casc-in-nav"
              label="nav"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="casc-in-list"
            side="start"
            defaultSize="22%"
            minSize="12%"
            maxSize="40%"
          >
            <MiniPanel
              groupId="cascade-inward"
              panelId="casc-in-list"
              label="list"
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

export function CascadeSymmetricDemo() {
  return (
    <MiniDemoCard
      slug="cascade-symmetric"
      title="Cascade — symmetric, two dockeds each side"
      caption="Two dockeds each side of the peer — every handle cascades toward its own edge, inward past a min and outward when the peer is at its floor."
      docsSlug="sizing"
      code={`<PanelGroup orientation="horizontal">
  <Panel id="nav"      side="start" defaultSize="16%" minSize="10%" maxSize="30%">nav</Panel>
  <Panel id="list"     side="start" defaultSize="20%" minSize="12%" maxSize="35%">list</Panel>
  <Panel minSize="12%">main</Panel>
  <Panel id="insp"     side="end"   defaultSize="20%" minSize="12%" maxSize="35%">inspector</Panel>
  <Panel id="settings" side="end"   defaultSize="16%" minSize="10%" maxSize="30%">settings</Panel>
</PanelGroup>`}
    >
      <MiniDemoFrame
        frameClassName="h-40"
        panels={[
          {
            groupId: "cascade-symmetric",
            panelId: "casc-sym-nav",
            label: "nav",
          },
          {
            groupId: "cascade-symmetric",
            panelId: "casc-sym-list",
            label: "list",
          },
          {
            groupId: "cascade-symmetric",
            panelId: "casc-sym-insp",
            label: "inspector",
          },
          {
            groupId: "cascade-symmetric",
            panelId: "casc-sym-settings",
            label: "settings",
          },
        ]}
      >
        <PanelGroup groupId="cascade-symmetric" orientation="horizontal">
          <Panel
            panelId="casc-sym-nav"
            side="start"
            defaultSize="16%"
            minSize="10%"
            maxSize="30%"
          >
            <MiniPanel
              groupId="cascade-symmetric"
              panelId="casc-sym-nav"
              label="nav"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="casc-sym-list"
            side="start"
            defaultSize="20%"
            minSize="12%"
            maxSize="35%"
          >
            <MiniPanel
              groupId="cascade-symmetric"
              panelId="casc-sym-list"
              label="list"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel minSize="12%">
            <MiniPanel label="main" />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="casc-sym-insp"
            side="end"
            defaultSize="20%"
            minSize="12%"
            maxSize="35%"
          >
            <MiniPanel
              groupId="cascade-symmetric"
              panelId="casc-sym-insp"
              label="inspector"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="casc-sym-settings"
            side="end"
            defaultSize="16%"
            minSize="10%"
            maxSize="30%"
          >
            <MiniPanel
              groupId="cascade-symmetric"
              panelId="casc-sym-settings"
              label="settings"
            />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}
