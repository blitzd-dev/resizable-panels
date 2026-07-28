import {
  Panel,
  PanelGroup,
  type PanelGroupValue,
  type PanelLocator,
  PanelProvider,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useEffect, useState } from "react";
import { MiniPanel } from "@/components/showcase/mini-demo";
import { Button } from "@/components/ui/button";
import {
  type ArenaFixtureProps,
  type ArenaScenario,
  ArenaSurface,
  busyWait,
  fmtValue,
  groupEventProps,
  PanelProbe,
} from "./arena-kit";

/**
 * Arena cards that adjudicate specific findings from
 * docs/release-prep/FINDINGS.md. When a finding is fixed, its card stays —
 * it becomes the regression check for the next iteration.
 */

// ─── R-01: provider registry staleness on remount ────────────────────────────

// Module-constant locators: PanelProbe is memoized so it updates only via its
// own store subscription; an inline locator object would defeat that and let
// card re-renders mask dead subscriptions (see PanelProbe's doc comment).
const R01_SIDE: PanelLocator = { groupId: "arena-r01", panelId: "side" };

function R01Fixture({ log }: ArenaFixtureProps) {
  const [mounted, setMounted] = useState(true);
  return (
    <PanelProvider>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="xs"
            variant="secondary"
            onClick={() => {
              log(
                "info",
                `${mounted ? "unmounting" : "mounting"} identified panel`,
              );
              setMounted((value) => !value);
            }}
          >
            {mounted ? "Unmount" : "Mount"} identified panel
          </Button>
          <PanelProbe locator={R01_SIDE} label="toolbar" log={log} />
        </div>
        <ArenaSurface>
          <PanelGroup
            orientation="horizontal"
            groupId="arena-r01"
            {...groupEventProps(log)}
          >
            {mounted ? (
              <>
                <Panel
                  side="start"
                  panelId="side"
                  defaultSize={200}
                  minSize={120}
                >
                  <MiniPanel label="side (identified)" />
                </Panel>
                <PanelResizeHandle />
              </>
            ) : null}
            <Panel>
              <MiniPanel label="anonymous peer" />
            </Panel>
          </PanelGroup>
        </ArenaSurface>
      </div>
    </PanelProvider>
  );
}

const r01: ArenaScenario = {
  slug: "r01-registry-remount",
  title: "External probe survives identified-panel remount",
  finding: "R-01",
  steps: [
    "Confirm the toolbar probe shows the side panel's sizes.",
    "Click “Unmount identified panel” — probe must show undefined.",
    "Click “Mount identified panel” again.",
  ],
  expect: [
    "After remount the probe resolves again (pref/rendered px, live).",
    "Dragging the handle updates the probe in real time.",
  ],
  suspect:
    "R-01 fixed 2026-07-17 (provider registry is no longer deleted on last unregister). This card is now the standing regression check: any FAIL here is a reintroduction.",
  Fixture: R01Fixture,
};

// ─── R-02: click-without-move on an over-constrained layout ──────────────────

const R02_LEFT: PanelLocator = { groupId: "arena-r02", panelId: "left" };
const R02_RIGHT: PanelLocator = { groupId: "arena-r02", panelId: "right" };

function R02Fixture({ log }: ArenaFixtureProps) {
  return (
    <PanelProvider>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PanelProbe locator={R02_LEFT} label="left" />
          <PanelProbe locator={R02_RIGHT} label="right" />
        </div>
        {/* 520px container vs 300+300 preferred + 80 peer floor = over-constrained:
            both dockeds render below their preferred size. */}
        <ArenaSurface width={520}>
          <PanelGroup
            orientation="horizontal"
            groupId="arena-r02"
            {...groupEventProps(log)}
          >
            <Panel side="start" panelId="left" defaultSize={300} minSize={150}>
              <MiniPanel label="left · pref 300" />
            </Panel>
            <PanelResizeHandle handleId="left-seam" />
            <Panel minSize={80}>
              <MiniPanel label="peer · min 80" />
            </Panel>
            <PanelResizeHandle handleId="right-seam" />
            <Panel side="end" panelId="right" defaultSize={300} minSize={150}>
              <MiniPanel label="right · pref 300" />
            </Panel>
          </PanelGroup>
        </ArenaSurface>
      </div>
    </PanelProvider>
  );
}

const r02: ArenaScenario = {
  slug: "r02-no-move-click",
  title: "Click a handle without moving (over-constrained group)",
  finding: "R-02",
  steps: [
    "Confirm both probes show rendered < pref (the layout is over-constrained).",
    "Clear the log.",
    "Press and release a seam WITHOUT moving the pointer.",
  ],
  expect: [
    "NOTHING is logged — no lifecycle pair and no onValueChange. A no-move click emits nothing (R-03: the lifecycle brackets actual movement).",
    "Probes: preferred sizes unchanged by the click.",
  ],
  suspect:
    "R-02 fixed 2026-07-17 (pointer-down no longer syncs preferred←rendered); R-03 (same day) tightened the contract further — a no-move session emits nothing at all. This card is now the standing regression check: any FAIL here is a reintroduction. Covered by e2e overconstrained-no-move-click.spec.ts.",
  Fixture: R02Fixture,
};

// ─── R-03: lifecycle asymmetry at coincident handles ─────────────────────────

function R03Fixture({ log }: ArenaFixtureProps) {
  return (
    <PanelProvider>
      <div className="flex flex-col gap-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          A · normal seam
        </div>
        <ArenaSurface className="h-16">
          <PanelGroup
            orientation="horizontal"
            groupId="arena-r03a"
            {...groupEventProps(log, "A")}
          >
            <Panel panelId="left" minSize={60}>
              <MiniPanel label="left" />
            </Panel>
            <PanelResizeHandle handleId="hA" />
            <Panel panelId="right" minSize={60}>
              <MiniPanel label="right" />
            </Panel>
          </PanelGroup>
        </ArenaSurface>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          B · coincident seam (zero-width peer between two handles)
        </div>
        <ArenaSurface className="h-16">
          <PanelGroup
            orientation="horizontal"
            groupId="arena-r03b"
            {...groupEventProps(log, "B")}
          >
            <Panel panelId="left" minSize={60}>
              <MiniPanel label="left" />
            </Panel>
            <PanelResizeHandle handleId="h1" />
            <Panel panelId="zero" defaultSize={0}>
              <MiniPanel label="zero" />
            </Panel>
            <PanelResizeHandle handleId="h2" />
            <Panel panelId="right" minSize={60}>
              <MiniPanel label="right" />
            </Panel>
          </PanelGroup>
        </ArenaSurface>
      </div>
    </PanelProvider>
  );
}

const r03: ArenaScenario = {
  slug: "r03-coincident-lifecycle",
  title: "Resize lifecycle parity: normal vs coincident handles",
  finding: "R-03",
  steps: [
    "Clear the log.",
    "In A: press and release the seam without moving.",
    "In B: press and release the (single visible) seam without moving.",
    "In B: drag the seam a few px and release.",
    "In B: press the LEFT half of the seam and drag right (then the RIGHT half and drag left) — watch which handle lights up.",
    "In B: open the zero panel a little, then drag its right seam back onto the left one and HOLD at the converged position; release.",
    "In B: with the seams converged, slowly approach the shared seam from the LEFT, then from the RIGHT, then sweep slowly across the seam's midline; then move focus onto each handle with the keyboard.",
  ],
  expect: [
    "A and B behave IDENTICALLY.",
    "Click-no-move: NOTHING is logged in either group — the lifecycle brackets actual movement, never the press.",
    "Drag: exactly one start/end pair attributed to the handle that took ownership.",
    "During a drag on B's coincident seam, the white active highlight (and any range-limit state) sits on the handle whose seam is moving — the session owner — never on the pressed-but-stationary half (R-22). Both clear on release.",
    "While HOLDING at the converged position, the dragged handle's white line stays visible — it must not vanish 'under' the stationary handle's gray line (R-24). After release, exactly one resting line remains at the shared coordinate.",
    "Hovering EITHER half of the converged seam lights ONE stable line — the same line from either half, lit while the cursor is anywhere in the shared hit area, and sweeping across the hit-area midline never swaps which line is lit or nudges it by a pixel (R-26/R-28: the seam presents as one handle, never two with a 1px highlight jump). Keyboard focus on a coincident handle lights that handle's line the same way.",
  ],
  suspect:
    "R-03 fixed 2026-07-17 (every pointer session now arms at press and begins on the first qualifying move — normal handles adopted the coincident path's deferred start, so lifecycle no longer depends on invisible layout state). R-22 fixed 2026-07-18 (data-active/data-limited/z-index now follow the session-owning handle the group publishes, not the handle holding pointer capture). R-24 fixed 2026-07-18 (the line-visibility dedup now prefers the session-owning handle at a shared coordinate, so the active line survives mid-drag convergence). R-26 fixed 2026-07-18 (handles publish hover/visible-focus so hovering either half lights the seam). R-28 fixed 2026-07-18 (run-level hover presentation: the run elects one stable line — session owner > keyboard focus > DOM order — and hover anywhere in the shared hit area lights it without moving it, so the midline sweep no longer swaps lines). This card is now the standing regression check for all five: any FAIL here is a reintroduction.",
  Fixture: R03Fixture,
};

// ─── R-04: controlled mode under main-thread jank ────────────────────────────

function R04Fixture({ log }: ArenaFixtureProps) {
  const [value, setValue] = useState<PanelGroupValue>({
    side: { size: 220, collapsed: false },
  });
  const [jank, setJank] = useState(false);
  const { onResizeStart, onResizeEnd } = groupEventProps(log);
  return (
    <PanelProvider>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="xs"
            variant={jank ? "default" : "outline"}
            onClick={() => setJank((v) => !v)}
          >
            Jank in onValueChange: {jank ? "ON (120ms)" : "off"}
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              log("info", "blocking main thread 300ms");
              busyWait(300);
            }}
          >
            Block main thread 300ms now
          </Button>
          <span className="font-mono text-[10px] text-muted-foreground">
            value: {fmtValue(value)}
          </span>
        </div>
        <ArenaSurface>
          <PanelGroup
            orientation="horizontal"
            groupId="arena-r04"
            value={value}
            onValueChange={(next, details) => {
              log(
                "value",
                `proposal ${details.reason}/${details.trigger} → ${fmtValue(next)}`,
              );
              if (jank) busyWait(120);
              setValue(next);
            }}
            onResizeStart={onResizeStart}
            onResizeEnd={onResizeEnd}
          >
            <Panel side="start" panelId="side" defaultSize={220} minSize={100}>
              <MiniPanel label="side (controlled)" />
            </Panel>
            <PanelResizeHandle />
            <Panel>
              <MiniPanel label="main" />
            </Panel>
          </PanelGroup>
        </ArenaSurface>
      </div>
    </PanelProvider>
  );
}

const r04: ArenaScenario = {
  slug: "r04-controlled-jank",
  title: "Controlled group: proposals under main-thread jank",
  finding: "R-04",
  steps: [
    "Drag the seam smoothly with jank OFF; release. Note the proposal stream.",
    "Turn jank ON; drag again for ~2 seconds; release.",
    "After release, press “Block main thread 300ms now”, then drag once more.",
  ],
  expect: [
    "Every proposal reflects real movement — no duplicate emissions of an unchanged value, no echo of the committed prop after release.",
    "The final proposal equals where the seam visually settled AND equals onResizeEnd's value — a hard guarantee now, even with jank ON and an aggressive reversal right before release (the R-04 failure shape).",
    "The value line above matches the rendered layout once dragging stops.",
  ],
  suspect:
    "R-04 fixed 2026-07-18: session end is causally ordered — endResize emits the final session value through the ledger (emitFinalResizeValue, deduplicated against the last emitted proposal) BEFORE onResizeEnd fires and BEFORE the controlled re-commit reopens the one-frame echo-suppression window, so the pointer-up flush can no longer be swallowed as an echo under jank. This card is the standing regression check: a drag ending with a proposal/end-value disagreement is a reintroduction. Covered by change-ledger unit tests and the state-api e2e R-04 invariant test.",
  Fixture: R04Fixture,
};

// ─── R-05: string defaults on a slow-settling container ──────────────────────

const R05A_HALF: PanelLocator = { groupId: "arena-r05a", panelId: "half" };
const R05B_HALF: PanelLocator = { groupId: "arena-r05b", panelId: "half" };

function SlowBootstrapGroup({
  groupId,
  locator,
  growDelayMs,
  label,
  log,
}: {
  groupId: string;
  locator: PanelLocator;
  growDelayMs: number;
  label: string;
  log: ArenaFixtureProps["log"];
}) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWide(true), growDelayMs);
    return () => clearTimeout(timer);
  }, [growDelayMs]);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Button
          size="xs"
          variant="outline"
          onClick={() => setWide((value) => !value)}
        >
          Width → {wide ? 320 : 640}
        </Button>
        <PanelProbe locator={locator} label={groupId} log={log} />
      </div>
      <div
        data-resizable-panels-demo-frame=""
        className="h-16 overflow-hidden rounded-lg border border-border bg-muted p-1"
        style={{
          width: wide ? 640 : 320,
          maxWidth: "100%",
          transition: "width 400ms ease-out",
        }}
      >
        <PanelGroup orientation="horizontal" groupId={groupId}>
          <Panel side="start" panelId="half" defaultSize="50%" minSize={40}>
            <MiniPanel label='"50%"' />
          </Panel>
          <PanelResizeHandle />
          <Panel>
            <MiniPanel label="peer" />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

function R05Fixture({ log }: ArenaFixtureProps) {
  useEffect(() => {
    log(
      "info",
      "both containers end at 640px; A grows immediately, B pauses 400ms at 320px first",
    );
  }, [log]);
  return (
    <PanelProvider>
      <div className="flex flex-col gap-3">
        <SlowBootstrapGroup
          groupId="arena-r05a"
          locator={R05A_HALF}
          growDelayMs={0}
          label="A · grows immediately"
          log={log}
        />
        <SlowBootstrapGroup
          groupId="arena-r05b"
          locator={R05B_HALF}
          growDelayMs={400}
          label="B · quiet 400ms, then grows"
          log={log}
        />
      </div>
    </PanelProvider>
  );
}

const r05: ArenaScenario = {
  slug: "r05-slow-bootstrap",
  title: 'String default ("50%") vs slow-settling containers',
  finding: "R-05",
  steps: [
    "Press Remount and watch both probes.",
    "Wait ~1.5s for everything to go quiet — both groups must settle identically.",
    "Press “Width → 320” on either group: its probe keeps tracking (pref follows the container — the default is still live).",
    "Drag the seam in that group, then toggle its width again: pref no longer moves (the drag committed a fixed px preference).",
  ],
  expect: [
    "Identical markup ends identical: both groups settle with pref ≈ 315 (50% of the 640px frame's inner width) regardless of B's 400ms pause.",
    "Before any drag, container changes keep moving pref — string defaults track their container indefinitely; there is no commit-on-idle window.",
    "After a drag, further container changes leave pref fixed (only rendered clamping applies).",
  ],
  suspect:
    "R-05 fixed 2026-07-17 (the 150ms bootstrap idle-timer is deleted; string defaults are live until a drag/imperative action/restore commits pixels — persistence still restores stored px snapshots). This card is now the standing regression check: any FAIL here is a reintroduction. Covered by e2e string-default-live-tracking.spec.ts and initial-paint.spec.ts.",
  Fixture: R05Fixture,
};

export const FINDING_SCENARIOS: ArenaScenario[] = [r01, r02, r03, r04, r05];
