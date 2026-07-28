/**
 * Negative public type-contract fixture (§8).
 *
 * Each `@ts-expect-error` records exactly one rejected expression: if the
 * public contract regresses so the expression starts compiling, the missing
 * error fails the build. One narrowly scoped error per statement so an
 * unrelated failure cannot satisfy the assertion. Compiled against the
 * packed tarball across React 18/19 and NodeNext/bundler resolution.
 */

// biome-ignore-start assist/source/organizeImports: the removed-export
// assertions below must stay one import per line so each @ts-expect-error
// covers exactly one rejected specifier; merging them destroys the fixture.
import {
  type PanelApi,
  Panel,
  PanelGroup,
  type PanelGroupApi,
  type PanelLocator,
  PanelResizeHandle,
  usePanelGroupState,
} from "@blitzd/resizable-panels";
import { type ReactElement, useRef } from "react";

// ── removed / renamed / private exports must be absent ──────────────────────
// @ts-expect-error resolveSize is private (§13), not a public export.
import { resolveSize } from "@blitzd/resizable-panels";
// @ts-expect-error usePanelLayout was split into targeted hooks (§3).
import { usePanelLayout } from "@blitzd/resizable-panels";
// @ts-expect-error PanelHandle was renamed to PanelApi (§9).
import { PanelHandle } from "@blitzd/resizable-panels";
// @ts-expect-error PanelPersistenceErrorEvent was replaced by PanelPersistenceError (§12).
import type { PanelPersistenceErrorEvent } from "@blitzd/resizable-panels";
// biome-ignore-end assist/source/organizeImports: see above
void [resolveSize, usePanelLayout, PanelHandle];
type _Removed = PanelPersistenceErrorEvent;

// ── blocked deep imports (exports map exposes only "." and package.json) ─────
// @ts-expect-error deep import into dist is not part of the exports map.
import { clamp } from "@blitzd/resizable-panels/dist/size.js";
// @ts-expect-error source files are never published or importable.
import { createPanelStore } from "@blitzd/resizable-panels/src/core/panel-store";

void [clamp, createPanelStore];

// ── docked / peer discrimination ────────────────────────────────────────────
// @ts-expect-error a docked <Panel side> requires defaultSize.
const missingDefault: ReactElement = <Panel side="start" />;
// @ts-expect-error pinned only applies to docked panels, not peers.
const peerPinned: ReactElement = <Panel pinned />;
void [missingDefault, peerPinned];

// ── omitted native handlers/attributes ──────────────────────────────────────
// @ts-expect-error <Panel> re-owns onResize and omits the native handler.
const panelOnResize: ReactElement = <Panel onResize={() => {}} />;
// @ts-expect-error the handle owns role/tabIndex; role is omitted from its props.
const handleRole: ReactElement = <PanelResizeHandle role="separator" />;
// @ts-expect-error tabIndex is omitted from the handle's props.
const handleTabIndex: ReactElement = <PanelResizeHandle tabIndex={0} />;
void [panelOnResize, handleRole, handleTabIndex];

// ── apiRef type mismatch ────────────────────────────────────────────────────
function ApiRefSwap(): ReactElement {
  const groupApiRef = useRef<PanelGroupApi>(null);
  // @ts-expect-error a PanelGroupApi ref is not assignable to a Panel apiRef.
  return <Panel apiRef={groupApiRef} />;
}
void ApiRefSwap;

// ── identity locators ───────────────────────────────────────────────────────
// @ts-expect-error a locator requires both groupId and panelId.
const partialLocator: PanelLocator = { groupId: "workspace" };
void partialLocator;

// ── controlled / default exclusivity ────────────────────────────────────────
const bothStates: ReactElement = (
  // @ts-expect-error controlled value and defaultValue are mutually exclusive.
  <PanelGroup orientation="horizontal" value={{}} defaultValue={{}}>
    <Panel panelId="a">a</Panel>
  </PanelGroup>
);
void bothStates;

// ── per-panel controlled collapsed exclusivity (R-33) ───────────────────────
const bothCollapsedStates: ReactElement = (
  // @ts-expect-error controlled collapsed and defaultCollapsed are mutually exclusive.
  <Panel
    side="start"
    defaultSize={200}
    collapsible
    collapsed={true}
    defaultCollapsed={true}
  >
    a
  </Panel>
);
// @ts-expect-error collapsed is a boolean, not a string.
const collapsedString: ReactElement = <Panel collapsible collapsed="true" />;
void bothCollapsedStates;
void collapsedString;

// R-37: `collapsible` widens to `boolean | "auto"` only — an arbitrary string
// stays rejected (regression guard; must hold before AND after the widening).
// @ts-expect-error "always" is not a member of the collapsible union.
const badCollapsible: ReactElement = <Panel collapsible="always" />;
void badCollapsible;

// ── invalid enum values ─────────────────────────────────────────────────────
const badOrientation: ReactElement = (
  // @ts-expect-error orientation must be "horizontal" or "vertical".
  <PanelGroup orientation="diagonal">
    <Panel panelId="a">a</Panel>
  </PanelGroup>
);
void badOrientation;

// ── animation prop shape ────────────────────────────────────────────────────
const animationTrue: ReactElement = (
  // @ts-expect-error animation accepts only false or an options object, never true.
  <PanelGroup orientation="horizontal" animation={true}>
    <Panel panelId="a">a</Panel>
  </PanelGroup>
);
const animationStringDuration: ReactElement = (
  // @ts-expect-error durationMs must be a number of milliseconds, not a string.
  <PanelGroup orientation="horizontal" animation={{ durationMs: "fast" }}>
    <Panel panelId="a">a</Panel>
  </PanelGroup>
);
const animationNumericEasing: ReactElement = (
  // @ts-expect-error easing must be a CSS easing string, not a number.
  <PanelGroup orientation="horizontal" animation={{ easing: 5 }}>
    <Panel panelId="a">a</Panel>
  </PanelGroup>
);
void animationTrue;
void animationStringDuration;
void animationNumericEasing;

// ── cascade reversal semantics ──────────────────────────────────────────────
const cascadeTypo: ReactElement = (
  // @ts-expect-error cascade accepts only "reversible" or "latching".
  <PanelGroup orientation="horizontal" cascade="latch">
    <Panel panelId="a">a</Panel>
  </PanelGroup>
);
const cascadeBoolean: ReactElement = (
  // @ts-expect-error cascade is a string mode, never a boolean.
  <PanelGroup orientation="horizontal" cascade={true}>
    <Panel panelId="a">a</Panel>
  </PanelGroup>
);
void cascadeTypo;
void cascadeBoolean;

// ── gutter handles ──────────────────────────────────────────────────────────
// @ts-expect-error gutterSize is a pixel number; unit strings are rejected.
const gutterString: ReactElement = <PanelResizeHandle gutterSize="8px" />;
void gutterString;

// ── action argument and result narrowing ────────────────────────────────────
declare const panelApi: PanelApi;
// @ts-expect-error a boolean is not a valid SizeSpec.
panelApi.setSize(true);
const rejection = panelApi.collapse();
if (!rejection.applied && rejection.reason === "disabled") {
  // @ts-expect-error a rejection branch carries no value.
  void rejection.value;
}

// ── usePanelGroupState locator + narrowing ──────────────────────────────────
function GroupStateMisuse(): ReactElement | null {
  // @ts-expect-error the groupId is a string, never a number.
  usePanelGroupState(42);
  const groupState = usePanelGroupState("main");
  // @ts-expect-error the snapshot is undefined until published — narrow first.
  return <span>{groupState.containerSize}</span>;
}
void GroupStateMisuse;
