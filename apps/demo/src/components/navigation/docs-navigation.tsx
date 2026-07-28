import { BookOpen, Box, type LucideIcon, Rocket } from "lucide-react";
import { Link } from "react-router-dom";
import { NavigationMenuLink } from "@/components/ui/navigation-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { DOC_GROUP_META, type DocGroupMeta } from "@/pages/docs/doc-meta";

type DocsNavigationSurface = "menu" | "mobile" | "sidebar";

const DOC_GROUP_ICONS: Record<string, LucideIcon> = {
  "get-started": Rocket,
  guides: Box,
  reference: BookOpen,
};

const DOC_GROUP_NAV_LABELS: Record<string, string> = {
  "managing-state": "Managing state",
  "driving-panels": "Driving panels",
  "a11y-mobile": "Accessibility",
};

const DOC_PAGE_NAV_LABELS: Record<string, string> = {
  installation: "Installation",
  "controlled-value-and-events": "Layout value & events",
  "imperative-api": "Imperative control",
  "hooks-read-state": "Reading state with hooks",
  "hooks-dispatch-actions": "Commanding with hooks",
};

export function DocsNavigation({
  activePathname,
  surface,
  className,
}: {
  activePathname: string;
  surface: DocsNavigationSurface;
  className?: string;
}) {
  if (surface === "menu") {
    return (
      <div
        className={cn(
          // One column per group: the 3-group IA (3/10/10 pages) balances
          // as columns, never as a wrapping grid.
          "grid w-[620px] grid-cols-3 items-start gap-x-3 p-3",
          className,
        )}
      >
        {DOC_GROUP_META.map((group) => (
          <DocsMenuGroup
            key={group.label}
            group={group}
            activePathname={activePathname}
          />
        ))}
      </div>
    );
  }

  if (surface === "mobile") {
    return (
      <ul className={cn("flex flex-col", className)}>
        {DOC_GROUP_META.map((group) => (
          <DocsMobileGroup
            key={group.label}
            group={group}
            activePathname={activePathname}
          />
        ))}
      </ul>
    );
  }

  const activeGroup = groupForPath(activePathname) ?? DOC_GROUP_META[0];

  return (
    <ScrollArea className="h-full">
      <nav aria-label="Documentation" className={cn("text-sm", className)}>
        <ul
          aria-label="Documentation sections"
          className="flex flex-col gap-1 border-b border-border pb-4"
        >
          {DOC_GROUP_META.map((group) => (
            <DocsSidebarGroupLink
              key={group.label}
              group={group}
              selected={group === activeGroup}
            />
          ))}
        </ul>
        <ul
          aria-label={`${activeGroup.label} pages`}
          className="flex flex-col gap-1 pt-4"
        >
          {activeGroup.pages.map((page) => (
            <DocsSidebarPageLink
              key={page.slug}
              page={page}
              activePathname={activePathname}
            />
          ))}
        </ul>
      </nav>
    </ScrollArea>
  );
}

function DocsMenuGroup({
  group,
  activePathname,
}: {
  group: DocGroupMeta;
  activePathname: string;
}) {
  const Icon = iconForGroup(group);
  const selected = groupContainsPath(group, activePathname);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1 text-[13px] font-medium text-foreground",
          selected && "bg-muted",
        )}
      >
        <Icon aria-hidden="true" className="size-3.5" />
        {navLabelForGroup(group)}
      </div>
      <ul className="mt-0.5">
        {group.pages.map((page) => {
          const to = docsPath(page.slug);
          return (
            <li key={page.slug}>
              <NavigationMenuLink
                render={<Link to={to} />}
                active={activePathname === to}
                closeOnClick
                className="py-1 text-[13px] text-muted-foreground data-active:bg-muted data-active:font-medium data-active:text-foreground hover:text-foreground"
              >
                {navLabelForPage(page)}
              </NavigationMenuLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DocsMobileGroup({
  group,
  activePathname,
}: {
  group: DocGroupMeta;
  activePathname: string;
}) {
  const Icon = iconForGroup(group);
  const selected = groupContainsPath(group, activePathname);

  return (
    <li>
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground",
          selected && "bg-muted font-semibold",
        )}
      >
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        {navLabelForGroup(group)}
      </div>
      <ul className="ml-5 flex flex-col border-l border-border/80 pl-2">
        {group.pages.map((page) => {
          const to = docsPath(page.slug);
          return (
            <li key={page.slug}>
              <Link
                to={to}
                aria-current={activePathname === to ? "page" : undefined}
                className={mobileDocsPageLink(activePathname === to)}
              >
                {navLabelForPage(page)}
              </Link>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

function DocsSidebarGroupLink({
  group,
  selected,
}: {
  group: DocGroupMeta;
  selected: boolean;
}) {
  const firstPageTo = docsPath(group.pages[0].slug);

  return (
    <li>
      <Link
        to={firstPageTo}
        aria-current={selected ? "location" : undefined}
        className={cn(
          "flex h-8 min-w-0 items-center rounded-md px-2 text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground",
          selected && "bg-muted font-semibold text-foreground",
        )}
      >
        <span className="truncate">{navLabelForGroup(group)}</span>
      </Link>
    </li>
  );
}

function DocsSidebarPageLink({
  page,
  activePathname,
}: {
  page: DocGroupMeta["pages"][number];
  activePathname: string;
}) {
  const to = docsPath(page.slug);
  const active = activePathname === to;

  return (
    <li>
      <Link
        to={to}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-8 min-w-0 items-center rounded-md px-2 text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground",
          active && "bg-muted font-medium text-foreground",
        )}
      >
        <span className="truncate">{navLabelForPage(page)}</span>
      </Link>
    </li>
  );
}

function groupForPath(pathname: string) {
  return DOC_GROUP_META.find((group) => groupContainsPath(group, pathname));
}

function groupContainsPath(group: DocGroupMeta, pathname: string) {
  return group.pages.some((page) => pathname === docsPath(page.slug));
}

function iconForGroup(group: DocGroupMeta) {
  return DOC_GROUP_ICONS[group.slug] ?? BookOpen;
}

function navLabelForGroup(group: DocGroupMeta) {
  return DOC_GROUP_NAV_LABELS[group.slug] ?? group.label;
}

function navLabelForPage(page: DocGroupMeta["pages"][number]) {
  return DOC_PAGE_NAV_LABELS[page.slug] ?? page.title;
}

function docsPath(slug: string) {
  return `/docs/${slug}`;
}

function mobileDocsPageLink(active: boolean) {
  return cn(
    "flex items-center gap-2.5 rounded-lg py-2 pr-3 pl-6 text-sm",
    active
      ? "bg-muted font-semibold text-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-foreground",
  );
}
