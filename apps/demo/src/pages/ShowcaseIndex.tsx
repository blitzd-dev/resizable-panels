import { ArrowRight, BookOpen, Check, Copy } from "lucide-react";
import { Link } from "react-router-dom";
import { HomeDemo } from "@/components/showcase/home-demo/home-demo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCopyFeedback } from "@/lib/use-copy-feedback";

const INSTALL_PACKAGE = "@blitzd/resizable-panels";
const INSTALL_COMMAND = `bun add ${INSTALL_PACKAGE}`;

export default function ShowcaseIndex() {
  const { copied, copy } = useCopyFeedback(INSTALL_COMMAND);

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto w-full min-w-0 max-w-6xl px-6 py-10 sm:py-12">
        {/* Slim two-column hero band: copy left, install + CTAs right, so the
            live demo sits above the fold on a laptop viewport. */}
        <section className="grid min-w-0 gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Resizable Panels
            </h1>
            <p className="mt-3 max-w-xl text-base text-muted-foreground">
              Headless, animated, resizable panel layout primitives for React.
              Docked sidebars and peer splits, collapse to rails, persistence,
              full keyboard support — the library owns layout, not looks.
            </p>
          </div>

          <div className="flex w-full min-w-0 max-w-md flex-col gap-3 lg:w-88">
            {/* min-w-0: grid/flex min-content would otherwise size to the
                install command's w-max pre and shove the page sideways. */}
            <Card className="w-full min-w-0 flex-row items-center gap-1 py-0 pr-1">
              <ScrollArea className="min-w-0 flex-1" orientation="horizontal">
                <pre className="w-max px-4 py-2.5 font-mono text-xs leading-relaxed text-foreground">
                  <code>
                    <span className="text-muted-foreground">$ </span>
                    bun add{" "}
                    <span className="text-primary">{INSTALL_PACKAGE}</span>
                  </code>
                </pre>
              </ScrollArea>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={copy}
                aria-label={copied ? "Copied" : "Copy install command"}
              >
                {copied ? (
                  <Check className="size-3.5 text-primary" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </Card>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/demos"
                className={buttonVariants({ variant: "default" })}
              >
                View demos
                <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/docs"
                className={buttonVariants({ variant: "secondary" })}
              >
                <BookOpen className="size-4" />
                Read the docs
              </Link>
            </div>
          </div>
        </section>

        {/* Pull into the parent px-6 gutter so the grid sits edge-to-edge in
            the content column without overflowing the page scrollport. */}
        <section className="relative isolate -mx-6 mt-8 px-6 sm:mt-10">
          {/* Dot-grid backdrop — graph paper for a layout library. Masked so
              it fades before reaching the section edges. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_65%_70%_at_50%_38%,#000_30%,transparent_78%)]"
          />
          <HomeDemo />
        </section>
      </div>
    </div>
  );
}
