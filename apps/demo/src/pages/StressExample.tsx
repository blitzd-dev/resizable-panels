import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelActions,
} from "@blitzd/resizable-panels";
import { Pause, Play, Shuffle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── layout model ────────────────────────────────────────────────────────────
// A deliberately deep, mixed-axis tree so the auto-driver stresses collapse in
// BOTH directions and through nested groups:
//
//   • COLLAPSIBLE_ROWS rows in one vertical group — each row collapses UP/DOWN.
//   • Every row is a horizontal group of cells — each cell collapses LEFT/RIGHT.
//   • One bottom "nested" row holds 2×2 sub-panel groups whose leaves collapse
//     on both axes.
//
// Zero-collapse safety (R-13): collapsing a panel zeroes that axis for every
// descendant, and a group whose MAIN axis measures 0 warns. So a panel may
// collapse only where doing so hits a descendant group's CROSS axis:
//   • rows collapse vertically → their horizontal cell-group is cross-axis ✓
//   • grid cells hold plain color, no descendant group ✓
//   • the nested row and its cells never collapse, so their sub-groups are
//     never zeroed by an ancestor; only the leaves inside them toggle ✓
//
// Underfill safety: a group with EVERY child collapsed has nothing to absorb
// its space and warns. So the first member of each group is a non-collapsible
// anchor (see ANCHOR): the outer vertical group is anchored by the fixed
// nested row, and every other group by its index-0 child.
const ANCHOR = 0;
const ROOT_GROUP = "stress-root";
const COLLAPSIBLE_ROWS = 4;
const COLS = 10;
const NESTED_COLS = 5;

type Target = { groupId: string; panelId: string };

type GridCell = { panelId: string; hue: number; label: number };
type GridRow = {
  kind: "grid";
  rowPanelId: string;
  groupId: string;
  cells: GridCell[];
};

type SubLeaf = { panelId: string; hue: number };
// One horizontal split (a sub-row) inside a 2×2 nested group.
type SubRow = { panelId: string; groupId: string; leaves: SubLeaf[] };
type NestedCell = { panelId: string; groupId: string; subRows: SubRow[] };
type NestedRow = {
  kind: "nested";
  rowPanelId: string;
  groupId: string;
  cells: NestedCell[];
};

type Row = GridRow | NestedRow;

const ROWS: Row[] = buildRows();
// Every panel the driver may toggle, flattened from the tree above.
const TARGETS: Target[] = collectTargets(ROWS);
const TOTAL = TARGETS.length;

function buildRows(): Row[] {
  // Sequential hue per painted panel so the field reads as stable color while
  // panels pop in and out — no Math.random in render.
  let hueSeed = 0;
  const nextHue = () => {
    const h = (hueSeed * 47) % 360;
    hueSeed += 1;
    return h;
  };

  const rows: Row[] = [];

  for (let r = 0; r < COLLAPSIBLE_ROWS; r++) {
    const groupId = `stress-row-${r}`;
    rows.push({
      kind: "grid",
      rowPanelId: `row-${r}`,
      groupId,
      cells: Array.from({ length: COLS }, (_, c) => ({
        panelId: `c${r}-${c}`,
        hue: nextHue(),
        label: r * COLS + c,
      })),
    });
  }

  const nestedRowIndex = COLLAPSIBLE_ROWS;
  rows.push({
    kind: "nested",
    rowPanelId: `row-${nestedRowIndex}`,
    groupId: `stress-row-${nestedRowIndex}`,
    cells: Array.from({ length: NESTED_COLS }, (_, c) => ({
      panelId: `n-${c}`,
      groupId: `stress-subv-${c}`, // vertical split within the cell
      subRows: Array.from({ length: 2 }, (_, k) => ({
        panelId: `sv-${c}-${k}`,
        groupId: `stress-subh-${c}-${k}`, // horizontal split within the sub-row
        leaves: Array.from({ length: 2 }, (_, j) => ({
          panelId: `sh-${c}-${k}-${j}`,
          hue: nextHue(),
        })),
      })),
    })),
  });

  return rows;
}

function collectTargets(rows: Row[]): Target[] {
  const targets: Target[] = [];
  for (const row of rows) {
    if (row.kind === "grid") {
      // Rows collapse (the outer group is anchored by the fixed nested row);
      // within a row, the index-0 cell is the anchor and never collapses.
      targets.push({ groupId: ROOT_GROUP, panelId: row.rowPanelId });
      for (const [c, cell] of row.cells.entries()) {
        if (c === ANCHOR) continue;
        targets.push({ groupId: row.groupId, panelId: cell.panelId });
      }
    } else {
      // The nested row and its cells stay fixed; within each sub-group the
      // index-0 member is the anchor, so only the rest toggle.
      for (const cell of row.cells) {
        for (const [k, sub] of cell.subRows.entries()) {
          if (k !== ANCHOR) {
            targets.push({ groupId: cell.groupId, panelId: sub.panelId });
          }
          for (const [j, leaf] of sub.leaves.entries()) {
            if (j === ANCHOR) continue;
            targets.push({ groupId: sub.groupId, panelId: leaf.panelId });
          }
        }
      }
    }
  }
  return targets;
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function StressExample() {
  return (
    // Own provider so every group's locator lives in an isolated namespace,
    // addressable from the driver and header that sit outside every group.
    <PanelProvider>
      <StressPlayground />
    </PanelProvider>
  );
}

function StressPlayground() {
  const actions = usePanelActions();

  // Which panels are currently collapsed, tracked from action results rather
  // than a subscription per target — the header must not become the bottleneck
  // it is trying to measure. Manual drags can drift this slightly; it is a
  // driver's-eye view of open count, which is what the readout claims to be.
  const collapsedRef = useRef<Set<string>>(new Set());

  const [running, setRunning] = useState(false);
  const [rate, setRate] = useState(6); // ticks per second
  const [batch, setBatch] = useState(4); // panels toggled per tick

  const applyCollapsed = useCallback((t: Target, collapsed: boolean) => {
    const k = `${t.groupId}/${t.panelId}`;
    if (collapsed) collapsedRef.current.add(k);
    else collapsedRef.current.delete(k);
  }, []);

  // One tick: toggle `batch` random distinct panels across the whole tree.
  // toggle() reports the new collapsed value, so open-count stays in sync.
  const toggleRandomBatch = useCallback(() => {
    const picked = new Set<number>();
    const n = Math.min(batch, TOTAL);
    while (picked.size < n) {
      picked.add(Math.floor(Math.random() * TOTAL));
    }
    for (const i of picked) {
      const target = TARGETS[i];
      const result = actions.toggle(target);
      if (result.applied) applyCollapsed(target, result.value);
    }
  }, [actions, applyCollapsed, batch]);

  const setAll = useCallback(
    (collapsed: boolean) => {
      for (const target of TARGETS) {
        actions.setCollapsed(target, collapsed);
        applyCollapsed(target, collapsed);
      }
    },
    [actions, applyCollapsed],
  );

  // Auto-driver: a plain interval so the rate maps directly to the slider's
  // number. Cleared and rebuilt whenever running/rate/batch change.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(toggleRandomBatch, 1000 / rate);
    return () => clearInterval(id);
  }, [running, rate, toggleRandomBatch]);

  const getOpenCount = useCallback(() => TOTAL - collapsedRef.current.size, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <StressHeader
        running={running}
        onToggleRunning={() => setRunning((v) => !v)}
        rate={rate}
        onRate={setRate}
        batch={batch}
        onBatch={setBatch}
        onRandomize={toggleRandomBatch}
        onOpenAll={() => setAll(false)}
        onCloseAll={() => setAll(true)}
        getOpenCount={getOpenCount}
      />

      <div className="min-h-0 flex-1 p-3">
        <PanelGroup
          groupId={ROOT_GROUP}
          orientation="vertical"
          className="h-full"
        >
          {ROWS.map((row, i) => (
            <RowView
              key={row.rowPanelId}
              row={row}
              isLast={i === ROWS.length - 1}
            />
          ))}
        </PanelGroup>
      </div>
    </div>
  );
}

// ─── grid ────────────────────────────────────────────────────────────────────

function RowView({ row, isLast }: { row: Row; isLast: boolean }) {
  const inner =
    row.kind === "grid" ? (
      // Collapsible row → collapses vertically. Its horizontal cell-group is
      // cross-axis, so a row collapse never zeroes a group's main axis.
      <Panel panelId={row.rowPanelId} collapsible collapsedSize={0} minSize={0}>
        <PanelGroup
          groupId={row.groupId}
          orientation="horizontal"
          className="h-full"
        >
          {row.cells.map((cell, c) => (
            <Sibling key={cell.panelId} last={c === row.cells.length - 1}>
              <Panel
                panelId={cell.panelId}
                collapsible={c !== ANCHOR}
                collapsedSize={c !== ANCHOR ? 0 : undefined}
                minSize={0}
                className="overflow-hidden"
              >
                <ColorFill hue={cell.hue} label={cell.label} />
              </Panel>
            </Sibling>
          ))}
        </PanelGroup>
      </Panel>
    ) : (
      // Nested row → fixed height, holds the 2×2 sub-panel groups.
      <Panel panelId={row.rowPanelId} minSize={48}>
        <PanelGroup
          groupId={row.groupId}
          orientation="horizontal"
          className="h-full"
        >
          {row.cells.map((cell, c) => (
            <Sibling key={cell.panelId} last={c === row.cells.length - 1}>
              <Panel
                panelId={cell.panelId}
                minSize={48}
                className="overflow-hidden p-1"
              >
                <SubGridView cell={cell} />
              </Panel>
            </Sibling>
          ))}
        </PanelGroup>
      </Panel>
    );

  return (
    <>
      {inner}
      {!isLast && <PanelResizeHandle />}
    </>
  );
}

// A fixed nested cell: vertical split, each half a horizontal split. The cell
// itself never collapses, so its leaves toggle on both axes safely.
function SubGridView({ cell }: { cell: NestedCell }) {
  return (
    <PanelGroup
      groupId={cell.groupId}
      orientation="vertical"
      className="h-full"
    >
      {cell.subRows.map((sub, k) => (
        <Sibling key={sub.panelId} last={k === cell.subRows.length - 1}>
          <Panel
            panelId={sub.panelId}
            collapsible={k !== ANCHOR}
            collapsedSize={k !== ANCHOR ? 0 : undefined}
            minSize={0}
            className="overflow-hidden"
          >
            <PanelGroup
              groupId={sub.groupId}
              orientation="horizontal"
              className="h-full"
            >
              {sub.leaves.map((leaf, j) => (
                <Sibling key={leaf.panelId} last={j === sub.leaves.length - 1}>
                  <Panel
                    panelId={leaf.panelId}
                    collapsible={j !== ANCHOR}
                    collapsedSize={j !== ANCHOR ? 0 : undefined}
                    minSize={0}
                    className="overflow-hidden"
                  >
                    <ColorFill hue={leaf.hue} />
                  </Panel>
                </Sibling>
              ))}
            </PanelGroup>
          </Panel>
        </Sibling>
      ))}
    </PanelGroup>
  );
}

// A panel plus the handle that follows it, unless it's the last sibling.
function Sibling({
  children,
  last,
}: {
  children: React.ReactNode;
  last: boolean;
}) {
  return (
    <>
      {children}
      {!last && <PanelResizeHandle />}
    </>
  );
}

function ColorFill({ hue, label }: { hue: number; label?: number }) {
  return (
    <div
      style={{ backgroundColor: `hsl(${hue} 62% 52% / 0.9)` }}
      className="flex h-full w-full min-w-2 items-center justify-center text-[11px] font-semibold text-white tabular-nums"
    >
      {label}
    </div>
  );
}

// ─── header + live monitors ──────────────────────────────────────────────────

function StressHeader({
  running,
  onToggleRunning,
  rate,
  onRate,
  batch,
  onBatch,
  onRandomize,
  onOpenAll,
  onCloseAll,
  getOpenCount,
}: {
  running: boolean;
  onToggleRunning: () => void;
  rate: number;
  onRate: (v: number) => void;
  batch: number;
  onBatch: (v: number) => void;
  onRandomize: () => void;
  onOpenAll: () => void;
  onCloseAll: () => void;
  getOpenCount: () => number;
}) {
  const { fps, fpsHist, heapMb, heapHist, open, openHist } =
    useStressMonitor(getOpenCount);
  // Heap has no fixed ceiling, so scale its sparkline to the tallest sample in
  // the current window; FPS scales to 60 and Open to the panel total.
  const heapMax = Math.max(1, ...heapHist);

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={running ? "secondary" : "default"}
          onClick={onToggleRunning}
        >
          {running ? <Pause className="size-4" /> : <Play className="size-4" />}
          {running ? "Stop" : "Auto-drive"}
        </Button>
        <Button size="sm" variant="secondary" onClick={onRandomize}>
          <Shuffle className="size-4" /> Toggle batch
        </Button>
        <Button size="sm" variant="ghost" onClick={onOpenAll}>
          Open all
        </Button>
        <Button size="sm" variant="ghost" onClick={onCloseAll}>
          Close all
        </Button>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        <RangeControl
          label="Rate"
          value={rate}
          min={1}
          max={30}
          onChange={onRate}
          suffix="/s"
        />
        <RangeControl
          label="Batch"
          value={batch}
          min={1}
          max={25}
          onChange={onBatch}
          suffix=" panels"
        />
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 font-mono text-xs sm:ml-auto sm:justify-start sm:gap-5">
        <Readout label="FPS">
          <span className={cn("w-8 text-right tabular-nums", fpsColor(fps))}>
            {fps}
          </span>
          <Sparkline values={fpsHist} max={60} barClass={fpsBarColor} />
        </Readout>
        <Readout label="Heap">
          <span className="w-16 text-right tabular-nums text-foreground">
            {heapMb === null ? "n/a" : `${heapMb} MB`}
          </span>
          <Sparkline values={heapHist} max={heapMax} barClass="bg-sky-400/70" />
        </Readout>
        <Readout label="Open">
          <span className="w-14 text-right tabular-nums text-foreground">
            {open}
            <span className="text-muted-foreground">/{TOTAL}</span>
          </span>
          <Sparkline
            values={openHist}
            max={TOTAL}
            barClass="bg-violet-400/70"
          />
        </Readout>
      </div>
    </div>
  );
}

function Readout({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="flex items-center gap-1.5">{children}</span>
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="flex min-w-0 items-center gap-2 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-20 min-w-0 max-w-24 flex-1 cursor-pointer accent-primary sm:w-24"
      />
      <span className="shrink-0 whitespace-nowrap font-mono tabular-nums text-foreground">
        {value}
        {suffix}
      </span>
    </label>
  );
}

function Sparkline({
  values,
  max,
  barClass,
}: {
  values: number[];
  max: number;
  barClass: string | ((v: number) => string);
}) {
  // Always render HISTORY_LEN slots so every sparkline has the same fixed
  // width from the first frame; missing samples pad the front at zero height.
  const pad = HISTORY_LEN - values.length;
  return (
    <span className="flex h-4 items-end gap-px" aria-hidden>
      {Array.from({ length: HISTORY_LEN }, (_, i) => {
        const v = i < pad ? null : values[i - pad];
        const height =
          v === null ? 0 : Math.max(6, Math.min(100, (v / max) * 100));
        const color =
          v === null
            ? ""
            : typeof barClass === "function"
              ? barClass(v)
              : barClass;
        return (
          <span
            key={i}
            className={cn("w-0.5 rounded-sm", color)}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </span>
  );
}

function fpsColor(fps: number) {
  if (fps >= 50) return "text-emerald-500";
  if (fps >= 30) return "text-amber-500";
  return "text-red-500";
}

function fpsBarColor(fps: number) {
  if (fps >= 50) return "bg-emerald-500/70";
  if (fps >= 30) return "bg-amber-500/70";
  return "bg-red-500/70";
}

const HISTORY_LEN = 32;

// One rAF loop drives every readout: it counts frames for FPS, samples the
// JS heap when the engine exposes it (Chromium only), and reads the current
// open count — all reflected into state (with a rolling history each) on a
// ~250ms cadence so the header re-renders a few times a second, not per frame.
function useStressMonitor(getOpenCount: () => number) {
  const [state, setState] = useState({
    fps: 0,
    fpsHist: [] as number[],
    heapMb: null as number | null,
    heapHist: [] as number[],
    open: TOTAL,
    openHist: [] as number[],
  });
  const getOpenRef = useRef(getOpenCount);
  getOpenRef.current = getOpenCount;

  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let windowStart = performance.now();
    const fpsHist: number[] = [];
    const heapHist: number[] = [];
    const openHist: number[] = [];
    const trim = (arr: number[]) => {
      if (arr.length > HISTORY_LEN) arr.shift();
    };

    const tick = (now: number) => {
      frames += 1;
      const elapsed = now - windowStart;
      if (elapsed >= 250) {
        const fps = Math.round((frames * 1000) / elapsed);
        fpsHist.push(fps);
        trim(fpsHist);
        const open = getOpenRef.current();
        openHist.push(open);
        trim(openHist);
        // performance.memory is a non-standard Chromium extension.
        const mem = (
          performance as Performance & {
            memory?: { usedJSHeapSize: number };
          }
        ).memory;
        const heapMb = mem ? Math.round(mem.usedJSHeapSize / 1_048_576) : null;
        if (heapMb !== null) {
          heapHist.push(heapMb);
          trim(heapHist);
        }
        setState({
          fps,
          fpsHist: [...fpsHist],
          heapMb,
          heapHist: [...heapHist],
          open,
          openHist: [...openHist],
        });
        frames = 0;
        windowStart = now;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return state;
}
