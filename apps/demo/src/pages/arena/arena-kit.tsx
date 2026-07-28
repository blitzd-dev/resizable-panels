import {
  type PanelGroupValue,
  type PanelGroupValueChangeDetails,
  type PanelLocator,
  type PanelResizeEndEvent,
  type PanelResizeStartEvent,
  usePanelControls,
} from "@blitzd/resizable-panels";
import { RotateCcw } from "lucide-react";
import {
  type ComponentType,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Edge-case test arena infrastructure. Each scenario is a manually validated
 * card: an isolated fixture, a script of steps, the expected outcome, a live
 * event log, and a persisted PASS/FAIL verdict. Findings referenced as R-xx
 * live in docs/release-prep/FINDINGS.md.
 */

// ─── logging ─────────────────────────────────────────────────────────────────

export type ArenaLogKind =
  | "value" // onValueChange emissions
  | "lifecycle" // onResizeStart / onResizeEnd
  | "panel" // per-panel callbacks & probe transitions
  | "persist" // persistence status / writes
  | "error" // onError and anything unexpected
  | "info"; // fixture-driven notes (button presses, dumps)

export type ArenaLogEntry = {
  id: number;
  /** ms since mount or last clear. */
  t: number;
  kind: ArenaLogKind;
  message: string;
};

export type ArenaLogger = {
  entries: ArenaLogEntry[];
  log: (kind: ArenaLogKind, message: string) => void;
  clear: () => void;
};

const MAX_LOG_ENTRIES = 300;

export function useArenaLog(): ArenaLogger {
  const [entries, setEntries] = useState<ArenaLogEntry[]>([]);
  const epochRef = useRef(performance.now());
  const idRef = useRef(0);
  const log = useCallback((kind: ArenaLogKind, message: string) => {
    const entry: ArenaLogEntry = {
      id: ++idRef.current,
      t: Math.round(performance.now() - epochRef.current),
      kind,
      message,
    };
    setEntries((prev) => [...prev.slice(-(MAX_LOG_ENTRIES - 1)), entry]);
  }, []);
  const clear = useCallback(() => {
    epochRef.current = performance.now();
    setEntries([]);
  }, []);
  return { entries, log, clear };
}

/** Compact one-line rendering of a group value: `side:240·c main:412`. */
export function fmtValue(value: PanelGroupValue): string {
  const parts = Object.entries(value).map(
    ([id, state]) =>
      `${id}:${Math.round(state.size)}${state.collapsed ? "·c" : ""}`,
  );
  return parts.length > 0 ? parts.join(" ") : "(empty)";
}

/** Standard PanelGroup event wiring: every emission and lifecycle event goes
 * to the card log. `label` prefixes messages when a card hosts several
 * groups. */
export function groupEventProps(log: ArenaLogger["log"], label?: string) {
  const p = label ? `[${label}] ` : "";
  return {
    onValueChange: (
      value: PanelGroupValue,
      details: PanelGroupValueChangeDetails,
    ) =>
      log(
        "value",
        `${p}onValueChange ${details.reason}/${details.trigger}` +
          `${details.handleId ? `·${details.handleId}` : ""} → ${fmtValue(value)}`,
      ),
    onResizeStart: (event: PanelResizeStartEvent) =>
      log("lifecycle", `${p}onResizeStart → ${fmtValue(event.value)}`),
    onResizeEnd: (event: PanelResizeEndEvent) =>
      log(
        "lifecycle",
        `${p}onResizeEnd${event.canceled ? " (canceled)" : ""} → ${fmtValue(event.value)}`,
      ),
  };
}

/** Block the main thread — the arena's jank injector for timing-sensitive
 * machinery (R-04's frame-scheduled suppression windows). */
export function busyWait(ms: number): void {
  const until = performance.now() + ms;
  while (performance.now() < until) {
    // deliberate busy loop
  }
}

// ─── verdicts ────────────────────────────────────────────────────────────────

export type ArenaVerdict = "untested" | "pass" | "fail";
export type ArenaVerdictRecord = { verdict: ArenaVerdict; at: number };

const verdictKey = (slug: string) => `arena:verdict:${slug}`;

export function loadVerdict(slug: string): ArenaVerdictRecord {
  try {
    const raw = localStorage.getItem(verdictKey(slug));
    if (raw) return JSON.parse(raw) as ArenaVerdictRecord;
  } catch {
    // ignore unreadable storage
  }
  return { verdict: "untested", at: 0 };
}

export function saveVerdict(slug: string, record: ArenaVerdictRecord): void {
  try {
    if (record.verdict === "untested") {
      localStorage.removeItem(verdictKey(slug));
    } else {
      localStorage.setItem(verdictKey(slug), JSON.stringify(record));
    }
  } catch {
    // ignore unwritable storage
  }
}

// ─── scenario contract ───────────────────────────────────────────────────────

export type ArenaFixtureProps = {
  log: ArenaLogger["log"];
  /** Bumped by the card's Remount button; fixtures needing manual re-runs of
   * mount-time behavior can also read it as a cache-buster. */
  remountKey: number;
};

export type ArenaScenario = {
  /** Stable id: verdict storage key and card anchor. */
  slug: string;
  title: string;
  /** FINDINGS.md reference, when the card exists to adjudicate a finding. */
  finding?: string;
  /** What to do, in order. */
  steps: string[];
  /** What must happen for a PASS. */
  expect: string[];
  /** Known-broken note shown on the card (suspected/confirmed behavior). */
  suspect?: string;
  Fixture: ComponentType<ArenaFixtureProps>;
};

// ─── card ────────────────────────────────────────────────────────────────────

const KIND_STYLES: Record<ArenaLogKind, string> = {
  value: "text-sky-600 dark:text-sky-400",
  lifecycle: "text-violet-600 dark:text-violet-400",
  panel: "text-emerald-600 dark:text-emerald-400",
  persist: "text-amber-600 dark:text-amber-500",
  error: "text-red-600 dark:text-red-400",
  info: "text-muted-foreground",
};

export function ArenaCard({
  scenario,
  verdict,
  onVerdictChange,
}: {
  scenario: ArenaScenario;
  verdict: ArenaVerdictRecord;
  onVerdictChange: (record: ArenaVerdictRecord) => void;
}) {
  const { entries, log, clear } = useArenaLog();
  const [remountKey, setRemountKey] = useState(0);
  const { Fixture } = scenario;

  const setVerdict = (next: ArenaVerdict) => {
    onVerdictChange({
      verdict: verdict.verdict === next ? "untested" : next,
      at: Date.now(),
    });
  };
  const remount = () => {
    setRemountKey((key) => key + 1);
    log("info", "— fixture remounted —");
  };

  return (
    <section
      id={scenario.slug}
      className="scroll-mt-20 rounded-xl border border-border bg-card"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{scenario.title}</h2>
        {scenario.finding ? (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary">
            {scenario.finding}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1.5">
          {verdict.verdict !== "untested" && verdict.at > 0 ? (
            <span className="text-[10px] text-muted-foreground">
              {new Date(verdict.at).toLocaleString()}
            </span>
          ) : null}
          <Button
            size="xs"
            variant={verdict.verdict === "pass" ? "default" : "outline"}
            className={cn(
              verdict.verdict === "pass" &&
                "bg-emerald-600 text-white hover:bg-emerald-600/90",
            )}
            onClick={() => setVerdict("pass")}
          >
            Pass
          </Button>
          <Button
            size="xs"
            variant={verdict.verdict === "fail" ? "default" : "outline"}
            className={cn(
              verdict.verdict === "fail" &&
                "bg-red-600 text-white hover:bg-red-600/90",
            )}
            onClick={() => setVerdict("fail")}
          >
            Fail
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={remount}
            title="Remount fixture"
          >
            <RotateCcw className="size-3.5" />
            Remount
          </Button>
        </div>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
        <div className="min-w-0 space-y-3">
          <div className="grid gap-3 text-xs sm:grid-cols-2">
            <ScriptList label="Steps" items={scenario.steps} ordered />
            <ScriptList label="Expect" items={scenario.expect} />
          </div>
          {scenario.suspect ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400">
              {scenario.suspect}
            </p>
          ) : null}
          <div key={remountKey} className="min-w-0">
            <Fixture log={log} remountKey={remountKey} />
          </div>
        </div>
        <LogPane entries={entries} onClear={clear} />
      </div>
    </section>
  );
}

function ScriptList({
  label,
  items,
  ordered = false,
}: {
  label: string;
  items: string[];
  ordered?: boolean;
}) {
  const List = ordered ? "ol" : "ul";
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <List
        className={cn(
          "space-y-1 pl-4 text-muted-foreground",
          ordered ? "list-decimal" : "list-disc",
        )}
      >
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </List>
    </div>
  );
}

function LogPane({
  entries,
  onClear,
}: {
  entries: ArenaLogEntry[];
  onClear: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll position tracks entry count on purpose.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-muted/40">
      <div className="flex items-center justify-between border-b border-border px-2.5 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Event log · {entries.length}
        </span>
        <Button size="xs" variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </div>
      <div
        ref={scrollRef}
        className="h-64 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed"
      >
        {entries.length === 0 ? (
          <div className="text-muted-foreground/60">
            (empty — interact with the fixture)
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="flex gap-2 whitespace-pre-wrap break-all"
            >
              <span className="shrink-0 tabular-nums text-muted-foreground/60">
                {(entry.t / 1000).toFixed(2)}s
              </span>
              <span className={KIND_STYLES[entry.kind]}>{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Live readout of one panel's controls (preferred + rendered px, collapsed
 * flag), resolved through the public locator API. Pass `log` to also record
 * every transition in the card log — including the resolved/undefined edge,
 * which is the signal for R-01.
 *
 * MEMOIZED on purpose, and it matters: every log entry re-renders the card
 * and therefore the fixture, so an un-memoized probe would re-read its
 * snapshot on each logged event and mask dead-subscription bugs (this is
 * exactly how R-01 initially hid from the arena). With memo, the probe
 * updates ONLY through its own store subscription — pass a module-constant
 * `locator` (inline object literals defeat the memo).
 */
export const PanelProbe = memo(function PanelProbe({
  locator,
  label,
  log,
}: {
  locator: PanelLocator;
  label?: string;
  log?: ArenaLogger["log"];
}) {
  const ctrl = usePanelControls(locator);
  const text = ctrl
    ? `pref ${Math.round(ctrl.size)} · rendered ${Math.round(ctrl.renderedSize)}${ctrl.collapsed ? " · collapsed" : ""}`
    : "undefined";
  const name = label ?? `${locator.groupId}/${locator.panelId}`;
  const prevRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevRef.current === text) return;
    prevRef.current = text;
    log?.("panel", `${name} probe → ${text}`);
  }, [text, name, log]);
  return (
    <span
      className={cn(
        "rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px]",
        ctrl ? "text-foreground" : "text-red-500",
      )}
    >
      {name}: {text}
    </span>
  );
});

/** Fixed-size fixture viewport. Unlike DemoSurface it is not user-resizable —
 * arena cases need deterministic container geometry. */
export function ArenaSurface({
  className,
  children,
  width,
}: {
  className?: string;
  children: ReactNode;
  width?: number;
}) {
  return (
    <div
      data-resizable-panels-demo-frame=""
      style={width !== undefined ? { width } : undefined}
      className={cn(
        "h-28 max-w-full overflow-hidden rounded-lg border border-border bg-muted p-1",
        className,
      )}
    >
      {children}
    </div>
  );
}
