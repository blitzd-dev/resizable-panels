/**
 * Positive public type-contract fixture (§8).
 *
 * Real JSX exercises the shipped React declarations directly. Every
 * expression here MUST compile against the packed tarball under strict,
 * skipLibCheck:false, exactOptionalPropertyTypes:true, across React 18/19
 * and NodeNext/bundler resolution. The companion `negative.tsx` records the
 * rejections. Locals are `void`-referenced to satisfy noUnusedLocals.
 */
import {
  Panel,
  type PanelActionResult,
  type PanelApi,
  PanelGroup,
  type PanelGroupApi,
  type PanelGroupState,
  type PanelGroupValue,
  type PanelLocator,
  PanelProvider,
  PanelResizeHandle,
  type PanelSizeActionDetails,
  type PanelStorage,
  usePanelActions,
  usePanelControls,
  usePanelGroupState,
} from "@blitzd/resizable-panels";
import { type ReactElement, type Ref, useRef } from "react";

// ── docked / peer discrimination ────────────────────────────────────────────
const docked: ReactElement = (
  <Panel side="start" defaultSize={240} pinned collapsible>
    docked
  </Panel>
);
const dockedRelative: ReactElement = (
  <Panel side="end" defaultSize="calc(50% - 24px)" minSize="10rem">
    docked relative
  </Panel>
);
// A peer needs neither side nor defaultSize.
const peerAuto: ReactElement = <Panel>peer</Panel>;
const peerSized: ReactElement = <Panel defaultSize="50%">peer</Panel>;
void docked;
void dockedRelative;
void peerAuto;
void peerSized;

// ── native attributes and DOM refs ──────────────────────────────────────────
const divRef: Ref<HTMLDivElement> = { current: null };
const nativeAttrs: ReactElement = (
  <Panel
    id="dom-id"
    data-testid="panel"
    aria-label="Sidebar"
    title="Sidebar"
    tabIndex={-1}
    className="sidebar"
    style={{ minWidth: 0 }}
    ref={divRef}
    onClick={(event) => void event.currentTarget.id}
  />
);
void nativeAttrs;

// ── apiRef types ────────────────────────────────────────────────────────────
function WithApiRefs(): ReactElement {
  const panelApiRef = useRef<PanelApi>(null);
  const groupApiRef = useRef<PanelGroupApi>(null);
  return (
    <PanelGroup orientation="vertical" apiRef={groupApiRef} dir="rtl">
      <Panel apiRef={panelApiRef} panelId="a">
        a
      </Panel>
    </PanelGroup>
  );
}
void WithApiRefs;

// ── handle event composition + handleId + hit margins ───────────────────────
const handle: ReactElement = (
  <PanelResizeHandle
    handleId="seam"
    id="seam-dom"
    disabled={false}
    keyboardStep={12}
    hitAreaMargins={{ coarse: 15, fine: 5 }}
    doubleClickReset="after"
    onPointerDown={(event) => void event.pointerId}
    onKeyDown={(event) => void event.key}
    onDoubleClick={(event) => void event.detail}
    onLostPointerCapture={(event) => void event.pointerId}
  />
);
void handle;

// ── space-occupying gutter handles ──────────────────────────────────────────
const gutterHandle: ReactElement = (
  <PanelResizeHandle gutterSize={8} className="gutter" />
);
void gutterHandle;

// ── group animation control ─────────────────────────────────────────────────
const animationDisabled: ReactElement = (
  <PanelGroup orientation="horizontal" animation={false}>
    <Panel panelId="a">a</Panel>
  </PanelGroup>
);
const animationDurationOnly: ReactElement = (
  <PanelGroup orientation="horizontal" animation={{ durationMs: 200 }}>
    <Panel panelId="a">a</Panel>
  </PanelGroup>
);
const animationEasingOnly: ReactElement = (
  <PanelGroup orientation="horizontal" animation={{ easing: "linear" }}>
    <Panel panelId="a">a</Panel>
  </PanelGroup>
);
const animationFull: ReactElement = (
  <PanelGroup
    orientation="horizontal"
    animation={{ durationMs: 450, easing: "ease-in-out" }}
  >
    <Panel panelId="a">a</Panel>
  </PanelGroup>
);
void animationDisabled;
void animationDurationOnly;
void animationEasingOnly;
void animationFull;

// ── cascade reversal semantics ──────────────────────────────────────────────
const cascadeReversible: ReactElement = (
  <PanelGroup orientation="horizontal" cascade="reversible">
    <Panel panelId="a">a</Panel>
  </PanelGroup>
);
const cascadeLatching: ReactElement = (
  <PanelGroup orientation="horizontal" cascade="latching">
    <Panel panelId="a">a</Panel>
  </PanelGroup>
);
void cascadeReversible;
void cascadeLatching;

// ── identity locators + hooks ───────────────────────────────────────────────
const locator: PanelLocator = { groupId: "workspace", panelId: "sidebar" };
function LocatorConsumer(): ReactElement | null {
  const controls = usePanelControls(locator);
  const actions = usePanelActions();
  actions.setSize(locator, "25%", { transition: "none" });
  const groupValue = actions.getGroupValue("workspace");
  void groupValue;
  return controls ? <span>{controls.renderedSize}</span> : null;
}
void LocatorConsumer;

// ── controlled / default / persistence ──────────────────────────────────────
const value: PanelGroupValue = { sidebar: { size: 240, collapsed: false } };
const controlled: ReactElement = (
  <PanelGroup
    orientation="horizontal"
    value={value}
    onValueChange={(next, details) => void [next, details.reason]}
  >
    <Panel panelId="sidebar">sidebar</Panel>
  </PanelGroup>
);
const uncontrolled: ReactElement = (
  <PanelGroup orientation="horizontal" defaultValue={value}>
    <Panel panelId="sidebar">sidebar</Panel>
  </PanelGroup>
);
const persisted: ReactElement = (
  <PanelGroup orientation="horizontal" persistence={{ key: "workspace" }}>
    <Panel panelId="sidebar">sidebar</Panel>
  </PanelGroup>
);
// defaultValue is the first-paint fallback and coexists with persistence.
const persistedWithFallback: ReactElement = (
  <PanelGroup
    orientation="horizontal"
    defaultValue={value}
    persistence={{
      key: "workspace",
      onError: (error) => void error.operation,
      onStatusChange: (status) => void status.state,
    }}
  >
    <Panel panelId="sidebar">sidebar</Panel>
  </PanelGroup>
);
void controlled;
void uncontrolled;
void persisted;
void persistedWithFallback;

// ── per-panel controlled collapsed (R-33) ───────────────────────────────────
const controlledCollapsedDocked: ReactElement = (
  <Panel
    side="start"
    defaultSize={240}
    collapsible
    collapsed={true}
    onCollapsedChange={(next, details) =>
      void [next, details.reason, details.trigger]
    }
  >
    docked controlled
  </Panel>
);
const controlledCollapsedPeer: ReactElement = (
  <Panel panelId="tray" collapsible collapsed={false}>
    peer controlled
  </Panel>
);
// Uncontrolled collapsed state keeps its conventional default prop.
const uncontrolledCollapsed: ReactElement = (
  <Panel side="end" defaultSize={200} collapsible defaultCollapsed>
    docked uncontrolled
  </Panel>
);
void controlledCollapsedDocked;
void controlledCollapsedPeer;
void uncontrolledCollapsed;

// R-37 (fail-first): `collapsible` accepts the "auto" literal as an INPUT
// widening. Fails to compile at baseline (`collapsible: boolean`) until Stage 2
// widens the prop to `boolean | "auto"`.
const autoDocked: ReactElement = (
  <Panel side="start" defaultSize={240} collapsible="auto" collapsedSize={48}>
    docked auto
  </Panel>
);
const autoPeer: ReactElement = (
  <Panel panelId="tray" collapsible="auto" collapsedSize={48}>
    peer auto
  </Panel>
);
void autoDocked;
void autoPeer;

// ── action-result narrowing ─────────────────────────────────────────────────
declare const panelApi: PanelApi;
function narrowActionResult(
  result: PanelActionResult<number, PanelSizeActionDetails>,
): void {
  if (result.applied) {
    const size: number = result.value;
    const constrained: boolean = result.constrained;
    void [size, constrained];
  } else if (result.reason === "unchanged") {
    const size: number = result.value;
    void size;
  } else {
    const reason: "disabled" | "not-collapsible" | "invalid-size" =
      result.reason;
    void reason;
  }
}
narrowActionResult(panelApi.setSize(240));
narrowActionResult(panelApi.maximize());
const collapsed: boolean = panelApi.isCollapsed();
const pixels: number = panelApi.getSize();
void collapsed;
void pixels;

// ── sync and async storage adapters ─────────────────────────────────────────
const syncStorage: PanelStorage = {
  getItem: (key) => (key === "workspace" ? null : null),
  setItem: (_key, _value) => {},
};
const asyncStorage: PanelStorage = {
  getItem: async (_key) => null,
  setItem: async (_key, _value) => {},
};
void syncStorage;
void asyncStorage;

// ── usePanelGroupState return-shape narrowing ───────────────────────────────
function GroupStateConsumer(): ReactElement | null {
  const state: PanelGroupState | undefined = usePanelGroupState("main");
  // Undefined until the group publishes — must be narrowed before reading.
  if (!state) return null;
  const containerSize: number = state.containerSize;
  const measured: boolean = state.measured;
  const overconstrainedBy: number = state.overconstrainedBy;
  const unallocatedPx: number = state.unallocatedPx;
  void [measured, overconstrainedBy, unallocatedPx];
  return <span>{containerSize}</span>;
}
void GroupStateConsumer;

// ── explicit provider around multiple groups ────────────────────────────────
const composed: ReactElement = (
  <PanelProvider>
    <PanelGroup orientation="horizontal" groupId="left">
      <Panel panelId="a">a</Panel>
    </PanelGroup>
    <PanelGroup orientation="horizontal" groupId="right">
      <Panel panelId="b">b</Panel>
    </PanelGroup>
  </PanelProvider>
);
void composed;
