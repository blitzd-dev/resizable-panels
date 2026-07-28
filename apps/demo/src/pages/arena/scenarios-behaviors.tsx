import {
  Panel,
  type PanelApi,
  PanelGroup,
  type PanelLocator,
  PanelProvider,
  PanelResizeHandle,
  type PanelStorage,
} from "@blitzd/resizable-panels";
import { useRef, useState } from "react";
import { MiniPanel, ToggleButton } from "@/components/showcase/mini-demo";
import { Button } from "@/components/ui/button";
import {
  type ArenaFixtureProps,
  type ArenaScenario,
  ArenaSurface,
  fmtValue,
  groupEventProps,
  PanelProbe,
} from "./arena-kit";

/**
 * Arena cards for the hardest interaction behaviors — the contracts most
 * likely to silently regress while the unit/e2e suites stay green. These
 * are not tied to a specific finding; they are the standing manual
 * regression sweep.
 */

// Module-constant locators — PanelProbe is memoized and must receive stable
// locator identities to update only through its own store subscription.
const RACE_SIDE: PanelLocator = { groupId: "arena-race", panelId: "side" };
const HYST_COL: PanelLocator = { groupId: "arena-hyst", panelId: "col" };
const CONTROLLED_SIDE: PanelLocator = {
  groupId: "arena-controlled",
  panelId: "side",
};
const RTL_NAV: PanelLocator = { groupId: "arena-rtl", panelId: "nav" };
const KB_PANEL: PanelLocator = { groupId: "arena-kb", panelId: "kb" };
const ZERO_ZED: PanelLocator = { groupId: "arena-zero", panelId: "zed" };
const LATCH_LEFT: PanelLocator = { groupId: "arena-latch", panelId: "left" };
const LATCH_MID: PanelLocator = { groupId: "arena-latch", panelId: "mid" };
const PCT_PROPORTIONAL: PanelLocator = {
  groupId: "arena-pct-proportional",
  panelId: "side",
};
const PCT_FIXED: PanelLocator = { groupId: "arena-pct-fixed", panelId: "side" };

/** Render a persisted document as the compact `side:380` form for the log. */
function shortDoc(value: string): string {
  try {
    const parsed = JSON.parse(value) as {
      panels?: Record<string, { size: number; collapsed?: boolean }>;
    };
    return parsed.panels ? fmtValue(parsed.panels) : value;
  } catch {
    return value;
  }
}

// ─── persistence: async restore racing an early drag ─────────────────────────

const raceMemory = new Map<string, string>();
const RACE_KEY = "arena-restore-race";
const raceSeedDoc = () =>
  JSON.stringify({
    version: 1,
    orientation: "horizontal",
    panels: { side: { size: 380, collapsed: false } },
  });
raceMemory.set(RACE_KEY, raceSeedDoc());

function RestoreRaceFixture({ log }: ArenaFixtureProps) {
  const [storage] = useState<PanelStorage>(() => ({
    getItem: (key) => {
      log("persist", "getItem… (resolves in 1.5s)");
      return new Promise((resolve) =>
        setTimeout(() => resolve(raceMemory.get(key) ?? null), 1500),
      );
    },
    setItem: (key, value) => {
      raceMemory.set(key, value);
      log("persist", `setItem ← ${shortDoc(value)}`);
    },
  }));
  return (
    <PanelProvider>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              raceMemory.set(RACE_KEY, raceSeedDoc());
              log("info", "re-seeded stored value side=380");
            }}
          >
            Re-seed side=380
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              raceMemory.delete(RACE_KEY);
              log("info", "cleared stored value");
            }}
          >
            Clear stored
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              const stored = raceMemory.get(RACE_KEY);
              log("info", `stored = ${stored ? shortDoc(stored) : "(empty)"}`);
            }}
          >
            Dump stored
          </Button>
          <PanelProbe locator={RACE_SIDE} label="side" />
        </div>
        <ArenaSurface>
          <PanelGroup
            orientation="horizontal"
            groupId="arena-race"
            persistence={{
              key: RACE_KEY,
              storage,
              onError: (error) =>
                log(
                  "error",
                  `persist ${error.operation}: ${String(error.error)}`,
                ),
              onStatusChange: (status) =>
                log("persist", `status → ${status.state}`),
            }}
            {...groupEventProps(log)}
          >
            <Panel side="start" panelId="side" defaultSize={220} minSize={100}>
              <MiniPanel label="side · default 220" />
            </Panel>
            <PanelResizeHandle />
            <Panel>
              <MiniPanel label="peer" />
            </Panel>
          </PanelGroup>
        </ArenaSurface>
      </div>
    </PanelProvider>
  );
}

const restoreRace: ArenaScenario = {
  slug: "persist-restore-race",
  title: "Async restore racing an early drag",
  steps: [
    "Press “Re-seed side=380”, then Remount. Panel mounts at its 220 default while the 1.5s read is pending.",
    "BEFORE the read resolves, drag the seam to a clearly different size (e.g. ~300).",
    "Wait past the 1.5s mark; then “Dump stored”.",
    "Remount once more WITHOUT touching anything and just wait.",
  ],
  expect: [
    "Your drag wins: no snap to 380 when the late read lands; status logs restoring → ready exactly once per mount.",
    "The stored value ends near your dragged size, not 380.",
    "The untouched remount DOES restore the stored value (instant, no animation).",
  ],
  Fixture: RestoreRaceFixture,
};

// ─── persistence: injected storage failures ──────────────────────────────────

const failMemory = new Map<string, string>();
const FAIL_KEY = "arena-storage-failure";

function StorageFailureFixture({ log }: ArenaFixtureProps) {
  const failReadRef = useRef(false);
  const failWriteRef = useRef(false);
  const [failRead, setFailRead] = useState(false);
  const [failWrite, setFailWrite] = useState(false);
  const [storage] = useState<PanelStorage>(() => ({
    getItem: (key) => {
      if (failReadRef.current) {
        log("persist", "getItem → throwing (injected)");
        throw new Error("injected read failure");
      }
      const value = failMemory.get(key) ?? null;
      log("persist", `getItem → ${value ? shortDoc(value) : "null"}`);
      return value;
    },
    setItem: (key, value) => {
      if (failWriteRef.current) {
        log("persist", "setItem → throwing (injected)");
        throw new Error("injected write failure");
      }
      failMemory.set(key, value);
      log("persist", `setItem ← ${shortDoc(value)}`);
    },
  }));
  return (
    <PanelProvider>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="xs"
            variant={failWrite ? "default" : "outline"}
            onClick={() => {
              failWriteRef.current = !failWriteRef.current;
              setFailWrite(failWriteRef.current);
              log(
                "info",
                `fail writes: ${failWriteRef.current ? "ON" : "off"}`,
              );
            }}
          >
            Fail writes: {failWrite ? "ON" : "off"}
          </Button>
          <Button
            size="xs"
            variant={failRead ? "default" : "outline"}
            onClick={() => {
              failReadRef.current = !failReadRef.current;
              setFailRead(failReadRef.current);
              log("info", `fail reads: ${failReadRef.current ? "ON" : "off"}`);
            }}
          >
            Fail reads: {failRead ? "ON" : "off"}
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              const stored = failMemory.get(FAIL_KEY);
              log("info", `stored = ${stored ? shortDoc(stored) : "(empty)"}`);
            }}
          >
            Dump stored
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              failMemory.delete(FAIL_KEY);
              log("info", "cleared stored value");
            }}
          >
            Clear stored
          </Button>
        </div>
        <ArenaSurface>
          <PanelGroup
            orientation="horizontal"
            groupId="arena-fail"
            persistence={{
              key: FAIL_KEY,
              storage,
              onError: (error) =>
                log(
                  "error",
                  `persist ${error.operation}: ${String(error.error)}`,
                ),
              onStatusChange: (status) =>
                log("persist", `status → ${status.state}`),
            }}
            {...groupEventProps(log)}
          >
            <Panel side="start" panelId="side" defaultSize={200} minSize={100}>
              <MiniPanel label="side" />
            </Panel>
            <PanelResizeHandle />
            <Panel>
              <MiniPanel label="peer" />
            </Panel>
          </PanelGroup>
        </ArenaSurface>
      </div>
    </PanelProvider>
  );
}

const storageFailure: ArenaScenario = {
  slug: "persist-storage-failure",
  title: "Storage failure injection (read + write paths)",
  steps: [
    "Turn “Fail writes” ON, drag the seam, release. Then turn it off and drag again.",
    "Turn “Fail reads” ON and press Remount.",
    "With reads still failing, drag the seam once, then “Dump stored”.",
  ],
  expect: [
    "Failed writes surface through onError (once per failed flush, not per frame); layout keeps working; a later successful drag writes normally.",
    "Failed read on remount: onError read fires, layout falls back to defaults, and storage is NOT overwritten just by mounting.",
    "After the first explicit drag, the write gate reopens: the dump shows your new layout.",
  ],
  Fixture: StorageFailureFixture,
};

// ─── collapseBelow hysteresis ────────────────────────────────────────────────

function HysteresisFixture({ log }: ArenaFixtureProps) {
  return (
    <PanelProvider>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ToggleButton groupId="arena-hyst" panelId="col" label="col" />
          <PanelProbe locator={HYST_COL} label="col" />
          <span className="text-[10px] text-muted-foreground">
            min 180 · collapseBelow 120 · hysteresis 24 · rail 8
          </span>
        </div>
        <ArenaSurface>
          <PanelGroup
            orientation="horizontal"
            groupId="arena-hyst"
            {...groupEventProps(log)}
          >
            <Panel
              side="start"
              panelId="col"
              defaultSize={260}
              minSize={180}
              collapseBelow={120}
              collapseBelowHysteresis={24}
              collapsedSize={8}
              resizableWhenCollapsed
              onCollapsedChange={(collapsed, details) =>
                log(
                  "panel",
                  `col collapsed=${collapsed} (${details.reason}/${details.trigger})`,
                )
              }
            >
              <MiniPanel label="col" />
            </Panel>
            <PanelResizeHandle />
            <Panel>
              <MiniPanel label="peer" />
            </Panel>
          </PanelGroup>
        </ArenaSurface>
      </div>
    </PanelProvider>
  );
}

const hysteresis: ArenaScenario = {
  slug: "collapse-hysteresis",
  title: "collapseBelow thresholds + hysteresis, both directions",
  steps: [
    "Drag the seam inward slowly. The panel body holds at min 180 until the POINTER crosses 120, then collapses to the 8px rail.",
    "WITHOUT releasing, drag back out. It must stay collapsed until you pass ~180, then reopen.",
    "Release while collapsed. Start a NEW outward drag from the rail.",
    "Rapidly wiggle across the boundary a few times.",
  ],
  expect: [
    "Collapse triggers live at pointer < 120 (not on release), animated.",
    "Mid-drag reopen requires reaching ≥ 180 — no flapping inside the hysteresis band.",
    "A fresh drag from the collapsed rail also unlocks at ≥ 180.",
    "Rapid reversals never leave a stuck half-state; collapsed flag in the log matches what you see.",
  ],
  Fixture: HysteresisFixture,
};

// ─── controlled collapsed (R-33) ─────────────────────────────────────────────

function ControlledCollapsedFixture({ log }: ArenaFixtureProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [accept, setAccept] = useState(true);
  // Proposals arrive synchronously from library internals; read the live
  // mode through a ref so an in-flight gesture sees the latest switch.
  const acceptRef = useRef(accept);
  acceptRef.current = accept;
  return (
    <PanelProvider>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              setCollapsed((current) => {
                log("info", `parent set collapsed=${!current} (external)`);
                return !current;
              });
            }}
          >
            {collapsed ? "Expand" : "Collapse"} side (parent state)
          </Button>
          <Button
            size="xs"
            variant={accept ? "default" : "outline"}
            onClick={() => {
              log("info", `mode → ${accept ? "decline" : "accept"}`);
              setAccept((current) => !current);
            }}
          >
            mode: {accept ? "accept" : "decline"}
          </Button>
          <PanelProbe locator={CONTROLLED_SIDE} label="side" />
          <span className="text-[10px] text-muted-foreground">
            controlled collapsed · min 160 · collapseBelow 100
          </span>
        </div>
        <ArenaSurface>
          <PanelGroup
            orientation="horizontal"
            groupId="arena-controlled"
            {...groupEventProps(log)}
          >
            <Panel
              side="start"
              panelId="side"
              defaultSize={240}
              minSize={160}
              collapseBelow={100}
              collapsed={collapsed}
              onCollapsedChange={(next, details) => {
                log(
                  "panel",
                  `side PROPOSAL collapsed=${next} (${details.reason}/${details.trigger}) → ${
                    acceptRef.current ? "accepted" : "declined"
                  }`,
                );
                if (acceptRef.current) setCollapsed(next);
              }}
            >
              <MiniPanel
                label={`side · parent says ${collapsed ? "collapsed" : "expanded"}`}
              />
            </Panel>
            <PanelResizeHandle />
            <Panel>
              <MiniPanel label="peer" />
            </Panel>
          </PanelGroup>
        </ArenaSurface>
      </div>
    </PanelProvider>
  );
}

const controlledCollapsed: ArenaScenario = {
  slug: "controlled-collapsed",
  title: "Controlled collapsed: proposals, accept/decline, drag snap-back",
  finding: "R-33",
  steps: [
    "Press “Collapse side (parent state)”, then again to expand — this drives the prop directly.",
    "In accept mode, drag the seam inward past collapseBelow (pointer < 100) and release; then expand via the parent button.",
    "Switch to decline mode. Drag past collapseBelow again, hold a moment, then release.",
    "Still declining: press Tab/click the seam and hit Enter; also try the probe's imperative toggle if you use one.",
  ],
  expect: [
    "The parent button animates the panel closed/open with NO proposal entries in the log — a prop change is steering, not a change event.",
    "Accept-mode drag: exactly ONE `side PROPOSAL collapsed=true (collapse/pointer)` at the crossing, the parent accepts, and the panel stays collapsed after release — never a second onCollapsedChange from the acceptance.",
    "Decline-mode drag: the gesture still PRESENTS the collapse live (the threshold motion plays), but on release the panel snaps back to the expanded prop state at its preserved width. The probe's collapsed flag stays `false` (effective = prop) throughout.",
    "Decline-mode Enter: logs a `collapse/keyboard` proposal and nothing moves.",
  ],
  suspect:
    "R-33 implemented 2026-07-19: `collapsed` mirrors the group's controlled `value` — the prop is authoritative, onCollapsedChange is the proposal channel, drag-past-collapseBelow presents live and snaps back like a declined controlled-group proposal (endResize re-commits the prop). FAIL if an interaction flips the panel without the parent accepting, if acceptance double-fires onCollapsedChange, if a declined drag leaves the panel collapsed after release, or if the probe's collapsed flag follows the gesture instead of the prop (unit: controlled-collapsed.test.tsx; e2e: controlled-collapsed.spec.ts).",
  Fixture: ControlledCollapsedFixture,
};

// ─── cascade latching (R-25) ─────────────────────────────────────────────────

function CascadeLatchingFixture({ log }: ArenaFixtureProps) {
  return (
    <PanelProvider>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PanelProbe locator={LATCH_LEFT} label="left" />
          <PanelProbe locator={LATCH_MID} label="mid" />
          <span className="text-[10px] text-muted-foreground">
            cascade=&quot;latching&quot; · reversal dead-band 2px
          </span>
        </div>
        <ArenaSurface>
          <PanelGroup
            orientation="horizontal"
            groupId="arena-latch"
            cascade="latching"
            {...groupEventProps(log)}
          >
            <Panel panelId="left" defaultSize={150} minSize={100}>
              <MiniPanel label="left · 150 (min 100)" />
            </Panel>
            <PanelResizeHandle handleId="h1" />
            <Panel panelId="mid" defaultSize={100} minSize={20}>
              <MiniPanel label="mid · 100 (min 20)" />
            </Panel>
            <PanelResizeHandle handleId="h2" />
            <Panel panelId="right" minSize={100}>
              <MiniPanel label="right" />
            </Panel>
          </PanelGroup>
        </ArenaSurface>
      </div>
    </PanelProvider>
  );
}

const cascadeLatching: ArenaScenario = {
  slug: "cascade-latching",
  title: 'cascade="latching": mid-drag reversal keeps pushed panels pushed',
  finding: "R-25",
  steps: [
    "Drag the mid|right seam (h2) left until mid bottoms at its 20px min and the cascade pushes left below its default (~110 per the probe).",
    "WITHOUT releasing, drag back to the right ~60px and hold.",
    "Fresh drag: push left again, wiggle the pointer ±1px a few times mid-push, continue to the same depth, release.",
    "Compare the log's onResizeEnd initialValue with the sizes at session start.",
  ],
  expect: [
    "On the held reversal, mid regrows FIRST and left KEEPS its pushed size — the cascade does not unwind (the default reversible mode restores left to 150 before mid regrows).",
    "±1px wiggles never latch: the push with jitter lands at the same sizes as a clean push — no space is silently transferred by pointer noise.",
    "NOT A FAILURE: pushes of ≤2px give back on reversal — a sub-dead-band push is indistinguishable from jitter, so it unwinds. The latch engages beyond 2px, and give-back is bounded at ±2px (wiggling can never accumulate). Owner-approved 2026-07-18.",
    "onResizeEnd still reports the ORIGINAL session-start value as initialValue; probes and events never expose the internal rebase.",
  ],
  suspect:
    'R-25 implemented 2026-07-18 (user-approved addendum): group-level cascade="reversible" (default; transaction semantics byte-for-byte unchanged) | "latching" (one-way pushes within a held drag — the session rebases at the applied directional extreme once the pointer reverses beyond a 2px dead-band derived from the click-vs-drag threshold). e2e: cascade-latching.spec.ts. This card is the standing regression check for the latch semantics.',
  Fixture: CascadeLatchingFixture,
};

// ─── RTL ─────────────────────────────────────────────────────────────────────

function RtlFixture({ log }: ArenaFixtureProps) {
  return (
    <PanelProvider>
      <div className="flex flex-col gap-2">
        <PanelProbe locator={RTL_NAV} label="nav" />
        <ArenaSurface>
          <PanelGroup
            orientation="horizontal"
            dir="rtl"
            groupId="arena-rtl"
            {...groupEventProps(log)}
          >
            <Panel side="start" panelId="nav" defaultSize={200} minSize={100}>
              <MiniPanel label="nav (side=start → docks RIGHT in RTL)" />
            </Panel>
            <PanelResizeHandle />
            <Panel>
              <MiniPanel label="peer" />
            </Panel>
          </PanelGroup>
        </ArenaSurface>
      </div>
    </PanelProvider>
  );
}

const rtl: ArenaScenario = {
  slug: "rtl-horizontal",
  title: "RTL group: pointer and keyboard direction mapping",
  steps: [
    'Confirm the nav panel docks on the RIGHT edge (side="start" follows dir).',
    "Drag the seam left and right.",
    "Focus the seam (click it), then press ArrowLeft / ArrowRight / Home / End.",
  ],
  expect: [
    "The seam tracks the pointer 1:1 — no mirrored/inverted movement.",
    "ArrowRight moves the seam visually right; ArrowLeft visually left.",
    "Growing the nav panel = seam moves left (nav docks right); probe agrees.",
  ],
  Fixture: RtlFixture,
};

// ─── nested groups: instant vs animated collapse ─────────────────────────────

function NestedInstantFixture({ log }: ArenaFixtureProps) {
  const navApi = useRef<PanelApi>(null);
  return (
    <PanelProvider>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="xs"
            variant="secondary"
            onClick={() => {
              log("info", "nav.toggle() — animated");
              navApi.current?.toggle();
            }}
          >
            Toggle nav (animated)
          </Button>
          <Button
            size="xs"
            variant="secondary"
            onClick={() => {
              log("info", 'nav.toggle({transition:"none"}) — instant');
              navApi.current?.toggle({ transition: "none" });
            }}
          >
            Toggle nav (instant)
          </Button>
        </div>
        <ArenaSurface className="h-40">
          <PanelGroup
            orientation="horizontal"
            groupId="arena-nested"
            {...groupEventProps(log, "outer")}
          >
            <Panel
              side="start"
              panelId="nav"
              defaultSize={170}
              minSize={120}
              apiRef={navApi}
            >
              <MiniPanel label="nav" />
            </Panel>
            <PanelResizeHandle />
            <Panel>
              <PanelGroup
                orientation="vertical"
                groupId="arena-nested-inner"
                {...groupEventProps(log, "inner")}
              >
                <Panel minSize={40}>
                  <MiniPanel label="editor" />
                </Panel>
                <PanelResizeHandle />
                <Panel
                  side="end"
                  panelId="terminal"
                  defaultSize={60}
                  minSize={40}
                >
                  <MiniPanel label="terminal" />
                </Panel>
              </PanelGroup>
            </Panel>
          </PanelGroup>
        </ArenaSurface>
      </div>
    </PanelProvider>
  );
}

const nestedInstant: ArenaScenario = {
  slug: "nested-instant-collapse",
  title: "Nested groups: instant collapse must snap the whole layout",
  steps: [
    "Press “Toggle nav (animated)” a few times — watch the seams.",
    "Press “Toggle nav (instant)” a few times.",
    "After each toggle, drag the inner horizontal seam (editor/terminal).",
  ],
  expect: [
    "Animated: nav and the main region move together smoothly; the inner vertical split is undisturbed.",
    "Instant: the ENTIRE layout snaps in one paint — no member animates late or staggers.",
    "Inner group emits no value events from outer toggles (terminal height untouched).",
  ],
  Fixture: NestedInstantFixture,
};

// ─── nested groups: animation integrity at three levels (R-31) ───────────────

function NestedAnimationIntegrityFixture({ log }: ArenaFixtureProps) {
  const dockApi = useRef<PanelApi>(null);
  const bottomApi = useRef<PanelApi>(null);
  return (
    <PanelProvider>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="xs"
            variant="secondary"
            onClick={() => {
              log("info", "dock.toggle() — animated");
              dockApi.current?.toggle();
            }}
          >
            Toggle dock (animated)
          </Button>
          <Button
            size="xs"
            variant="secondary"
            onClick={() => {
              log("info", "bottom.toggle() — animated (cross-axis control)");
              bottomApi.current?.toggle();
            }}
          >
            Toggle bottom (animated)
          </Button>
        </div>
        <ArenaSurface className="h-56">
          <PanelGroup
            orientation="horizontal"
            groupId="arena-nai"
            {...groupEventProps(log, "outer")}
          >
            <Panel
              side="start"
              panelId="dock"
              defaultSize={180}
              minSize={120}
              apiRef={dockApi}
            >
              <MiniPanel label="dock" />
            </Panel>
            <PanelResizeHandle />
            <Panel>
              <PanelGroup
                orientation="vertical"
                groupId="arena-nai-center"
                {...groupEventProps(log, "center")}
              >
                <Panel minSize={60}>
                  <PanelGroup
                    orientation="horizontal"
                    groupId="arena-nai-splits"
                    {...groupEventProps(log, "splits")}
                  >
                    <Panel panelId="split-a" defaultSize="50%" minSize={60}>
                      <MiniPanel label="split A" />
                    </Panel>
                    <PanelResizeHandle />
                    <Panel panelId="split-b" minSize={60}>
                      <MiniPanel label="split B" />
                    </Panel>
                  </PanelGroup>
                </Panel>
                <PanelResizeHandle />
                <Panel
                  side="end"
                  panelId="bottom"
                  defaultSize={60}
                  minSize={40}
                  apiRef={bottomApi}
                >
                  <MiniPanel label="bottom" />
                </Panel>
              </PanelGroup>
            </Panel>
          </PanelGroup>
        </ArenaSurface>
      </div>
    </PanelProvider>
  );
}

const nestedAnimationIntegrity: ArenaScenario = {
  slug: "nested-animation-integrity",
  title: "Three-level nesting: dock collapse animates at every level",
  finding: "R-31",
  steps: [
    "Press “Toggle dock (animated)” and watch the dock edge closely; toggle it back open. Repeat a few times.",
    "While the dock animates, watch split A / split B — the splits row shares the outer group's axis, so it reallocates every frame.",
    "Press “Toggle bottom (animated)” as the cross-axis control and watch the vertical seam.",
  ],
  expect: [
    "The dock slides closed and open over ~300ms — it must NEVER snap shut after the first frame or two.",
    "Split A and split B track the growing/shrinking center smoothly, summing to their row on every frame — no tearing, no lag, no late snap.",
    "The bottom toggle animates identically. Note: bottom's collapse produces only CROSS-axis churn in the splits row below it, so it never triggered the bug — it is the control, not the regression probe. The dock toggle is the probe.",
  ],
  suspect:
    "R-31 fixed 2026-07-19: while the dock animated, the same-axis third-level splits row observed main-axis container churn each frame and raised the PROVIDER-wide isResizing flag, stripping transitions from every panel — including the animating dock, which snapped shut (~2 frames in). Transition suppression is now group-local (the splits row suppresses only its own panels; the public usePanelInteractionState readout stays provider-wide). This card is the standing regression check; FAIL if the dock ever snaps instead of sliding, or the splits desync from the center mid-animation (e2e: nested-animation-integrity.spec.ts).",
  Fixture: NestedAnimationIntegrityFixture,
};

// ─── keyboard / pointer parity ───────────────────────────────────────────────

function KeyboardParityFixture({ log }: ArenaFixtureProps) {
  return (
    <PanelProvider>
      <div className="flex flex-col gap-2">
        <PanelProbe locator={KB_PANEL} label="kb" />
        <ArenaSurface>
          <PanelGroup
            orientation="horizontal"
            groupId="arena-kb"
            {...groupEventProps(log)}
          >
            <Panel side="start" panelId="kb" defaultSize={240} minSize={100}>
              <MiniPanel label="kb · default 240" />
            </Panel>
            <PanelResizeHandle handleId="kb-seam" />
            <Panel>
              <MiniPanel label="peer" />
            </Panel>
          </PanelGroup>
        </ArenaSurface>
      </div>
    </PanelProvider>
  );
}

const keyboardParity: ArenaScenario = {
  slug: "keyboard-parity",
  title: "Keyboard and pointer resize reach identical states",
  finding: "R-27/R-29",
  steps: [
    "Click the seam to focus it, then press ArrowLeft exactly 5 times.",
    "Note the final size (should be 240 − 5×10 = 190), then double-click the seam to reset to 240.",
    "Drag the seam 50px left with the pointer; compare the final value.",
    "Try Shift+Arrow (50px) and Alt+Arrow (1px) once each; then Home and End.",
  ],
  expect: [
    "Each arrow press emits exactly ONE value event (resize/keyboard), −10px each; no resizeStart/End lifecycle for keyboard.",
    "Pointer −50px ends at the same 190 the keyboard reached.",
    "Double-click emits a reset event back to 240.",
    "Home/End travel to the range edges reported by the handle's ARIA values.",
  ],
  suspect:
    "R-27 fixed 2026-07-18: clicking the seam now genuinely focuses it — the armed session's preventDefault used to swallow the browser's native click-focus, so step 1 was aspirational (arrows did nothing after a click, and Tab restarted from the top of the page). Focus persists after a drag release too. R-29 fixed 2026-07-18: the lit line keys off keyboard modality (:focus-visible convention), not raw focus — after clicking the seam and moving the pointer away it goes DIM while still focused; the first key press (arrows resize AND light on that same keystroke; even bare Shift lights) upgrades it, and Tab-acquired focus lights immediately. This card is the standing regression check; FAIL if a click leaves the seam unfocused, arrows are dead right after a click or drag, Tab after clicking does not continue from the seam, a clicked seam stays lit after the pointer leaves, or the first arrow press moves the seam without lighting it (e2e: pointer-focus-handoff.spec.ts).",
  Fixture: KeyboardParityFixture,
};

// ─── zero-collapsed reachability (R-18) ──────────────────────────────────────

function ZeroCollapsedFixture({ log }: ArenaFixtureProps) {
  return (
    <PanelProvider>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ToggleButton groupId="arena-zero" panelId="zed" label="zed" />
          <PanelProbe locator={ZERO_ZED} label="zed" />
        </div>
        <ArenaSurface>
          <PanelGroup
            orientation="horizontal"
            groupId="arena-zero"
            {...groupEventProps(log)}
          >
            <Panel
              side="start"
              panelId="zed"
              defaultSize={200}
              minSize={120}
              collapsedSize={0}
              onCollapsedChange={(collapsed, details) =>
                log(
                  "panel",
                  `zed collapsed=${collapsed} (${details.reason}/${details.trigger})`,
                )
              }
            >
              <MiniPanel label="zed · collapses to 0" />
            </Panel>
            <PanelResizeHandle />
            <Panel>
              <MiniPanel label="peer" />
            </Panel>
          </PanelGroup>
        </ArenaSurface>
      </div>
    </PanelProvider>
  );
}

const zeroCollapsed: ArenaScenario = {
  slug: "zero-collapsed-reachability",
  title: "Zero-collapsed panel: Enter reopens, drag stays inert",
  finding: "R-18",
  steps: [
    "Collapse “zed” with the toolbar toggle (it hides completely — rail 0).",
    "Try to drag the seam back open — it must do nothing.",
    "Reach the seam with Tab (it stays focusable), then press Enter.",
    "Collapse again and expand via the toolbar toggle as a cross-check.",
  ],
  expect: [
    "Dragging the zero-collapsed seam stays fully inert: no movement, no resizeStart/End in the log.",
    "The handle keeps tabindex 0 with data-toggle-only (not aria-disabled); Enter expands zed back to its preferred size and logs `zed collapsed=false (expand/keyboard)`.",
    "While the seam has keyboard focus, its separator line is VISIBLE — even at the group edge where resting lines are hidden. You can always SEE where focus is (R-23).",
    "After expanding, the handle is a normal drag handle again (data-toggle-only gone).",
  ],
  suspect:
    "R-18 implemented 2026-07-18: the handle adjacent to a zero-collapsed collapsible panel is toggle-only — focusable, Enter expands, drag disabled by design (e2e: zero-collapsed-toggle.spec.ts). R-23 fixed 2026-07-18: a keyboard-focused handle always renders its separator line, even where content-edge rules hide resting lines, so focus is never invisible (e2e: the R-23 test in zero-collapsed-toggle.spec.ts). This card is the standing regression check; FAIL if the handle is ever unreachable, a drag reopens the panel, or focus on the seam shows nothing.",
  Fixture: ZeroCollapsedFixture,
};

// ─── percentage bounds: proportional vs fixed ────────────────────────────────

/** Both groups declare the SAME panel — `defaultSize="30%"` bounded to
 * [120, 160] px — so `containerResizeBehavior` is the only variable between
 * them. The widths are chosen so BOTH clamps bite inside the card's own
 * width: the group's content box is a little narrower than the button value
 * (the frame has padding), so 30% lands near 81 / 135 / 195 px — under the
 * floor, free, and over the ceiling respectively. */
const PCT_WIDTHS = [280, 460, 660] as const;
const PCT_MIN = 120;
const PCT_MAX = 160;

function PercentageBoundsFixture({ log }: ArenaFixtureProps) {
  const [width, setWidth] = useState<number>(600);
  return (
    <PanelProvider>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            container width
          </span>
          {PCT_WIDTHS.map((candidate) => (
            <Button
              key={candidate}
              size="xs"
              variant={width === candidate ? "default" : "outline"}
              onClick={() => {
                setWidth(candidate);
                log(
                  "info",
                  `container → ${candidate}px · both panels must stay within [${PCT_MIN}, ${PCT_MAX}]px`,
                );
              }}
            >
              {candidate}px
            </Button>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              A · proportional
            </span>
            <PanelProbe locator={PCT_PROPORTIONAL} label="A" />
          </div>
          <ArenaSurface className="h-16" width={width}>
            <PanelGroup
              orientation="horizontal"
              groupId="arena-pct-proportional"
              {...groupEventProps(log, "A")}
            >
              <Panel
                side="start"
                panelId="side"
                defaultSize="30%"
                minSize={PCT_MIN}
                maxSize={PCT_MAX}
                containerResizeBehavior="proportional"
              >
                <MiniPanel label="30% · proportional" />
              </Panel>
              <PanelResizeHandle />
              <Panel>
                <MiniPanel label="main" />
              </Panel>
            </PanelGroup>
          </ArenaSurface>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              B · fixed (same bounds)
            </span>
            <PanelProbe locator={PCT_FIXED} label="B" />
          </div>
          <ArenaSurface className="h-16" width={width}>
            <PanelGroup
              orientation="horizontal"
              groupId="arena-pct-fixed"
              {...groupEventProps(log, "B")}
            >
              <Panel
                side="start"
                panelId="side"
                defaultSize="30%"
                minSize={PCT_MIN}
                maxSize={PCT_MAX}
                containerResizeBehavior="fixed"
              >
                <MiniPanel label="30% · fixed" />
              </Panel>
              <PanelResizeHandle />
              <Panel>
                <MiniPanel label="main" />
              </Panel>
            </PanelGroup>
          </ArenaSurface>
        </div>
      </div>
    </PanelProvider>
  );
}

const percentageBounds: ArenaScenario = {
  slug: "percentage-bounds-behavior",
  title: "Percentage sizing: pixel bounds, proportional vs fixed",
  finding: "R-34",
  steps: [
    "WITHOUT dragging anything, cycle the container through 280 → 460 → 660px and watch both probes.",
    "At 280px, 30% resolves under the 120px floor; at 660px it resolves over the 160px ceiling. Both panels should clamp at both ends.",
    "Now drag A's seam somewhere in range, then cycle the widths again.",
    "Then drag B's seam, and cycle the widths again.",
  ],
  expect: [
    `Neither panel EVER renders outside [${PCT_MIN}, ${PCT_MAX}]px, at any width — bounds re-resolve against the live container and clamp a percentage default at both ends.`,
    "Untouched, both track the container between the bounds — a string default keeps re-resolving like CSS until an interaction commits pixels (R-05).",
    "After its drag, A KEEPS rescaling with the container (proportional preserves the dragged ratio), still inside the bounds.",
    "After its drag, B HOLDS its pixel size as the container changes (fixed) — the sidebar convention. That difference is the whole point of containerResizeBehavior.",
  ],
  suspect:
    'KNOWN FAILING (R-34, found 2026-07-20): B currently VIOLATES its bounds while untouched. An uninteracted string default renders from the raw CSS percentage (inline width="30%"), which no JS clamp applies to — so at 280px B renders ~81px, below its 120px floor. A escapes only because containerResizeBehavior="proportional" makes the allocator rewrite it in clamped pixels every container change. FAIL this card until the fix lands; then it is the standing regression check.',
  Fixture: PercentageBoundsFixture,
};

export const BEHAVIOR_SCENARIOS: ArenaScenario[] = [
  hysteresis,
  percentageBounds,
  controlledCollapsed,
  cascadeLatching,
  keyboardParity,
  restoreRace,
  storageFailure,
  nestedInstant,
  nestedAnimationIntegrity,
  rtl,
  zeroCollapsed,
];
