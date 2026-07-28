import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { CodeBlock } from "@/components/code-block";
import { Segmented } from "@/components/segmented";
import { cn } from "@/lib/utils";

/** Docs pages a card can point at, mapped to their menu label. Keys are the
 *  new-IA doc slugs — the link resolves to `/docs/<slug>`. */
const DOCS_LABELS = {
  sizing: "Sizing",
  "building-layouts": "Building layouts",
  collapsing: "Collapsing",
  "styling-and-slot-props": "Styling & slot props",
  persistence: "Persistence",
  "imperative-and-actions": "Imperative & actions",
} as const;

export type DocsSlug = keyof typeof DOCS_LABELS;

/** A demo card component, keyed by slug in each group module's export. */
export type MiniDemoComponent = () => ReactNode;

/**
 * The shared chrome for every mini demo: a stable anchor (`id={slug}`, linked
 * from the header dropdown as `/mini-demos#<slug>`), a title + one-sentence
 * caption, a Preview/Code toggle (preview default, code kept mounted so it is
 * always ready), the live demo, and a DocLink-style pointer to the docs page
 * that owns the feature.
 */
export function MiniDemoCard({
  slug,
  title,
  caption,
  code,
  docsSlug,
  children,
}: {
  /** Frozen anchor id — must match the registry slug in lib/mini-demos.ts.
   *  Also the test hook: `[data-demo="<slug>"]`. */
  slug: string;
  title: string;
  caption: string;
  code: string;
  docsSlug: DocsSlug;
  children: ReactNode;
}) {
  const [tab, setTab] = useState<"preview" | "code">("preview");

  return (
    <section
      id={slug}
      data-demo={slug}
      className="scroll-mt-4 rounded-xl border border-border bg-card p-4"
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-mono text-sm font-semibold tracking-tight">
            {title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
        </div>
        <div data-markdown-exclude className="shrink-0">
          <Segmented
            options={["preview", "code"] as const}
            value={tab}
            onValueChange={setTab}
            labels={{ preview: "Preview", code: "Code" }}
          />
        </div>
      </header>

      <div className={cn(tab !== "preview" && "hidden")}>{children}</div>
      <div className={cn(tab !== "code" && "hidden")}>
        <CodeBlock code={code} />
      </div>

      <footer className="mt-3">
        <Link
          to={`/docs/${docsSlug}`}
          className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
        >
          {DOCS_LABELS[docsSlug]} docs →
        </Link>
      </footer>
    </section>
  );
}
