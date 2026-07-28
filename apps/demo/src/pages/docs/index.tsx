import { Check, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { DocsNavigation } from "@/components/navigation/docs-navigation";
import { useSidebarSlot } from "@/components/sidebar-slot";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { docsToMarkdown } from "@/lib/docs-to-markdown";
import { absoluteUrl } from "@/lib/site";
import { useCopyFeedback } from "@/lib/use-copy-feedback";
import { cn } from "@/lib/utils";
import NotFound from "@/pages/NotFound";
import {
  DOC_PAGES,
  type DocPage,
  groupForPage,
  redirectForDocSlug,
} from "./pages";

type TocHeading = { id: string; text: string };

function decodeHashId(hash: string) {
  const encoded = hash.replace(/^#/, "");
  if (!encoded) return null;

  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

export default function Docs() {
  const { slug } = useParams();
  const { hash } = useLocation();
  const pageIndex = DOC_PAGES.findIndex((p) => p.slug === slug);
  const page = pageIndex === -1 ? null : DOC_PAGES[pageIndex];

  const sidebarSlot = useSidebarSlot();
  const scrollRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const programmaticHeadingRef = useRef<string | null>(null);
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);

  // Collect this page's section headings for the "On this page" rail and
  // reset scroll on navigation.
  useLayoutEffect(() => {
    if (!page) return;
    programmaticHeadingRef.current = null;
    if (scrollIdleTimerRef.current) {
      clearTimeout(scrollIdleTimerRef.current);
      scrollIdleTimerRef.current = null;
    }
    const root = scrollRef.current;
    const article = articleRef.current;
    const els = article
      ? Array.from(article.querySelectorAll<HTMLHeadingElement>("h2[id]"))
      : [];
    const pageHeadings = els.map((el) => ({
      id: el.id,
      text: el.textContent ?? "",
    }));
    setHeadings(pageHeadings);

    const hashId = decodeHashId(hash);
    const hashTarget = hashId ? document.getElementById(hashId) : null;
    if (root && article && hashTarget && article.contains(hashTarget)) {
      const rootTop = root.getBoundingClientRect().top;
      const targetTop =
        hashTarget.getBoundingClientRect().top - rootTop + root.scrollTop;
      root.scrollTo({ top: targetTop });
    } else {
      root?.scrollTo({ top: 0 });
    }

    setActiveHeading(
      hashId && pageHeadings.some((heading) => heading.id === hashId)
        ? hashId
        : (pageHeadings[0]?.id ?? null),
    );
  }, [hash, page]);

  // Scroll-spy: the active heading is the last one above the top of the
  // viewport (with a small offset).
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || headings.length === 0) return;

    const updateActiveHeading = () => {
      const rootTop = root.getBoundingClientRect().top;
      let current = headings[0].id;
      for (const h of headings) {
        const el = document.getElementById(h.id);
        if (el && el.getBoundingClientRect().top - rootTop <= 96) {
          current = h.id;
        }
      }
      setActiveHeading(current);
    };

    const releaseProgrammaticScroll = () => {
      programmaticHeadingRef.current = null;
      scrollIdleTimerRef.current = null;
      updateActiveHeading();
    };

    const scheduleRelease = () => {
      if (scrollIdleTimerRef.current) {
        clearTimeout(scrollIdleTimerRef.current);
      }
      scrollIdleTimerRef.current = setTimeout(releaseProgrammaticScroll, 120);
    };

    const onScroll = () => {
      const programmaticTarget = programmaticHeadingRef.current;
      if (programmaticTarget) {
        setActiveHeading(programmaticTarget);
        scheduleRelease();
        return;
      }
      updateActiveHeading();
    };

    updateActiveHeading();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (scrollIdleTimerRef.current) {
        clearTimeout(scrollIdleTimerRef.current);
        scrollIdleTimerRef.current = null;
      }
      programmaticHeadingRef.current = null;
    };
  }, [headings]);

  if (!page) {
    const redirect = redirectForDocSlug(slug);
    if (redirect) return <Navigate to={redirect} replace />;
    return <NotFound />;
  }

  const group = groupForPage(page.slug);
  const prev = DOC_PAGES[pageIndex - 1];
  const next = DOC_PAGES[pageIndex + 1];

  const scrollToHeading = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string,
  ) => {
    e.preventDefault();
    const root = scrollRef.current;
    const el = document.getElementById(id);
    if (root && el) {
      programmaticHeadingRef.current = id;
      if (scrollIdleTimerRef.current) {
        clearTimeout(scrollIdleTimerRef.current);
      }
      // Covers the no-op case where the target is already in position and no
      // scroll event fires. Active smooth scrolling continually resets this.
      scrollIdleTimerRef.current = setTimeout(() => {
        programmaticHeadingRef.current = null;
        scrollIdleTimerRef.current = null;
      }, 120);
      const rootTop = root.getBoundingClientRect().top;
      const targetTop =
        el.getBoundingClientRect().top - rootTop + root.scrollTop;
      root.scrollTo({ top: targetTop, behavior: "smooth" });
      window.history.pushState(null, "", `#${encodeURIComponent(id)}`);
      setActiveHeading(id);
    }
  };

  return (
    <>
      {sidebarSlot.el &&
        createPortal(
          <DocsNavigation
            surface="sidebar"
            activePathname={`/docs/${page.slug}`}
            className="px-7 py-5"
          />,
          sidebarSlot.el,
        )}
      <ScrollArea className="h-full" viewportRef={scrollRef}>
        <div className="mx-auto w-full max-w-[96rem] px-5 pt-10 pb-16 sm:px-8 lg:px-10">
          <div className="mx-auto grid w-full max-w-[82rem] grid-cols-1 gap-14 xl:grid-cols-[minmax(0,1fr)_13rem]">
            <article
              ref={articleRef}
              data-docs-article
              className="mx-auto w-full min-w-0 max-w-4xl xl:max-w-none"
            >
              <div className="mb-5 flex min-w-0 items-start justify-between gap-4">
                <Breadcrumb className="min-w-0 pt-1">
                  <BreadcrumbList className="gap-2 text-[15px]">
                    {group && (
                      <>
                        <BreadcrumbItem>
                          <span>{group.label}</span>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                      </>
                    )}
                    <BreadcrumbItem>
                      <BreadcrumbPage>{page.title}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
                <DocsPageActions
                  page={page}
                  contentRef={contentRef}
                  prev={prev}
                  next={next}
                />
              </div>

              <h1
                className={cn(
                  "min-w-0 [overflow-wrap:anywhere] text-4xl leading-[1.05] font-bold tracking-[-0.04em] sm:text-5xl",
                  isCodeHeading(page.heading) && "font-mono tracking-[-0.05em]",
                )}
              >
                <DocsHeadingText heading={page.heading} />
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {page.description}
              </p>

              <div
                ref={contentRef}
                data-docs-content
                className="mt-8 space-y-6 text-[15px] leading-7 text-foreground sm:text-base"
              >
                <page.Body />
              </div>

              <Separator className="mt-14 mb-6" />
              <nav
                aria-label="Docs pagination"
                className="flex items-stretch justify-between gap-4"
              >
                {prev ? <PagerLink page={prev} dir="prev" /> : <span />}
                {next ? <PagerLink page={next} dir="next" /> : <span />}
              </nav>

              <DocsFooter />
            </article>

            <aside className="sticky top-12 hidden w-52 shrink-0 self-start xl:block">
              {headings.length > 0 && (
                <nav aria-label="On this page">
                  <div className="mb-3 text-sm font-semibold text-foreground">
                    On this page
                  </div>
                  <ul className="flex flex-col border-l border-border text-sm">
                    {headings.map((h) => (
                      <li key={h.id} className="relative">
                        <a
                          href={`#${h.id}`}
                          onClick={(e) => scrollToHeading(e, h.id)}
                          aria-current={
                            activeHeading === h.id ? "location" : undefined
                          }
                          className={cn(
                            "block truncate py-2 pl-4 transition-colors before:absolute before:inset-y-0 before:-left-px before:w-px before:bg-transparent",
                            activeHeading === h.id
                              ? "font-medium text-foreground before:bg-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {h.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
            </aside>
          </div>
        </div>
      </ScrollArea>
    </>
  );
}

function DocsFooter() {
  return (
    <footer className="mt-16 w-full border-t border-border py-8 text-xs text-muted-foreground">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <span>© 2026 blitzd dev · MIT licensed</span>
        <nav
          aria-label="Project links"
          className="flex flex-wrap gap-x-5 gap-y-2"
        >
          <Link
            to="/changelog"
            className="transition-colors hover:text-foreground"
          >
            Changelog
          </Link>
          <a
            href="https://www.npmjs.com/package/@blitzd/resizable-panels"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            npm
          </a>
          <a
            href="https://github.com/blitzd-dev/resizable-panels"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}

/**
 * Code-shaped headings (`<PanelGroup>`, `usePanelActions()`, `apiRef`) keep
 * the mono face; prose headings ("How it fits together") render in sans.
 */
function isCodeHeading(heading: string): boolean {
  return (
    heading.startsWith("<") ||
    heading.endsWith("()") ||
    /^[a-z]+[A-Z][A-Za-z]*$/.test(heading)
  );
}

function DocsHeadingText({ heading }: { heading: string }) {
  let offset = 0;

  return heading.split(/(?<=[a-z])(?=[A-Z])/).map((segment) => {
    const segmentOffset = offset;
    offset += segment.length;

    return (
      <Fragment key={segmentOffset}>
        {segmentOffset > 0 && <wbr />}
        {segment}
      </Fragment>
    );
  });
}

function DocsPageActions({
  page,
  contentRef,
  prev,
  next,
}: {
  page: DocPage;
  contentRef: React.RefObject<HTMLDivElement | null>;
  prev?: DocPage;
  next?: DocPage;
}) {
  const { copied, copy } = useCopyFeedback(() => {
    const content = contentRef.current;
    return content
      ? docsToMarkdown(page.heading, content, {
          description: page.description,
          pageUrl: absoluteUrl(`/docs/${page.slug}`),
        })
      : "";
  });

  return (
    <div
      className="hidden shrink-0 items-center gap-3 sm:flex"
      data-markdown-exclude
    >
      <div className="hidden sm:block">
        <ButtonGroup aria-label="Documentation actions">
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copied" : "Copy Markdown"}
          </Button>
        </ButtonGroup>
      </div>
      <nav aria-label="Page navigation" className="flex items-center gap-2">
        <DocPageArrow page={prev} direction="prev" />
        <DocPageArrow page={next} direction="next" />
      </nav>
    </div>
  );
}

function DocPageArrow({
  page,
  direction,
}: {
  page?: DocPage;
  direction: "prev" | "next";
}) {
  const isNext = direction === "next";
  const Icon = isNext ? ChevronRight : ChevronLeft;
  const label = isNext ? "Next page" : "Previous page";

  if (!page) return null;

  return (
    <Link
      to={`/docs/${page.slug}`}
      className={buttonVariants({ variant: "outline", size: "icon" })}
      aria-label={`${label}: ${page.title}`}
    >
      <Icon className="size-4" />
    </Link>
  );
}

function PagerLink({ page, dir }: { page: DocPage; dir: "prev" | "next" }) {
  const isNext = dir === "next";
  const Chevron = isNext ? ChevronRight : ChevronLeft;

  return (
    <Link
      to={`/docs/${page.slug}`}
      className={cn(
        "group flex items-center gap-3 py-2",
        isNext && "flex-row-reverse text-right",
      )}
    >
      <Chevron className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
      <span className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">
          {isNext ? "Next" : "Previous"}
        </span>
        <span className="text-sm font-medium text-foreground group-hover:text-primary">
          {page.title}
        </span>
      </span>
    </Link>
  );
}
