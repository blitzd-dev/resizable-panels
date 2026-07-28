import { Info, RotateCcw, TriangleAlert } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { CodeBlock } from "@/components/code-block";
import { DemoControlsSlotContext } from "@/components/demo-controls-context";
import { Segmented } from "@/components/segmented";
import { DemoSurface } from "@/components/showcase/mini-demo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Table as ShadcnTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// One-stop shop: content pages import every prose primitive from here.
export { Kbd } from "@/components/ui/kbd";

/** In-page section heading. The `id` feeds the "On this page" rail. */
export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-12 pt-6 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
    >
      {children}
    </h2>
  );
}

export function P({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn("text-muted-foreground", className)}>{children}</p>;
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md bg-muted/80 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </code>
  );
}

export function Pre({
  children,
  lang = "tsx",
}: {
  children: string;
  lang?: "tsx" | "ts" | "jsx" | "js";
}) {
  return <CodeBlock code={children} lang={lang} lineNumbers={false} />;
}

/** In-prose cross-link to another docs page (or anchor). One styling home
 * for every content link — never hand-write `className="underline"`. */
export function DocLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="underline underline-offset-2 transition-colors hover:text-foreground"
    >
      {children}
    </Link>
  );
}

/** The "Required." marker used in prop tables — one styling home. */
export function Req() {
  return <span className="font-semibold text-foreground">Required.</span>;
}

/**
 * The standard end-of-page Related section: heading + one line per link.
 * Every page closes with this instead of freeform paragraphs, so the
 * section scans identically everywhere.
 */
export function Related({
  items,
}: {
  items: { to: string; label: string; note: string }[];
}) {
  return (
    <>
      <H2 id="related">Related</H2>
      <ul className="flex flex-col gap-1.5 text-muted-foreground">
        {items.map((item) => (
          <li key={item.to} className="flex flex-wrap items-baseline gap-x-1.5">
            <DocLink to={item.to}>{item.label}</DocLink>
            {/* Leading space is intentional: markdown joins siblings with no
                gap when React omits the inter-element text node. */}
            <span> — {item.note}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * A live, draggable demo paired with its own source. `children` is the running
 * component; `source` is the same module's `?raw` text — the dual-import
 * convention (`import X from "./x"` + `import xSource from "./x.tsx?raw"`)
 * guarantees the shown code IS the running code.
 *
 * Two presentations, one API:
 * - `variant="tabs"` (default): a Preview/Code segmented switch — code is
 *   hidden until asked for, but stays mounted so Copy-Markdown serializes it.
 * - `variant="stacked"`: preview above, source always visible below (opt-in
 *   for short snippets worth reading inline).
 *
 * `caption` is the one-sentence "what this shows"; `whatToTry` renders a
 * compact interaction checklist under the preview. Reset remounts the demo
 * so a reader can always get back to the initial layout.
 */
export function Example({
  title,
  caption,
  whatToTry,
  source,
  frameClassName,
  variant = "tabs",
  children,
}: {
  title: string;
  /** Required by convention: one sentence on what this example proves. */
  caption: string;
  /** Short imperative hints ("Drag the seam past 120px", …). */
  whatToTry?: string[];
  source: string;
  /** Override the frame size, e.g. "h-72" for tall vertical demos. */
  frameClassName?: string;
  variant?: "stacked" | "tabs";
  children: ReactNode;
}) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  // Bumping the key unmounts and remounts the demo — every example returns
  // to its declarative initial layout with no per-example reset wiring.
  const [runKey, setRunKey] = useState(0);
  // Slot for the example's <DemoControls>: helper buttons render here, in
  // the chrome row above the frame, never inside the demo layout itself.
  const [controlsSlot, setControlsSlot] = useState<HTMLDivElement | null>(null);
  const showTabs = variant === "tabs";
  const showPreview = !showTabs || tab === "preview";
  const showCode = !showTabs || tab === "code";

  return (
    <figure className="my-5 flex flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <figcaption className="flex min-w-0 flex-col gap-0.5">
          {/* Block elements so markdown extraction keeps title and caption
              on separate lines instead of smashing them together. */}
          <p className="text-[13px] font-medium text-foreground">{title}</p>
          {caption ? (
            <p className="text-[13px] text-muted-foreground">{caption}</p>
          ) : null}
        </figcaption>
        <div className="flex shrink-0 items-center gap-1" data-markdown-exclude>
          {showTabs ? (
            <Segmented
              options={["preview", "code"] as const}
              value={tab}
              onValueChange={setTab}
              labels={{ preview: "Preview", code: "Code" }}
            />
          ) : null}
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => setRunKey((k) => k + 1)}
            title="Reset the demo to its initial layout"
            className="text-muted-foreground hover:text-foreground"
          >
            {/* Keyed by runKey so each click remounts the icon and replays
                the one-shot spin; reversed to match the CCW arrow. Guarded
                so it does not spin on initial mount. */}
            <RotateCcw
              key={runKey}
              className={cn(
                "size-3.5",
                runKey > 0 && "animate-[spin_400ms_ease-in-out_reverse]",
              )}
              aria-hidden
            />
            <span className="sr-only">Reset demo</span>
          </Button>
        </div>
      </div>
      {/* DemoSurface is the same viewport MiniDemoFrame uses: definite height
          (PanelGroup fills its container), user-resizable corner, and the
          data-resizable-panels-demo-frame attribute that keeps handle seams
          visible at rest. No PanelProvider here — examples that need one
          declare it themselves, so the provider teaching stays honest.
          Kept mounted in both tabs so switching to Code and back does not
          reset live layout state. */}
      <div className={cn(!showPreview && "hidden")}>
        {/* Helper controls land here via <DemoControls> — separate from the
            demo layout, so the frame below holds only the panel setup. */}
        <div
          ref={setControlsSlot}
          data-markdown-exclude
          className="mb-2 flex flex-wrap items-center gap-2 empty:hidden"
        />
        <DemoControlsSlotContext.Provider value={controlsSlot}>
          <DemoSurface className={cn("h-56", frameClassName)}>
            <div key={runKey} className="h-full w-full">
              {children}
            </div>
          </DemoSurface>
        </DemoControlsSlotContext.Provider>
        {whatToTry && whatToTry.length > 0 ? (
          <div
            data-markdown-exclude
            className="mt-2 flex flex-col gap-1 border-l-2 border-border pl-3"
          >
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
              Try it
            </span>
            <ul className="flex flex-col gap-0.5 text-[13px] text-muted-foreground">
              {whatToTry.map((hint) => (
                <li key={hint} className="flex items-baseline gap-1.5">
                  <span
                    aria-hidden
                    className="select-none font-mono text-muted-foreground/50"
                  >
                    ›
                  </span>
                  <span>{hint}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className={cn(!showCode && "hidden")}>
        <CodeBlock code={source} lang="tsx" />
      </div>
    </figure>
  );
}

/**
 * Inline aside for facts that must not be missed in a scan: `note` for
 * load-bearing behavior summaries, `warning` for foot-guns. Built on the
 * shadcn Alert. Use sparingly — a page with more than a couple of callouts
 * has structure problems.
 */
export function Callout({
  variant = "note",
  title,
  children,
}: {
  variant?: "note" | "warning";
  /** Required by convention: every callout leads with a scannable title. */
  title: string;
  children: ReactNode;
}) {
  const Icon = variant === "warning" ? TriangleAlert : Info;
  return (
    <Alert
      variant={variant === "warning" ? "warning" : "default"}
      className="my-1"
    >
      <Icon aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function Table({
  rows,
  headers = ["Prop", "Type", "Notes"],
}: {
  rows: [string, ReactNode, ReactNode][];
  /** Column labels — default fits prop tables; override for fact tables. */
  headers?: [string, string, string];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <ShadcnTable>
        <TableHeader className="bg-muted/50 text-[13px] uppercase tracking-wider text-muted-foreground">
          <TableRow>
            {headers.map((header) => (
              <TableHead
                key={header}
                className="h-auto px-3 py-2 text-[13px] text-muted-foreground"
              >
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(([name, type, notes], index) => (
            <TableRow key={`${name}-${index}`} className="align-top">
              <TableCell className="px-3 py-2 font-mono text-[13px]">
                {name}
              </TableCell>
              <TableCell className="px-3 py-2 text-[13px] whitespace-normal">
                {type}
              </TableCell>
              <TableCell className="px-3 py-2 text-[13px] whitespace-normal text-muted-foreground">
                {notes}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </ShadcnTable>
    </div>
  );
}
