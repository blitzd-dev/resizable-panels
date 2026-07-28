import {
  Panel,
  type PanelApi,
  PanelGroup,
  type PanelGroupApi,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useRef } from "react";
import { MiniDemoFrame, MiniPanel } from "@/components/showcase/mini-demo";
import { Button } from "@/components/ui/button";
import { MiniDemoCard } from "./card";

export function CoincidentHandlesDemo() {
  const group = useRef<PanelGroupApi>(null);
  const middle = useRef<PanelApi>(null);

  return (
    <MiniDemoCard
      slug="coincident-handles"
      title="Zero-width handle seam"
      caption="Set the middle peer to 0px and its two handles share one line — the first drag direction locks which boundary moves until you release."
      docsSlug="building-layouts"
      code={`const middle = useRef<PanelApi>(null);

<button onClick={() => middle.current?.setSize(0)}>
  Set middle to 0px
</button>

<PanelGroup orientation="horizontal">
  <Panel minSize={0}>left</Panel>
  <PanelResizeHandle />
  <Panel apiRef={middle} minSize={0}>middle</Panel>
  <PanelResizeHandle />
  <Panel minSize={0}>right</Panel>
</PanelGroup>`}
    >
      <MiniDemoFrame
        toolbar={
          <div className="flex items-center gap-1.5">
            <Button
              size="xs"
              variant="secondary"
              onClick={() => middle.current?.setSize(0)}
            >
              Set middle to 0px
            </Button>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => group.current?.resetValue()}
            >
              Reset
            </Button>
          </div>
        }
      >
        <PanelGroup
          apiRef={group}
          groupId="coincident-handles"
          orientation="horizontal"
        >
          <Panel panelId="coincident-left" minSize={0}>
            <MiniPanel
              groupId="coincident-handles"
              panelId="coincident-left"
              label="left"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel apiRef={middle} panelId="coincident-middle" minSize={0}>
            <MiniPanel
              groupId="coincident-handles"
              panelId="coincident-middle"
              label="middle"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel panelId="coincident-right" minSize={0}>
            <MiniPanel
              groupId="coincident-handles"
              panelId="coincident-right"
              label="right"
            />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}

export function CustomHandleDemo() {
  return (
    <MiniDemoCard
      slug="custom-handle"
      title="iOS-style grab handle"
      caption="A flat 1px seam with a single rounded pill as the grab indicator — quiet at rest, brightening on hover and drag."
      docsSlug="styling-and-slot-props"
      code={`/* in your global CSS — drive color off data-active rather than :hover
   so neighbor handles don't light up while another one is being dragged. */
.grippy [data-resizable-panels-resize-handle][data-orientation="vertical"]
  [data-resizable-panels-resize-handle-line]::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 32px;
  transform: translate(-50%, -50%);
  background: var(--resizable-panels-resize-handle-color);
  border-radius: 999px;
  transition: background 150ms;
}
.grippy [data-resizable-panels-resize-handle][data-active]
  [data-resizable-panels-resize-handle-line]::after {
  background: var(--primary);
}`}
    >
      <MiniDemoFrame
        panels={[
          { groupId: "custom-handle", panelId: "grip-left", label: "nav" },
        ]}
        frameClassName="demo-grippy"
      >
        <PanelGroup groupId="custom-handle" orientation="horizontal">
          <Panel
            panelId="grip-left"
            side="start"
            defaultSize={160}
            minSize={100}
            maxSize={260}
          >
            <MiniPanel
              groupId="custom-handle"
              panelId="grip-left"
              label="nav"
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

export function CustomHandleMultiDemo() {
  return (
    <MiniDemoCard
      slug="custom-handle-multi"
      title="iOS handles across a multi-panel layout"
      caption="The same pill across a four-column layout — every seam gets one, and dragging a seam suppresses hover on the rest so only the pressed handle stays lit."
      docsSlug="styling-and-slot-props"
      code={`<PanelGroup orientation="horizontal">
  <Panel side="start" defaultSize="18%" minSize="12%" maxSize="30%">nav</Panel>
  <Panel side="start" defaultSize="22%" minSize="15%" maxSize="35%">list</Panel>
  <Panel minSize="20%">main</Panel>
  <Panel side="end"   defaultSize="22%" minSize="15%" maxSize="35%">inspector</Panel>
</PanelGroup>`}
    >
      <MiniDemoFrame
        frameClassName="h-40 demo-grippy"
        panels={[
          {
            groupId: "custom-handle-multi",
            panelId: "grip-multi-nav",
            label: "nav",
          },
          {
            groupId: "custom-handle-multi",
            panelId: "grip-multi-list",
            label: "list",
          },
          {
            groupId: "custom-handle-multi",
            panelId: "grip-multi-insp",
            label: "inspector",
          },
        ]}
      >
        <PanelGroup groupId="custom-handle-multi" orientation="horizontal">
          <Panel
            panelId="grip-multi-nav"
            side="start"
            defaultSize="18%"
            minSize="12%"
            maxSize="30%"
          >
            <MiniPanel
              groupId="custom-handle-multi"
              panelId="grip-multi-nav"
              label="nav"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="grip-multi-list"
            side="start"
            defaultSize="22%"
            minSize="15%"
            maxSize="35%"
          >
            <MiniPanel
              groupId="custom-handle-multi"
              panelId="grip-multi-list"
              label="list"
            />
          </Panel>
          <PanelResizeHandle />
          <Panel minSize="20%">
            <MiniPanel label="main" />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="grip-multi-insp"
            side="end"
            defaultSize="22%"
            minSize="15%"
            maxSize="35%"
          >
            <MiniPanel
              groupId="custom-handle-multi"
              panelId="grip-multi-insp"
              label="inspector"
            />
          </Panel>
        </PanelGroup>
      </MiniDemoFrame>
    </MiniDemoCard>
  );
}

export function HoverRevealHandleDemo() {
  return (
    <MiniDemoCard
      slug="hover-reveal-handle"
      title="Reveal handle on hover"
      caption="Invisible at rest, the handle fades to a thick pill when the cursor enters its hit zone — for minimalist UIs where chrome stays quiet until reached for."
      docsSlug="styling-and-slot-props"
      code={`/* in your global CSS */
.hover-reveal [data-resizable-panels-resize-handle-line] {
  width: 6px !important;
  border-radius: 999px;
  opacity: 0 !important;
  transition: opacity 150ms;
}
.hover-reveal [data-resizable-panels-resize-handle][data-active] [data-resizable-panels-resize-handle-line] {
  opacity: 1 !important;
  background: var(--primary) !important;
}`}
    >
      <MiniDemoFrame
        panels={[
          {
            groupId: "hover-reveal-handle",
            panelId: "reveal-left",
            label: "nav",
          },
        ]}
        frameClassName="demo-hover-reveal"
      >
        <PanelGroup groupId="hover-reveal-handle" orientation="horizontal">
          <Panel
            panelId="reveal-left"
            side="start"
            defaultSize={160}
            minSize={100}
            maxSize={260}
          >
            <MiniPanel
              groupId="hover-reveal-handle"
              panelId="reveal-left"
              label="nav"
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
