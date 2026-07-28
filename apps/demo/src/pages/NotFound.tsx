import { ArrowRight, BookOpen } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DOCS_HOME } from "@/pages/docs/doc-meta";

export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <div className="relative isolate min-h-full overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,#000_25%,transparent_75%)]"
      />

      <div className="mx-auto flex min-h-[min(100%,36rem)] max-w-3xl flex-col justify-center px-6 py-20 sm:py-24">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Error 404
        </p>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          This panel collapsed
          <span className="text-muted-foreground"> out of existence.</span>
        </h1>

        <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
          No layout owns{" "}
          <code className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
            {pathname}
          </code>
          . Drag yourself back to something that still has a size.
        </p>

        <BrokenSplit className="mt-10" />

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className={buttonVariants({ variant: "secondary" })}>
            Back home
          </Link>
          <Link to={DOCS_HOME} className={buttonVariants({ variant: "default" })}>
            <BookOpen className="size-4" />
            Read the docs
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Decorative three-pane shell with the middle panel missing — on-brand, not a card. */
function BrokenSplit({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-sm shadow-black/5",
        className,
      )}
    >
      <div className="flex h-9 items-center gap-2 border-b border-border bg-secondary/40 px-3">
        <span className="size-2.5 rounded-full bg-red-400/70" />
        <span className="size-2.5 rounded-full bg-amber-400/70" />
        <span className="size-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-2 font-mono text-[11px] text-muted-foreground">
          layout.tsx
        </span>
      </div>
      <div className="flex h-36">
        <div className="flex w-[28%] flex-col gap-2 border-r border-border bg-muted/40 p-3">
          <div className="h-2 w-3/4 rounded-sm bg-foreground/15" />
          <div className="h-2 w-1/2 rounded-sm bg-foreground/10" />
          <div className="h-2 w-2/3 rounded-sm bg-foreground/10" />
        </div>
        <div className="relative flex min-w-0 flex-1 items-center justify-center border-r border-dashed border-border/80 bg-background">
          <div className="absolute inset-3 rounded-md border border-dashed border-border/70" />
          <span className="relative font-mono text-xs text-muted-foreground">
            panel missing
          </span>
        </div>
        <div className="flex w-[22%] flex-col gap-2 bg-muted/30 p-3">
          <div className="h-2 w-full rounded-sm bg-foreground/12" />
          <div className="h-2 w-4/5 rounded-sm bg-foreground/8" />
          <div className="mt-auto h-8 rounded-md border border-border/60 bg-background/60" />
        </div>
      </div>
    </div>
  );
}
