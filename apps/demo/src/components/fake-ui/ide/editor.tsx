import { ChevronRight, FileCode2, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EditorProps = {
  /** Open tabs, in strip order. Defaults to a representative set. */
  openTabs?: string[];
  /** Currently focused file. Defaults to the first tab. */
  activeTab?: string;
  /** Present when the tab strip is interactive (clicking switches files). */
  onSelectTab?: (name: string) => void;
  /** Present when tabs can be closed. */
  onCloseTab?: (name: string) => void;
  /** In a split view: is this the pane new files open into? Dims the active
   *  tab indicator when false. */
  focused?: boolean;
  /** Any pointer interaction inside the pane claims focus for it. */
  onFocusPane?: () => void;
  /** Optional workspace controls rendered at the end of the tab strip. */
  actions?: ReactNode;
};

const DEFAULT_TABS = ["App.tsx", "Panel.tsx", "main.tsx"];

export function Editor({
  openTabs = DEFAULT_TABS,
  activeTab = openTabs[0],
  onSelectTab,
  onCloseTab,
  focused = true,
  onFocusPane,
  actions,
}: EditorProps) {
  const reduceMotion = useReducedMotion();
  const file = FILES[activeTab] ?? FILES["App.tsx"];

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      onMouseDownCapture={onFocusPane}
    >
      <TabBar
        tabs={openTabs}
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        onCloseTab={onCloseTab}
        focused={focused}
        actions={actions}
      />
      <Breadcrumbs crumbs={file.crumbs} />
      {/* Key by file: switching tabs replays the reveal cascade. */}
      <div key={activeTab} className="relative flex flex-1 overflow-hidden">
        <Gutter lines={file.lines.length} activeLine={file.activeLine} />
        <pre className="flex-1 overflow-hidden py-1.5 pr-5 font-mono text-[10px] leading-4 text-foreground/80">
          <code>
            {file.lines.map((line, i) => (
              <motion.div
                key={i}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 + i * 0.04, duration: 0.18 }}
                className={cn(
                  "px-3",
                  i === file.activeLine && "bg-foreground/[0.05]",
                )}
              >
                {line}
                {i === file.activeLine ? <Caret /> : null}
              </motion.div>
            ))}
          </code>
        </pre>
        <Minimap file={file} />
      </div>
    </div>
  );
}

function Caret() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return (
      <span className="ml-px inline-block h-2.5 w-[2px] translate-y-[2px] bg-sky-400" />
    );
  }
  return (
    <motion.span
      className="ml-px inline-block h-2.5 w-[2px] translate-y-[2px] bg-sky-400"
      animate={{ opacity: [1, 1, 0, 0] }}
      transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
    />
  );
}

function TabBar({
  tabs,
  activeTab,
  onSelectTab,
  onCloseTab,
  focused,
  actions,
}: {
  tabs: string[];
  activeTab: string;
  onSelectTab?: (name: string) => void;
  onCloseTab?: (name: string) => void;
  focused: boolean;
  actions?: ReactNode;
}) {
  return (
    <div className="flex h-7 min-w-0 items-stretch border-b border-border bg-card/60 text-[11px]">
      <div className="flex min-w-0 flex-1 items-stretch overflow-hidden">
        {tabs.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <div
              key={tab}
              className={cn(
                "group relative flex min-w-0 flex-1 basis-0 items-stretch border-r border-border",
                "max-w-40",
                isActive
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground/80",
              )}
            >
              {isActive ? (
                <span
                  className={cn(
                    "absolute inset-x-0 top-0 z-10 h-[2px]",
                    focused ? "bg-sky-500" : "bg-sky-500/30",
                  )}
                />
              ) : null}
              <Button
                variant="ghost"
                size="xs"
                onClick={onSelectTab ? () => onSelectTab(tab) : undefined}
                className={cn(
                  "h-full min-w-0 flex-1 justify-start gap-1 rounded-none px-1.5 text-[11px] font-normal text-inherit hover:bg-transparent",
                  !onSelectTab && "pointer-events-none",
                )}
              >
                <FileCode2 className="size-3 shrink-0 text-cyan-400/80" />
                <span className="min-w-0 truncate">{tab}</span>
              </Button>
              {onCloseTab ? (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Close ${tab}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab);
                  }}
                  className={cn(
                    "mr-0.5 size-4 shrink-0 self-center rounded-sm",
                    // Active tabs keep the close control visible; inactive
                    // reveal it on hover so narrow strips stay readable.
                    isActive
                      ? "opacity-60 hover:opacity-100"
                      : "opacity-0 group-hover:opacity-70 hover:opacity-100",
                  )}
                >
                  <X className="size-3" />
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
      {actions ? (
        <div className="relative z-10 ml-auto flex shrink-0 items-center gap-0.5 border-l border-border bg-card/80 px-1">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

function Breadcrumbs({ crumbs }: { crumbs: string[] }) {
  return (
    <div className="flex items-center gap-0.5 border-b border-border/60 bg-background px-3 py-1 text-[10px] text-muted-foreground">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 ? <ChevronRight className="size-2.5" /> : null}
          <span className={cn(i === crumbs.length - 1 && "text-foreground/70")}>
            {c}
          </span>
        </span>
      ))}
    </div>
  );
}

function Gutter({ lines, activeLine }: { lines: number; activeLine: number }) {
  return (
    <div className="select-none border-r border-border/60 px-2 py-1.5 text-right font-mono text-[9px] leading-4 text-muted-foreground/50">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={cn(i === activeLine && "text-foreground/70")}>
          {i + 1}
        </div>
      ))}
    </div>
  );
}

function Minimap({ file }: { file: FakeFile }) {
  const reduceMotion = useReducedMotion();
  return (
    <div
      aria-hidden
      className="absolute inset-y-0 right-0 w-4 border-l border-border/40 bg-card/30 px-0.5 py-1.5"
    >
      {file.minimap.map((w, i) => (
        <motion.div
          key={i}
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.1 + i * 0.04, duration: 0.18 }}
          className={cn(
            "mb-[3px] h-[3px] origin-left rounded-[1px]",
            i === file.activeLine ? "bg-foreground/30" : "bg-foreground/15",
          )}
          style={{ width: `${w}%` }}
        />
      ))}
    </div>
  );
}

// ─── fake workspace files ────────────────────────────────────────────────────

const k = (s: string) => <span className="text-purple-400">{s}</span>;
const t = (s: string) => <span className="text-cyan-400">{s}</span>;
const s = (s: string) => <span className="text-emerald-400">{s}</span>;
const c = (s: string) => <span className="text-muted-foreground">{s}</span>;
const n = (s: string) => <span className="text-amber-400">{s}</span>;

type FakeFile = {
  crumbs: string[];
  /** Highlighted line the caret sits on. */
  activeLine: number;
  lines: ReactNode[];
  /** Widths (%) of the minimap bars, one per line. Purely decorative. */
  minimap: number[];
};

/** Deterministic decorative minimap widths — 0 for blank lines. */
const minimapFor = (lines: ReactNode[], seed: number): number[] =>
  lines.map((line, i) => (line === "" ? 0 : 22 + ((i * 37 + seed * 13) % 70)));

const file = (
  crumbs: string[],
  activeLine: number,
  lines: ReactNode[],
): FakeFile => ({
  crumbs,
  activeLine,
  lines,
  minimap: minimapFor(lines, crumbs.join("").length),
});

const FILES: Record<string, FakeFile> = {
  "App.tsx": file(["src", "App.tsx"], 6, [
    <>
      {k("import")} {"{ Panel, PanelGroup }"} {k("from")} {s('"@blitzd/…"')}
      {";"}
    </>,
    c("// resizable shell"),
    "",
    <>
      {k("export default function")} {t("App")}() {"{"}
    </>,
    <>
      {"  "}
      {k("return")} (
    </>,
    <>
      {"    "}&lt;{t("PanelGroup")} orientation={s('"horizontal"')}&gt;
    </>,
    <>
      {"      "}&lt;{t("Panel")} side={s('"start"')} defaultSize={"{240}"} /&gt;
    </>,
    <>
      {"      "}&lt;{t("Panel")} /&gt;
    </>,
    <>
      {"    "}&lt;/{t("PanelGroup")}&gt;
    </>,
    <>{"  "});</>,
    "}",
  ]),
  "Panel.tsx": file(["src", "components", "Panel.tsx"], 3, [
    <>
      {k("import")} {"{ usePanelGroup }"} {k("from")} {s('"./PanelGroup"')};
    </>,
    "",
    <>
      {k("export type")} {t("PanelProps")} = {"{"}
    </>,
    <>
      {"  "}side?: {s('"start"')} | {s('"end"')};
    </>,
    <>
      {"  "}defaultSize?: {t("number")};
    </>,
    <>
      {"  "}minSize?: {t("number")};
    </>,
    <>
      {"  "}pinned?: {t("boolean")};
    </>,
    "",
    <>
      {k("export function")} {t("Panel")}(props: {t("PanelProps")}) {"{"}
    </>,
    <>
      {"  "}
      {c("// registers with the nearest group")}
    </>,
    "}",
  ]),
  "PanelGroup.tsx": file(["src", "components", "PanelGroup.tsx"], 4, [
    <>
      {k("import")} {"{ createContext }"} {k("from")} {s('"react"')};
    </>,
    "",
    <>
      {k("const")} {t("GroupContext")} = {t("createContext")}({k("null")});
    </>,
    "",
    <>
      {k("export function")} {t("PanelGroup")}({"{ orientation }"}) {"{"}
    </>,
    <>
      {"  "}
      {c("// owns sizes; children own looks")}
    </>,
    <>
      {"  "}
      {k("return")} &lt;{t("GroupContext.Provider")}&gt;…&lt;/&gt;;
    </>,
    "}",
  ]),
  "Resizer.tsx": file(["src", "components", "Resizer.tsx"], 2, [
    <>
      {k("export function")} {t("Resizer")}({"{ onDrag }"}) {"{"}
    </>,
    <>
      {"  "}
      {c("// the seam between two panels")}
    </>,
    <>
      {"  "}
      {k("const")} onPointerDown = (e) =&gt; {"{"}
    </>,
    <>{"    "}e.target.setPointerCapture(e.pointerId);</>,
    <>
      {"  "}
      {"}"};
    </>,
    <>
      {"  "}
      {k("return")} &lt;{t("div")} role={s('"separator"')} /&gt;;
    </>,
    "}",
  ]),
  "main.tsx": file(["src", "main.tsx"], 3, [
    <>
      {k("import")} {"{ createRoot }"} {k("from")} {s('"react-dom/client"')};
    </>,
    <>
      {k("import")} {t("App")} {k("from")} {s('"./App"')};
    </>,
    "",
    <>
      {t("createRoot")}(document.getElementById({s('"root"')})!)
    </>,
    <>
      {"  "}.render(&lt;{t("App")} /&gt;);
    </>,
  ]),
  "index.css": file(["src", "index.css"], 1, [
    <>:root {"{"}</>,
    <>
      {"  "}--seam-hover: {n("oklch(0.7 0.15 250)")};
    </>,
    <>
      {"  "}--rail-width: {n("44px")};
    </>,
    <>
      {"  "}--panel-motion: {n("300ms")} cubic-bezier({n("0.4")}, {n("0")},{" "}
      {n("0.2")}, {n("1")});
    </>,
    "}",
  ]),
  "package.json": file(["package.json"], 2, [
    "{",
    <>
      {"  "}
      {s('"name"')}: {s('"panel-layout-demo"')},
    </>,
    <>
      {"  "}
      {s('"dependencies"')}: {"{"}
    </>,
    <>
      {"    "}
      {s('"@blitzd/resizable-panels"')}: {s('"latest"')},
    </>,
    <>
      {"    "}
      {s('"react"')}: {s('"^19.0.0"')}
    </>,
    <>
      {"  "}
      {"}"}
    </>,
    "}",
  ]),
  "tsconfig.json": file(["tsconfig.json"], 2, [
    "{",
    <>
      {"  "}
      {s('"compilerOptions"')}: {"{"}
    </>,
    <>
      {"    "}
      {s('"strict"')}: {n("true")},
    </>,
    <>
      {"    "}
      {s('"jsx"')}: {s('"react-jsx"')}
    </>,
    <>
      {"  "}
      {"}"}
    </>,
    "}",
  ]),
  "README.md": file(["README.md"], 0, [
    c("# panel-layout demo"),
    "",
    <>Headless resizable panels for React.</>,
    "",
    c("```bash"),
    <>bun add @blitzd/resizable-panels</>,
    c("```"),
  ]),
};
