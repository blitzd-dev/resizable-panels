import {
  Panel,
  type PanelApi,
  PanelGroup,
  type PanelLocator,
  PanelProvider,
  PanelResizeHandle,
  usePanelGroupState,
} from "@blitzd/resizable-panels";
import { memo, useCallback, useRef, useState } from "react";
import { MiniPanel } from "@/components/showcase/mini-demo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type ArenaFixtureProps,
  type ArenaScenario,
  fmtValue,
  groupEventProps,
  PanelProbe,
} from "./arena-kit";

/**
 * Arena cards for the three feature batches shipped after the early program:
 * never-squish (R-34), the container-state hook (R-36), and responsive
 * auto-collapse (R-37). Each is the standing manual regression check for the
 * contract that its automated suites are least able to protect. Contracts:
 * docs/release-prep/DESIGN-autocollapse.md §3 and FINDINGS R-34/R-36/R-37.
 */

// Module-constant locators/ids — PanelProbe and GroupStateProbe are memoized
// and must receive stable identities to update only through their own store
// subscription (an inline object/string literal survives, but keeping them
// module-level documents the intent; see PanelProbe's doc comment).
const SQUISH_DOCK: PanelLocator = { groupId: "arena-squish", panelId: "dock" };
const SQUISH_PEER: PanelLocator = { groupId: "arena-squish", panelId: "peer" };
const MOTION_DOCK: PanelLocator = { groupId: "arena-motion", panelId: "dock" };
const MOTION_PEER: PanelLocator = { groupId: "arena-motion", panelId: "peer" };
const GS_A = "arena-gs-a";
const GS_B = "arena-gs-b";
const CORE_NAV: PanelLocator = { groupId: "arena-ac-core", panelId: "nav" };
const CORE_INSP: PanelLocator = {
  groupId: "arena-ac-core",
  panelId: "inspector",
};
const OVR_ASIDE: PanelLocator = { groupId: "arena-ac-ovr", panelId: "aside" };

// ─── shared bits ─────────────────────────────────────────────────────────────

/** Fixed-width frame carrying the demo-frame attribute (so seams stay visible).
 * Unlike ArenaSurface its overflow is caller-controlled — the never-squish
 * clip-vs-scroll toggle needs to flip it live. */
function ClipFrame({
  width,
  overflow,
  height = 112,
  children,
}: {
  width: number;
  overflow: "hidden" | "auto";
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      data-resizable-panels-demo-frame=""
      className="rounded-lg border border-border bg-muted p-1"
      style={{ width, height, overflow, maxWidth: "100%" }}
    >
      {children}
    </div>
  );
}

/** Live readout of one group's `usePanelGroupState` snapshot plus a render
 * counter. MEMOIZED with a module-constant `groupId` string: it must re-render
 * ONLY when its own group state changes — that is what proves both the R-36
 * subscription liveness and the cross-group isolation (a resize in group A
 * must not tick group B's counter). */
const GroupStateProbe = memo(function GroupStateProbe({
  groupId,
  label,
}: {
  groupId: string;
  label: string;
}) {
  const state = usePanelGroupState(groupId);
  const renders = useRef(0);
  renders.current += 1;
  const overconstrained = (state?.overconstrainedBy ?? 0) > 0.5;
  return (
    <span
      className={cn(
        "rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px]",
        state ? "text-foreground" : "text-red-500",
      )}
    >
      {label}:{" "}
      {state
        ? `measured ${state.measured} · cs ${Math.round(state.containerSize)} · ` +
          `oc ${Math.round(state.overconstrainedBy)} · un ${Math.round(state.unallocatedPx)} · ` +
          `[data-overconstrained] ${overconstrained ? "ON" : "off"}`
        : "undefined"}{" "}
      · r{renders.current}
    </span>
  );
});

/** A width slider — the exogenous container-size driver every feature card
 * needs. Reports each committed width to the log. */
function WidthSlider({
  width,
  min,
  max,
  onChange,
}: {
  width: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
      width
      <input
        type="range"
        min={min}
        max={max}
        value={width}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1 w-40 cursor-pointer"
      />
      <span className="tabular-nums text-foreground">{width}px</span>
    </label>
  );
}

// ─── R-34: never-squish sweep ────────────────────────────────────────────────

function NeverSquishSweepFixture({ log }: ArenaFixtureProps) {
  const [width, setWidth] = useState(900);
  const [scroll, setScroll] = useState(false);
  const setW = useCallback(
    (next: number) => {
      setWidth(next);
      log("info", `container → ${next}px (floors: dock 280 + peer 200 = 480)`);
    },
    [log],
  );
  return (
    <PanelProvider>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <WidthSlider width={width} min={240} max={900} onChange={setW} />
          {[900, 480, 360, 240].map((w) => (
            <Button
              key={w}
              size="xs"
              variant={width === w ? "default" : "outline"}
              onClick={() => setW(w)}
            >
              {w}
            </Button>
          ))}
          <Button
            size="xs"
            variant={scroll ? "default" : "outline"}
            onClick={() => {
              setScroll((value) => !value);
              log(
                "info",
                `frame overflow → ${!scroll ? "auto (scrollbar)" : "hidden (clip)"}`,
              );
            }}
          >
            overflow: {scroll ? "auto" : "hidden"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PanelProbe locator={SQUISH_DOCK} label="dock" />
          <PanelProbe locator={SQUISH_PEER} label="peer" />
          <GroupStateProbe groupId="arena-squish" label="group" />
        </div>
        <ClipFrame width={width} overflow={scroll ? "auto" : "hidden"}>
          <PanelGroup
            orientation="horizontal"
            groupId="arena-squish"
            {...groupEventProps(log)}
          >
            <Panel side="start" panelId="dock" defaultSize="30%" minSize={280}>
              <MiniPanel
                groupId="arena-squish"
                panelId="dock"
                label="dock · 30% floor 280"
              />
            </Panel>
            <PanelResizeHandle />
            <Panel panelId="peer" minSize={200}>
              <MiniPanel
                groupId="arena-squish"
                panelId="peer"
                label="peer · floor 200"
              />
            </Panel>
          </PanelGroup>
        </ClipFrame>
      </div>
    </PanelProvider>
  );
}

const neverSquishSweep: ArenaScenario = {
  slug: "never-squish-sweep",
  title: "Never-squish: floors hold, group clips honestly below 480",
  finding: "R-34",
  steps: [
    "Sweep the width slider 900 → 240 (or use the preset buttons). Watch both probes and the group readout.",
    "Cross 480px: below it, Σ floors (280 + 200) no longer fits.",
    "At a narrow width, toggle “overflow: auto”.",
    "Return to 900 and confirm both panels relax back.",
  ],
  expect: [
    "Neither box EVER renders below its floor — dock stays ≥ 280, peer stays ≥ 200 at every width (rendered px in the probes).",
    "Below 480 the group over-constrains: [data-overconstrained] flips ON in the readout (oc > 0) and the floored boxes overflow the frame — with overflow:hidden they clip.",
    "Toggling overflow:auto turns the clip into a real scrollbar; the boxes are unchanged (still at their floors), only the frame scrolls.",
    "Exactly ONE dev warning per over-constrained kind fires (check the console — deduped by stable kind, not re-fired per width). Back at 900 the layout is fully reversible.",
  ],
  suspect:
    "R-34 fixed 2026-07-21 (never-squish Batch 1): the allocator floors fixed reservations at Σ(minSize) instead of squishing; an uninitialized docked panel paints the allocator's clamped px (not raw 30% CSS); the expanded peer emits a minWidth floor; the group sets data-overconstrained + one deduped dev warning. This card is the standing regression check — FAIL if any box paints below its floor, if the violation relocates to the peer, or if data-overconstrained disagrees with a visibly overflowing group (e2e: never-squish.spec.ts, overconstrained-rails.spec.ts).",
  Fixture: NeverSquishSweepFixture,
};

// ─── R-34: never-squish motion (F1/F2) ───────────────────────────────────────

function NeverSquishMotionFixture({ log }: ArenaFixtureProps) {
  const [width, setWidth] = useState(900);
  const [coldKey, setColdKey] = useState(0);
  const peerApi = useRef<PanelApi>(null);
  return (
    <PanelProvider>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <WidthSlider
            width={width}
            min={300}
            max={900}
            onChange={(next) => {
              setWidth(next);
              log("info", `container → ${next}px`);
            }}
          />
          <Button
            size="xs"
            variant="secondary"
            onClick={() => {
              log("info", "peer.expand() — must glide, not snap to min");
              peerApi.current?.expand();
            }}
          >
            Expand peer
          </Button>
          <Button
            size="xs"
            variant="secondary"
            onClick={() => {
              log("info", "peer.collapse()");
              peerApi.current?.collapse();
            }}
          >
            Collapse peer
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              setWidth(360);
              setColdKey((key) => key + 1);
              log(
                "info",
                "cold reload @ 360px — dock must paint 280 immediately",
              );
            }}
          >
            Reload cold @ 360px
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PanelProbe locator={MOTION_DOCK} label="dock" />
          <PanelProbe locator={MOTION_PEER} label="peer" />
        </div>
        <ClipFrame width={width} overflow="hidden">
          {/* keyed by coldKey so the "reload" button forces a genuine cold
              mount at the narrow width — exercises F2's first-allocation path. */}
          <PanelGroup
            key={coldKey}
            orientation="horizontal"
            groupId="arena-motion"
            {...groupEventProps(log)}
          >
            <Panel side="start" panelId="dock" defaultSize="30%" minSize={280}>
              <MiniPanel
                groupId="arena-motion"
                panelId="dock"
                label="dock · floor 280"
              />
            </Panel>
            <PanelResizeHandle />
            <Panel
              panelId="peer"
              minSize={150}
              collapsedSize={40}
              collapsible
              apiRef={peerApi}
              onCollapsedChange={(collapsed, details) =>
                log(
                  "panel",
                  `peer collapsed=${collapsed} (${details.reason}/${details.trigger})`,
                )
              }
            >
              <MiniPanel
                groupId="arena-motion"
                panelId="peer"
                label="peer · min 150 / rail 40"
              />
            </Panel>
          </PanelGroup>
        </ClipFrame>
      </div>
    </PanelProvider>
  );
}

const neverSquishMotion: ArenaScenario = {
  slug: "never-squish-motion",
  title: "Never-squish motion: expand glides, cold load paints at the floor",
  finding: "R-34",
  steps: [
    "Press “Collapse peer”, then “Expand peer”. Watch the peer edge over the whole animation.",
    "Repeat the expand a few times, watching for any instant jump.",
    "Press “Reload cold @ 360px” and watch the dock the moment it mounts.",
  ],
  expect: [
    "F1: the peer expands smoothly rail→150 over ~300ms — it must NOT snap to its 150 min on the first frame and then hold (no pin).",
    "Collapse animates symmetrically 150→40 with no jump.",
    "F2: on the cold reload at 360px the dock paints AT its 280 floor within ≤2 frames — no ~300ms grow-in from the raw 30% (~108px) up to the floor.",
    "The dock's probe never reads below 280 at any point during the cold mount.",
  ],
  suspect:
    "R-34 review round (F1/F2): F1 — expand animates the minWidth floor with flex-basis on the same transition so the floor never binds mid-animation (no snap-to-min pin). F2 — a one-shot skip-anim on the first allocation, gated on an actual raw→allocated jump, so a floored cold load paints its floor immediately instead of growing in. Standing regression check — FAIL if the peer pins at 150 on expand or the dock grows in from below its floor on cold load (frame spec: never-squish-motion.spec.ts).",
  Fixture: NeverSquishMotionFixture,
};

// ─── R-36: group-state probe + isolation (incl. L1) ──────────────────────────

function GroupStateProbeFixture({ log }: ArenaFixtureProps) {
  const [widthA, setWidthA] = useState(560);
  const [widthB, setWidthB] = useState(560);
  const [remountA, setRemountA] = useState(0);
  return (
    <PanelProvider>
      <div className="flex flex-col gap-3">
        <p className="text-[10px] text-muted-foreground">
          Both groups have ONLY anonymous panels (no panelId) — the R-36/L1
          staleness shape. The probes subscribe purely by groupId.
        </p>

        {/* group A — its own width control + a group-remount button */}
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              A
            </span>
            <WidthSlider
              width={widthA}
              min={300}
              max={640}
              onChange={setWidthA}
            />
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setRemountA((key) => key + 1);
                log("info", "remounted group A (probe must keep tracking)");
              }}
            >
              Remount group A
            </Button>
            <GroupStateProbe groupId={GS_A} label="A" />
          </div>
          <ClipFrame width={widthA} overflow="hidden" height={80}>
            <PanelGroup key={remountA} orientation="horizontal" groupId={GS_A}>
              <Panel minSize={200}>
                <MiniPanel label="A · left (min 200)" />
              </Panel>
              <PanelResizeHandle />
              <Panel minSize={200}>
                <MiniPanel label="A · right (min 200)" />
              </Panel>
            </PanelGroup>
          </ClipFrame>
        </div>

        {/* group B — the isolation control: driving A must never tick B */}
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              B
            </span>
            <WidthSlider
              width={widthB}
              min={300}
              max={640}
              onChange={setWidthB}
            />
            <GroupStateProbe groupId={GS_B} label="B" />
          </div>
          <ClipFrame width={widthB} overflow="hidden" height={80}>
            <PanelGroup orientation="horizontal" groupId={GS_B}>
              <Panel minSize={200}>
                <MiniPanel label="B · left (min 200)" />
              </Panel>
              <PanelResizeHandle />
              <Panel minSize={200}>
                <MiniPanel label="B · right (min 200)" />
              </Panel>
            </PanelGroup>
          </ClipFrame>
        </div>
      </div>
    </PanelProvider>
  );
}

const groupStateProbe: ArenaScenario = {
  slug: "group-state-probe",
  title: "usePanelGroupState: liveness through remount, cross-group isolation",
  finding: "R-36",
  steps: [
    "Sweep A's width 640 → 300. Below ~400 (Σ floors = 400) oc rises above 0 and [data-overconstrained] flips ON.",
    "Widen A back to 640 — oc returns to 0.",
    "Press “Remount group A”, then sweep A again.",
    "Now watch B's render counter (r…) while you drive ONLY A's width.",
  ],
  expect: [
    "A's probe tracks containerSize live and reports oc = Σfloors − container (never freezes at undefined), even though every panel is anonymous.",
    "After the group-A remount the probe RE-RESOLVES and keeps tracking — it must not stick at undefined (the L1 staleness bug: a subscriber established before an anonymous-only group publishes).",
    "Driving A ticks A's render counter but leaves B's counter FLAT — the two group subscriptions are isolated; a resize in A never re-renders B's probe.",
    "Each probe is memoized with a module-constant groupId, so its counter moves only on its own group's state changes.",
  ],
  suspect:
    "R-36 shipped 2026-07-21 (usePanelGroupState); review round fixed L1 — a subscriber attached before an anonymous-only group published its groupId went permanently stale, because attach() used groups.get(token) which noops for a registry created only by publishGroupState. Fix: attach() materializes the registry via groupRegistry(token). This card is the standing regression check — FAIL if the probe freezes at undefined across a remount, or if driving one group re-renders the other's probe (unit: group-state.test.tsx incl. two anonymous variants; e2e: group-state.spec.ts + render-locality).",
  Fixture: GroupStateProbeFixture,
};

// ─── R-37: auto-collapse core ────────────────────────────────────────────────

function AutoCollapseCoreFixture({ log }: ArenaFixtureProps) {
  const [width, setWidth] = useState(560);
  // Last stored bits from the GROUP value (never-persisted split, X4a): these
  // stay false during a width-driven fold; the probes show effective=collapsed.
  const [stored, setStored] = useState<string>("(none)");
  const jitter = useCallback(() => {
    // Park just-folded (inspector folded, nav open), then oscillate ±3px:
    // the asymmetric release band (fold at Tⱼ, release at Tⱼ+hysteresis)
    // must absorb the jitter → zero further fold/release events.
    const base = 450;
    setWidth(base);
    log("info", "parked @ 450 (inspector folded); jittering ±3px");
    let n = 0;
    const step = () => {
      if (n >= 10) {
        setWidth(base);
        return;
      }
      setWidth(base + (n % 2 === 0 ? 3 : -3));
      n += 1;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [log]);
  return (
    <PanelProvider>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <WidthSlider
            width={width}
            min={216}
            max={560}
            onChange={(next) => {
              setWidth(next);
              log("info", `container → ${next}px`);
            }}
          />
          <Button size="xs" variant="outline" onClick={jitter}>
            Park @ threshold + jitter ±3px
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PanelProbe locator={CORE_NAV} label="nav (effective)" />
          <PanelProbe locator={CORE_INSP} label="inspector (effective)" />
          <span className="rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            stored (group value): {stored}
          </span>
        </div>
        <ClipFrame width={width} overflow="hidden" height={120}>
          <PanelGroup
            orientation="horizontal"
            groupId="arena-ac-core"
            onValueChange={(value, details) => {
              // Group value reports the STORED bit — false during a fold.
              const insp = value.inspector;
              setStored(
                insp
                  ? `inspector.collapsed=${insp.collapsed ?? false}`
                  : "(n/a)",
              );
              log(
                "value",
                `onValueChange ${details.reason}/${details.trigger} → ${fmtValue(value)}`,
              );
            }}
          >
            <Panel
              side="start"
              panelId="nav"
              defaultSize={200}
              minSize={160}
              collapsedSize={48}
              collapsible="auto"
              onCollapsedChange={(collapsed, details) =>
                log(
                  "panel",
                  `nav collapsed=${collapsed} (${details.reason}/${details.trigger})`,
                )
              }
            >
              <MiniPanel
                groupId="arena-ac-core"
                panelId="nav"
                label="nav · auto · rail 48"
              />
            </Panel>
            <PanelResizeHandle />
            <Panel panelId="main" minSize={120}>
              <MiniPanel groupId="arena-ac-core" panelId="main" label="main" />
            </Panel>
            <PanelResizeHandle />
            <Panel
              side="end"
              panelId="inspector"
              defaultSize={200}
              minSize={200}
              collapsedSize={48}
              collapsible="auto"
              onCollapsedChange={(collapsed, details) =>
                log(
                  "panel",
                  `inspector collapsed=${collapsed} (${details.reason}/${details.trigger})`,
                )
              }
            >
              <MiniPanel
                groupId="arena-ac-core"
                panelId="inspector"
                label="inspector · auto · rail 48"
              />
            </Panel>
          </PanelGroup>
        </ClipFrame>
      </div>
    </PanelProvider>
  );
}

const autoCollapseCore: ArenaScenario = {
  slug: "auto-collapse-core",
  title: "Auto-collapse: trailing-first fold, reverse release, never-persist",
  finding: "R-37",
  steps: [
    "Sweep the width 560 → 216. Two auto panels (nav declared first, inspector last) with 48px rails.",
    "Watch the fold order at each threshold, then widen 216 → 560 and watch the release order.",
    "Press “Park @ threshold + jitter ±3px”: it parks just-folded, then oscillates ±3px. Watch the log during the oscillation.",
    "While a panel is auto-folded, compare its effective probe against the stored (group value) readout.",
  ],
  expect: [
    "Trailing-first: inspector (last-declared) folds first at its threshold, then nav — each logs `collapsed=true (collapse/system)`. (Sweep GRADUALLY; a single big jump folds both in one pass.)",
    "Widening releases in REVERSE: nav reopens first, then inspector — `(expand/system)`. Both rails stay visible (48px) the whole time.",
    "Parking folds inspector ONCE; the subsequent ±3px jitter then produces ZERO further fold/release events and no flicker (asymmetric release band absorbs it — a storm would emit a collapse/expand pair per nudge).",
    "Persistence untouched (intentional): while a panel is auto-folded its effective probe reads `collapsed` but the group value's stored bit stays `inspector.collapsed=false` — the fold is never written to the store.",
  ],
  suspect:
    "R-37 shipped 2026-07-22 (Batch 4). Trailing-first declared-floor prefix fold; effective state flips (probe/data-state/onCollapsedChange {collapse|expand, system}) while getValue() reports the STORED bit (never-persisted split, X4a). F1 jitter storm fixed via an asymmetric release band (fold at Tⱼ, release at Tⱼ+collapseBelowHysteresis). Standing regression check — FAIL on wrong fold order, a jitter storm, a rail collapsing to nothing, or a fold leaking into the group value (e2e: auto-collapse.spec.ts).",
  Fixture: AutoCollapseCoreFixture,
};

// ─── R-37: auto-collapse override + drag authority ───────────────────────────

function AutoCollapseOverrideFixture({ log }: ArenaFixtureProps) {
  const [width, setWidth] = useState(360);
  const asideApi = useRef<PanelApi>(null);
  return (
    <PanelProvider>
      <div className="flex flex-col gap-3">
        {/* main fixture: override latch + drag authority */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <WidthSlider
              width={width}
              min={280}
              max={640}
              onChange={(next) => {
                setWidth(next);
                log("info", `container → ${next}px`);
              }}
            />
            <Button
              size="xs"
              variant="secondary"
              onClick={() => {
                log("info", "aside.expand() — arms the stays-open override");
                asideApi.current?.expand();
              }}
            >
              Expand aside
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PanelProbe locator={OVR_ASIDE} label="aside (effective)" />
          </div>
          <ClipFrame width={width} overflow="hidden" height={120}>
            <PanelGroup
              orientation="horizontal"
              groupId="arena-ac-ovr"
              {...groupEventProps(log)}
            >
              <Panel panelId="main" minSize={120}>
                <MiniPanel groupId="arena-ac-ovr" panelId="main" label="main" />
              </Panel>
              <PanelResizeHandle />
              <Panel
                side="end"
                panelId="aside"
                defaultSize={260}
                minSize={200}
                collapsedSize={48}
                collapsible="auto"
                resizableWhenCollapsed
                apiRef={asideApi}
                onCollapsedChange={(collapsed, details) =>
                  log(
                    "panel",
                    `aside collapsed=${collapsed} (${details.reason}/${details.trigger})`,
                  )
                }
              >
                <MiniPanel
                  groupId="arena-ac-ovr"
                  panelId="aside"
                  label="aside · auto · rail 48 · resizableWhenCollapsed"
                />
              </Panel>
            </PanelGroup>
          </ClipFrame>
        </div>

        {/* dev-guardrail sub-fixture: collapsedSize 0 auto refuses to arm */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            dev guardrail · collapsedSize 0 + auto
          </span>
          <ClipFrame width={360} overflow="hidden" height={72}>
            <PanelGroup orientation="horizontal" groupId="arena-ac-guard">
              <Panel panelId="main" minSize={120}>
                <MiniPanel label="main" />
              </Panel>
              <PanelResizeHandle />
              <Panel
                side="end"
                panelId="ghost"
                defaultSize={200}
                minSize={160}
                collapsedSize={0}
                collapsible="auto"
              >
                <MiniPanel label="ghost · rail 0 → refuse-to-arm" />
              </Panel>
            </PanelGroup>
          </ClipFrame>
        </div>
      </div>
    </PanelProvider>
  );
}

const autoCollapseOverride: ArenaScenario = {
  slug: "auto-collapse-override",
  title: "Auto-collapse: stays-open override + drag authority (OQ1-final, X5)",
  finding: "R-37",
  steps: [
    "Shrink the width until aside auto-folds to its 48px rail. Then press “Expand aside”.",
    "Keep shrinking the width further (any amount) with aside expanded.",
    "Widen past the fold threshold, then shrink again.",
    "Drag test: grab the collapsed aside rail and drag it open. Separately, HOLD a seam drag while nudging the width slider narrower, then release.",
    "Scroll to the collapsedSize-0 sub-fixture and check the browser console.",
  ],
  expect: [
    "OQ1-final (stays-open): after the manual expand aside STAYS open while you shrink further — the override holds at ANY narrower width, and the group over-constrains honestly (never-squish).",
    "Widening past the threshold clears the override (space returned); shrinking again folds FRESH with `(collapse/system)`.",
    "Dragging the folded rail open logs `aside collapsed=false (expand/pointer)` and arms the override. Holding a seam drag while the width shrinks logs NO fold mid-drag; the fold applies on release as `(collapse/system)` (drag owns presentation, recomputes at commit).",
    "The collapsedSize-0 auto panel refuses to arm: a dev console warning fires and it behaves as collapsible={true} (never silently vanishes on resize).",
  ],
  suspect:
    "R-37 OQ1-final + F-X5 (2026-07-22). Override latch is a bare per-panel Set armed by a manual expand; clears only on W ≥ Tⱼ (explicit-open-stays-open). While a pointer session is live the fold set is FROZEN and recomputes at the committed width on release ({collapse|expand, system}); a drag reopening a folded rail arms the override ({expand, pointer}). Arm-refusal at collapsedSize ≤ SIZE_EPSILON (dev-warn, falls back to collapsible=true). Standing regression check — FAIL if the override doesn't hold while shrinking, if a mid-drag fold churns, if drag-expand doesn't arm, or if a collapsedSize-0 auto panel arms silently (e2e: auto-collapse.spec.ts).",
  Fixture: AutoCollapseOverrideFixture,
};

export const FEATURE_SCENARIOS: ArenaScenario[] = [
  neverSquishSweep,
  neverSquishMotion,
  groupStateProbe,
  autoCollapseCore,
  autoCollapseOverride,
];
