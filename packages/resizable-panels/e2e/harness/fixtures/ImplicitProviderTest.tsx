import {
  Panel,
  PanelGroup,
  type PanelGroupApi,
  PanelResizeHandle,
  type PanelStorage,
  usePanelControls,
} from "@blitzd/resizable-panels";
import { useMemo, useRef } from "react";
import { PanelBody } from "./shared";

const PERSIST_KEY = "implicit-provider-persist";

/** sessionStorage wrapped as a `PanelStorage` — distinct from the default
 *  (localStorage) so the spec can prove the user-supplied adapter is the one
 *  being called, and it still survives a same-tab reload. */
function sessionAdapter(): PanelStorage {
  return {
    getItem: (k) => window.sessionStorage.getItem(k),
    setItem: (k, v) => {
      window.sessionStorage.setItem(k, v);
    },
  };
}

/**
 * §14 implicit-provider harness. Deliberately renders NO `PanelProvider`
 * anywhere in this file — every group must install (or reuse) an implicit
 * one. The harness entry (`main.tsx`) mounts all fixtures under
 * `React.StrictMode`, so the providerless mount is also the StrictMode
 * coverage.
 *
 * Query params:
 * - default            — one standalone group with an in-page `apiRef`
 *                        toolbar (`getValue`/`setValue` need no hooks, so it
 *                        may live outside the group).
 * - `?persist`         — same group with `persistence={{ key, storage }}`.
 * - `?variant=siblings`— two standalone sibling groups stacked vertically:
 *                        independent implicit providers in one document,
 *                        used for the competing-pointer-session lease test.
 * - `?variant=nested`  — inner group inside the outer group's panel. The
 *                        inner group must reuse the outer implicit provider:
 *                        a `usePanelControls` probe mounted in the OUTER
 *                        tree (sidebar panel) addresses the INNER group by
 *                        groupId and renders its rendered size into the DOM.
 */
function SoloVariant({ persist }: { persist: boolean }) {
  const apiRef = useRef<PanelGroupApi>(null);
  const storage = useMemo<PanelStorage | undefined>(
    () => (persist ? sessionAdapter() : undefined),
    [persist],
  );
  return (
    <div className="fixture-root">
      <PanelGroup
        orientation="horizontal"
        groupId="implicit-solo"
        apiRef={apiRef}
        persistence={persist ? { key: PERSIST_KEY, storage } : undefined}
      >
        <Panel
          panelId="sidebar"
          side="start"
          defaultSize={240}
          minSize={120}
          maxSize={480}
          collapsedSize={32}
          resizableWhenCollapsed
          className="panel-surface"
        >
          <PanelBody groupId="implicit-solo" label="sidebar" />
        </Panel>
        <PanelResizeHandle data-testid="solo-handle" />
        <Panel panelId="main" minSize={200}>
          <PanelBody groupId="implicit-solo" label="main" variant="grow" />
        </Panel>
      </PanelGroup>
      <div className="toolbar-overlay">
        <div className="toolbar">
          <button
            type="button"
            className="toolbar-toggle"
            data-testid="read-layout"
            onClick={(event) => {
              event.currentTarget.dataset.layout = JSON.stringify(
                apiRef.current?.getValue(),
              );
            }}
          >
            read
          </button>
          <button
            type="button"
            className="toolbar-toggle"
            data-testid="set-layout"
            onClick={() =>
              apiRef.current?.setValue({
                sidebar: { size: 400, collapsed: false },
                main: { size: 800 },
              })
            }
          >
            set value
          </button>
        </div>
      </div>
    </div>
  );
}

function SiblingGroup({ prefix }: { prefix: "a" | "b" }) {
  const groupId = `implicit-${prefix}`;
  return (
    <PanelGroup orientation="horizontal" groupId={groupId}>
      <Panel
        panelId={`${prefix}-side`}
        side="start"
        defaultSize={240}
        minSize={100}
        maxSize={600}
        className="panel-surface"
      >
        <PanelBody groupId={groupId} label={`${prefix}-side`} />
      </Panel>
      <PanelResizeHandle data-testid={`handle-${prefix}`} />
      <Panel panelId={`${prefix}-main`} minSize={200}>
        <PanelBody groupId={groupId} label={`${prefix}-main`} variant="grow" />
      </Panel>
    </PanelGroup>
  );
}

function SiblingsVariant() {
  return (
    <div
      className="fixture-root"
      style={{ display: "flex", flexDirection: "column" }}
    >
      <div style={{ height: "50%" }}>
        <SiblingGroup prefix="a" />
      </div>
      <div style={{ height: "50%" }}>
        <SiblingGroup prefix="b" />
      </div>
    </div>
  );
}

/** Rendered inside the OUTER group's sidebar panel — outside the inner
 *  group — but addresses the inner group by groupId. Resolves only when
 *  both groups share one (implicit) provider registry. */
function InnerProbe() {
  const ctrl = usePanelControls({
    groupId: "implicit-inner",
    panelId: "terminal",
  });
  return (
    <span
      data-testid="probe-inner-terminal"
      data-found={String(Boolean(ctrl))}
      className="readout"
    >
      {ctrl ? Math.round(ctrl.renderedSize) : "none"}
    </span>
  );
}

function NestedVariant() {
  return (
    <div className="fixture-root">
      <PanelGroup orientation="horizontal" groupId="implicit-outer">
        <Panel
          panelId="sidebar"
          side="start"
          defaultSize="22%"
          minSize="10%"
          maxSize="45%"
          className="panel-surface"
        >
          <div className="panel-body" data-testid="body-sidebar">
            <span className="panel-body-label">sidebar</span>
            <InnerProbe />
          </div>
        </Panel>
        <PanelResizeHandle data-testid="outer-handle" />
        <Panel panelId="outer-main" minSize="30%">
          <PanelGroup orientation="vertical" groupId="implicit-inner">
            <Panel panelId="editor" minSize="15%">
              <PanelBody
                groupId="implicit-inner"
                label="editor"
                variant="grow"
              />
            </Panel>
            <PanelResizeHandle data-testid="inner-handle" />
            <Panel
              panelId="terminal"
              side="end"
              defaultSize="35%"
              minSize="15%"
              maxSize="65%"
              className="panel-surface"
            >
              <PanelBody groupId="implicit-inner" label="terminal" />
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  );
}

export default function ImplicitProviderTest() {
  const params = new URLSearchParams(window.location.search);
  const variant = params.get("variant");
  if (variant === "siblings") return <SiblingsVariant />;
  if (variant === "nested") return <NestedVariant />;
  return <SoloVariant persist={params.has("persist")} />;
}
