import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelControls,
  usePanelRegistry,
} from "@blitzd/resizable-panels";
import { type ReactNode, useEffect, useRef } from "react";
import { PanelBody } from "./shared";

/**
 * Full-viewport layout instrumented with render counters, for the
 * render-efficiency regression spec. Each counter component exposes how
 * many times it has committed a render via `data-renders`; the spec drags
 * one panel and asserts that consumers of *other* panels' controls don't
 * re-render per drag tick.
 *
 * Counters live outside the PanelGroup (fixed overlay) so they only
 * re-render when their subscription fires — not because a parent
 * re-rendered. The count is taken in a dep-less effect (one run per
 * committed render) and written to the DOM imperatively: render stays
 * pure, and StrictMode's render-phase double-invoke doesn't inflate the
 * numbers. Its mount/remount cycle adds exactly one to each counter,
 * which the spec's delta-based assertions never see.
 */

/** Counts committed renders of its children via a dep-less effect. */
function RenderCountBadge({
  testId,
  children,
}: {
  testId: string;
  children: ReactNode;
}) {
  const el = useRef<HTMLSpanElement>(null);
  const renders = useRef(0);
  useEffect(() => {
    renders.current += 1;
    el.current?.setAttribute("data-renders", String(renders.current));
  });
  return (
    <span ref={el} data-testid={testId} data-renders="0" className="readout">
      {children}
    </span>
  );
}

function ControlsRenderCounter({ id }: { id: string }) {
  const ctrl = usePanelControls({ groupId: "render-count", panelId: id });
  return (
    <RenderCountBadge testId={`rc-${id}`}>
      {id} ({ctrl ? Math.round(ctrl.size) : "–"}px)
    </RenderCountBadge>
  );
}

/** Contrast counter: `usePanelRegistry(groupId)` subscribes to the whole
 *  group registry by design, so this one IS expected to re-render on every
 *  panel change anywhere in the group. */
function RegistryRenderCounter() {
  const registry = usePanelRegistry("render-count");
  return (
    <RenderCountBadge testId="rc-registry">
      registry ({Object.keys(registry).length})
    </RenderCountBadge>
  );
}

export default function RenderCountTest() {
  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup orientation="horizontal" groupId="render-count">
          <Panel
            panelId="left"
            side="start"
            defaultSize={260}
            minSize={150}
            maxSize={600}
            className="panel-surface"
          >
            <PanelBody groupId="render-count" label="left" />
          </Panel>
          <PanelResizeHandle />
          <Panel panelId="midA" minSize={100}>
            <PanelBody groupId="render-count" label="midA" variant="grow" />
          </Panel>
          <PanelResizeHandle />
          <Panel panelId="midB" minSize={100}>
            <PanelBody groupId="render-count" label="midB" variant="grow" />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="right"
            side="end"
            defaultSize={260}
            minSize={150}
            maxSize={600}
            className="panel-surface"
          >
            <PanelBody groupId="render-count" label="right" />
          </Panel>
        </PanelGroup>
        <div className="counters-overlay">
          <ControlsRenderCounter id="left" />
          <ControlsRenderCounter id="midA" />
          <ControlsRenderCounter id="midB" />
          <ControlsRenderCounter id="right" />
          <RegistryRenderCounter />
        </div>
      </div>
    </PanelProvider>
  );
}
