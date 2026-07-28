import {
  Panel,
  type PanelApi,
  PanelGroup,
  type PanelGroupApi,
  PanelProvider,
  PanelResizeHandle,
  usePanelActions,
  usePanelControls,
} from "@blitzd/resizable-panels";
import { useRef } from "react";

const LEFT = { groupId: "composition-group", panelId: "left" } as const;

function Controls({
  groupElementRef,
  groupApiRef,
  panelElementRef,
  panelApiRef,
  peerApiRef,
  disabledApiRef,
  handleElementRef,
}: {
  groupElementRef: React.RefObject<HTMLDivElement | null>;
  groupApiRef: React.RefObject<PanelGroupApi | null>;
  panelElementRef: React.RefObject<HTMLDivElement | null>;
  panelApiRef: React.RefObject<PanelApi | null>;
  peerApiRef: React.RefObject<PanelApi | null>;
  disabledApiRef: React.RefObject<PanelApi | null>;
  handleElementRef: React.RefObject<HTMLDivElement | null>;
}) {
  const actions = usePanelActions();
  const panelControls = usePanelControls(LEFT);
  return (
    <div className="toolbar-overlay">
      <div className="toolbar">
        <button
          type="button"
          data-testid="probe-action-results"
          onClick={(event) => {
            const handleApplied = panelApiRef.current?.setSize(260);
            const hookApplied = panelControls?.setSize(280);
            event.currentTarget.dataset.handleApplied =
              JSON.stringify(handleApplied);
            event.currentTarget.dataset.hookApplied =
              JSON.stringify(hookApplied);
            event.currentTarget.dataset.unchanged = JSON.stringify(
              panelApiRef.current?.setSize(280),
            );
            event.currentTarget.dataset.invalid = JSON.stringify(
              panelApiRef.current?.setSize("not-a-size"),
            );
            // Strict SizeSpec grammar: bare numeric strings require units
            // ("240" is invalid; 240 or "240px" are the accepted forms).
            event.currentTarget.dataset.invalidUnitless = JSON.stringify(
              panelApiRef.current?.setSize("240"),
            );
            event.currentTarget.dataset.notCollapsible = JSON.stringify(
              peerApiRef.current?.collapse(),
            );
            event.currentTarget.dataset.disabled = JSON.stringify(
              disabledApiRef.current?.setSize(150),
            );
            event.currentTarget.dataset.notFound = JSON.stringify(
              actions.expand({
                groupId: "composition-group",
                panelId: "missing",
              }),
            );
            // reset restores declarative defaults and reports the reconciled
            // outcome; a second reset with nothing to change is `unchanged`
            // and still carries the current value.
            event.currentTarget.dataset.reset = JSON.stringify(
              panelApiRef.current?.reset(),
            );
            event.currentTarget.dataset.resetUnchanged = JSON.stringify(
              panelApiRef.current?.reset(),
            );
          }}
        >
          probe action results
        </button>
        <button
          type="button"
          data-testid="probe-api"
          onClick={(event) => {
            event.currentTarget.dataset.groupDom = String(
              groupElementRef.current?.id === "composition-group",
            );
            event.currentTarget.dataset.groupApi = String(
              typeof groupApiRef.current?.getValue === "function",
            );
            event.currentTarget.dataset.panelDom = String(
              panelElementRef.current?.id === "left",
            );
            event.currentTarget.dataset.panelApi = String(
              typeof panelApiRef.current?.setSize === "function",
            );
            event.currentTarget.dataset.handleDom = String(
              handleElementRef.current?.getAttribute("role") === "separator",
            );
          }}
        >
          probe API
        </button>
        <button
          type="button"
          data-testid="panel-resize-percent"
          onClick={() => panelApiRef.current?.setSize("25%")}
        >
          panel resize 25%
        </button>
        {/* Peer setSize results are recorded per click: the returned value
            must be what the group cascade actually applied, with
            `constrained` reporting any clamp (§10). */}
        {[300, 100, 600].map((size) => (
          <button
            key={size}
            type="button"
            data-testid={`peer-resize-${size}`}
            onClick={(event) => {
              event.currentTarget.dataset.result = JSON.stringify(
                peerApiRef.current?.setSize(size),
              );
            }}
          >
            peer resize {size}
          </button>
        ))}
        <button
          type="button"
          data-testid="layout-resize-calc"
          onClick={() => actions.setSize(LEFT, "calc(20% + 10px)")}
        >
          layout resize calc
        </button>
        <button
          type="button"
          data-testid="panel-maximize"
          onClick={() => panelApiRef.current?.maximize()}
        >
          panel maximize
        </button>
        <button
          type="button"
          data-testid="layout-maximize"
          onClick={() => actions.maximize(LEFT)}
        >
          layout maximize
        </button>
        <button
          type="button"
          data-testid="layout-invalid-number"
          onClick={() => actions.setSize(LEFT, Number.NaN)}
        >
          invalid number
        </button>
        <button
          type="button"
          data-testid="layout-invalid-string"
          onClick={() => actions.setSize(LEFT, "not-a-size")}
        >
          invalid string
        </button>
        <button
          type="button"
          data-testid="read-size-snapshot"
          onClick={(event) => {
            const preferred = panelApiRef.current?.getSize();
            const rendered = panelApiRef.current?.getRenderedSize();
            event.currentTarget.dataset.preferred = JSON.stringify(preferred);
            event.currentTarget.dataset.rendered = JSON.stringify(rendered);
          }}
        >
          read size
        </button>
        <button
          type="button"
          data-testid="read-peer-size-snapshot"
          onClick={(event) => {
            const preferred = peerApiRef.current?.getSize();
            const rendered = peerApiRef.current?.getRenderedSize();
            event.currentTarget.dataset.preferred = JSON.stringify(preferred);
            event.currentTarget.dataset.rendered = JSON.stringify(rendered);
            event.currentTarget.dataset.value = JSON.stringify(
              groupApiRef.current?.getValue(),
            );
          }}
        >
          read peer size
        </button>
        <button
          type="button"
          data-testid="probe-group-commands"
          onClick={(event) => {
            const before = actions.getGroupValue("composition-group");
            const applied = actions.setGroupValue("composition-group", {
              left: { size: 320 },
              main: { size: 880 },
            });
            const missingSet = actions.setGroupValue("missing-group", {
              left: { size: 100 },
            });
            const missingGet = actions.getGroupValue("missing-group");
            event.currentTarget.dataset.before = JSON.stringify(before ?? null);
            event.currentTarget.dataset.applied = JSON.stringify(applied);
            event.currentTarget.dataset.missingSet = JSON.stringify(missingSet);
            event.currentTarget.dataset.missingGet = JSON.stringify(
              missingGet ?? null,
            );
          }}
        >
          probe group commands
        </button>
        <button
          type="button"
          data-testid="probe-group-commands-again"
          onClick={(event) => {
            const unchanged = actions.setGroupValue("composition-group", {
              left: { size: 320 },
              main: { size: 880 },
            });
            const reset = actions.resetGroupValue("composition-group");
            const missingReset = actions.resetGroupValue("missing-group");
            event.currentTarget.dataset.unchanged = JSON.stringify(unchanged);
            event.currentTarget.dataset.reset = JSON.stringify(reset);
            event.currentTarget.dataset.missingReset =
              JSON.stringify(missingReset);
          }}
        >
          probe group commands again
        </button>
      </div>
    </div>
  );
}

export default function ApiCompositionTest() {
  const params = new URLSearchParams(window.location.search);
  const cursor = params.get("cursor");
  const singlePeerResize = params.has("single-peer-resize");
  const groupElementRef = useRef<HTMLDivElement>(null);
  const groupApiRef = useRef<PanelGroupApi>(null);
  const panelElementRef = useRef<HTMLDivElement>(null);
  const panelApiRef = useRef<PanelApi>(null);
  const peerApiRef = useRef<PanelApi>(null);
  const disabledApiRef = useRef<PanelApi>(null);
  const handleElementRef = useRef<HTMLDivElement>(null);
  const eventsRef = useRef<HTMLDivElement>(null);

  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup
          ref={groupElementRef}
          apiRef={groupApiRef}
          id="composition-group"
          groupId="composition-group"
          orientation="horizontal"
          cursorBehavior={
            cursor === "handle" || cursor === "none" ? cursor : "global"
          }
          aria-label="Composition workspace"
          data-consumer-group="yes"
        >
          <Panel
            ref={panelElementRef}
            apiRef={panelApiRef}
            id="left"
            panelId="left"
            side="start"
            defaultSize={singlePeerResize ? 200 : 240}
            minSize={100}
            maxSize={singlePeerResize ? 300 : 500}
            aria-label="Consumer navigation"
            data-consumer-panel="yes"
            className="consumer-panel-root"
            style={{ color: "rgb(1, 2, 3)" }}
            slotProps={{
              viewport: { title: "docked viewport" },
              content: { title: "docked content" },
            }}
            onClick={() => {
              if (eventsRef.current) eventsRef.current.dataset.clicked = "true";
            }}
            onSizeChange={(size, details) => {
              if (!eventsRef.current) return;
              eventsRef.current.dataset.resize = JSON.stringify({
                size,
                details,
              });
            }}
            onCollapsedChange={(collapsed, details) => {
              if (!eventsRef.current) return;
              eventsRef.current.dataset.collapse = JSON.stringify({
                collapsed,
                details,
              });
            }}
          >
            left
          </Panel>
          <PanelResizeHandle
            ref={handleElementRef}
            data-testid="composition-handle"
            aria-label="Resize consumer navigation"
          />
          <Panel
            apiRef={peerApiRef}
            id="main"
            panelId="main"
            minSize={100}
            className="consumer-peer-root"
            slotProps={{
              viewport: { title: "peer viewport" },
              content: { title: "peer content" },
            }}
          >
            main
          </Panel>
        </PanelGroup>
        <PanelGroup orientation="horizontal" style={{ width: 300, height: 40 }}>
          <Panel
            id="disabled"
            panelId="disabled"
            apiRef={disabledApiRef}
            disabled
          >
            disabled
          </Panel>
        </PanelGroup>
        <Controls
          groupElementRef={groupElementRef}
          groupApiRef={groupApiRef}
          panelElementRef={panelElementRef}
          panelApiRef={panelApiRef}
          peerApiRef={peerApiRef}
          disabledApiRef={disabledApiRef}
          handleElementRef={handleElementRef}
        />
        <div
          ref={eventsRef}
          data-testid="composition-events"
          data-clicked="false"
          data-resize=""
          data-collapse=""
        />
      </div>
    </PanelProvider>
  );
}
