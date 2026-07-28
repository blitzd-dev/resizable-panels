import {
  GripVertical,
  LayoutGrid,
  type LucideIcon,
  Menu,
  Moon,
  PanelLeftClose,
  Pin,
  Ruler,
  SlidersHorizontal,
  Sun,
  Waves,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { DocsNavigation } from "@/components/navigation/docs-navigation";
import {
  MobileNavLink,
  MobileNavList,
  MobileNavSection,
} from "@/components/navigation/mobile-navigation";
import { useTheme } from "@/components/theme-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { EXAMPLES } from "@/lib/examples";
import { MINI_DEMO_GROUPS } from "@/lib/mini-demos";
import { cn } from "@/lib/utils";

// Per-group icons for the Mini demos menu, mirroring the Docs menu's
// icon-led group headers. Keyed by MINI_DEMO_GROUPS label.
const MINI_DEMO_GROUP_ICONS: Record<string, LucideIcon> = {
  Sizing: Ruler,
  Layouts: LayoutGrid,
  Cascades: Waves,
  Pinned: Pin,
  "Open & close": PanelLeftClose,
  Handles: GripVertical,
  "Control & state": SlidersHorizontal,
};

// Docs, Mini demos, and Demos are dropdown sections (desktop) / grouped
// lists (mobile) rather than flat links — see DesktopNav / MobileNav.
export function DemoNav() {
  return (
    <header className="relative z-50 shrink-0 border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-360 items-center justify-between px-6 py-2">
        <MobileNav />
        <DesktopNav />

        <div className="flex items-center gap-1">
          <GitHubLink />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function DesktopNav() {
  const { pathname, hash } = useLocation();
  const onDocs = pathname.startsWith("/docs");
  const onMiniDemos = pathname === "/mini-demos";
  const onDemos = pathname === "/demos" || pathname.startsWith("/demos/");

  return (
    <>
      <Link
        to="/"
        className={cn(
          navigationMenuTriggerStyle(),
          "hidden focus:bg-transparent focus:hover:bg-muted lg:inline-flex",
        )}
      >
        @blitzd/resizable-panels
      </Link>
      <NavigationMenu className="hidden justify-start lg:absolute lg:left-1/2 lg:flex lg:-translate-x-1/2">
        <NavigationMenuList className="gap-1">
          <NavigationMenuItem>
            <NavigationMenuTrigger
              data-active={onDocs || undefined}
              className="data-active:bg-primary/10 data-active:text-primary"
            >
              Docs
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <DocsNavigation surface="menu" activePathname={pathname} />
            </NavigationMenuContent>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <NavigationMenuTrigger
              data-active={onMiniDemos || undefined}
              className="data-active:bg-primary/10 data-active:text-primary"
            >
              Mini demos
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <div className="w-170 p-3">
                {/* Masonry columns: the 7 uneven groups pack top-to-bottom
                    instead of aligning to the tallest cell in a grid row —
                    keeps the menu short and wide, matching Docs. */}
                <div className="columns-3 gap-x-3 [&>div]:mb-3 [&>div]:break-inside-avoid">
                  {MINI_DEMO_GROUPS.map((group) => {
                    const Icon = MINI_DEMO_GROUP_ICONS[group.label];
                    return (
                      <div key={group.label}>
                        <div className="flex items-center gap-2 px-2 py-1 text-[13px] font-medium text-foreground">
                          {Icon && (
                            <Icon aria-hidden="true" className="size-3.5" />
                          )}
                          {group.label}
                        </div>
                        <ul className="mt-0.5">
                          {group.demos.map((demo) => (
                            <li key={demo.slug}>
                              <NavigationMenuLink
                                render={
                                  <Link to={`/mini-demos#${demo.slug}`} />
                                }
                                active={onMiniDemos && hash === `#${demo.slug}`}
                                closeOnClick
                                className="py-1 text-[13px] text-muted-foreground data-active:bg-muted data-active:font-medium data-active:text-foreground hover:text-foreground"
                              >
                                {demo.title}
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <NavigationMenuTrigger
              data-active={onDemos || undefined}
              className="data-active:bg-primary/10 data-active:text-primary"
            >
              Demos
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-[360px] gap-1 p-2">
                <li>
                  <NavigationMenuLink
                    render={<Link to="/demos" />}
                    active={pathname === "/demos"}
                    closeOnClick
                    className="items-center gap-3 data-active:bg-primary/10 data-active:text-primary"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-none">
                        Browse all
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        See every example in one list.
                      </p>
                    </div>
                  </NavigationMenuLink>
                </li>
                {EXAMPLES.map((ex) => {
                  const to = `/demos/${ex.slug}`;
                  return (
                    <li key={ex.slug}>
                      <NavigationMenuLink
                        render={<Link to={to} />}
                        active={pathname === to}
                        closeOnClick
                        className="group items-start gap-3 data-active:bg-primary/10 data-active:text-primary"
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted group-data-active:bg-primary/20">
                          <ex.Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium leading-none">
                            {ex.title}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {ex.description}
                          </p>
                        </div>
                      </NavigationMenuLink>
                    </li>
                  );
                })}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <NavigationMenuLink
              render={<Link to="/changelog" />}
              active={pathname.startsWith("/changelog")}
              closeOnClick
              className={cn(
                navigationMenuTriggerStyle(),
                "data-active:bg-primary/10 data-active:text-primary",
              )}
            >
              Changelog
            </NavigationMenuLink>
          </NavigationMenuItem>

          {import.meta.env.DEV ? (
            <NavigationMenuItem>
              <NavigationMenuLink
                render={<Link to="/arena" />}
                active={pathname === "/arena"}
                closeOnClick
                className={cn(
                  navigationMenuTriggerStyle(),
                  "data-active:bg-primary/10 data-active:text-primary",
                )}
              >
                Arena
              </NavigationMenuLink>
            </NavigationMenuItem>
          ) : null}
        </NavigationMenuList>
      </NavigationMenu>
    </>
  );
}

function MobileNav() {
  const location = useLocation();
  const { pathname, hash } = location;
  const [open, setOpen] = useState(false);

  // Close the drawer whenever the user navigates so the freshly-revealed page
  // is visible without an extra tap on the backdrop. Adjusted during render
  // (the "previous render" pattern) rather than in an effect so the closed
  // drawer commits in the same paint as the new page. Keyed on location.key
  // (not pathname) so hash-only navigations — the mini-demo anchors — close
  // it too.
  const [prevKey, setPrevKey] = useState(location.key);
  if (prevKey !== location.key) {
    setPrevKey(location.key);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open navigation"
            className="lg:hidden"
          />
        }
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-80 max-w-[85vw] p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="text-base">Menu</SheetTitle>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <nav className="p-2 [&_ul]:gap-px">
            <MobileNavList>
              <li>
                <MobileNavLink to="/" active={pathname === "/"}>
                  Home
                </MobileNavLink>
              </li>
              <li>
                <MobileNavLink
                  to="/changelog"
                  active={pathname.startsWith("/changelog")}
                >
                  Changelog
                </MobileNavLink>
              </li>
              {import.meta.env.DEV ? (
                <li>
                  <MobileNavLink to="/arena" active={pathname === "/arena"}>
                    Arena
                  </MobileNavLink>
                </li>
              ) : null}
            </MobileNavList>

            <MobileNavSection label="Docs">
              <DocsNavigation surface="mobile" activePathname={pathname} />
            </MobileNavSection>

            <MobileNavSection label="Mini demos">
              <MobileNavList>
                {MINI_DEMO_GROUPS.map((group) => (
                  <li key={group.label}>
                    <div className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                      {group.label}
                    </div>
                    <ul className="flex flex-col">
                      {group.demos.map((demo) => {
                        const active =
                          pathname === "/mini-demos" &&
                          hash === `#${demo.slug}`;
                        return (
                          <li key={demo.slug}>
                            <MobileNavLink
                              to={`/mini-demos#${demo.slug}`}
                              active={active}
                              nested
                            >
                              {demo.title}
                            </MobileNavLink>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </MobileNavList>
            </MobileNavSection>

            <MobileNavSection label="Demos">
              <MobileNavList>
                <li>
                  <MobileNavLink to="/demos" active={pathname === "/demos"}>
                    Browse all
                  </MobileNavLink>
                </li>
                {EXAMPLES.map((ex) => {
                  const to = `/demos/${ex.slug}`;
                  const active = pathname === to;
                  return (
                    <li key={ex.slug}>
                      <MobileNavLink
                        to={to}
                        active={active}
                        className="items-start gap-3"
                      >
                        <div
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-md bg-muted",
                            active && "bg-primary/20",
                          )}
                        >
                          <ex.Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium leading-none">
                            {ex.title}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {ex.description}
                          </p>
                        </div>
                      </MobileNavLink>
                    </li>
                  );
                })}
              </MobileNavList>
            </MobileNavSection>
          </nav>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function GitHubLink() {
  return (
    <a
      href="https://github.com/blitzd-dev/resizable-panels"
      target="_blank"
      rel="noreferrer"
      title="GitHub"
      aria-label="GitHub"
      className={buttonVariants({ variant: "ghost", size: "icon" })}
    >
      <svg
        viewBox="0 0 98 96"
        aria-hidden="true"
        className="size-5 fill-current"
      >
        <path d="M41.4395 69.3848C28.8066 67.8535 19.9062 58.7617 19.9062 46.9902C19.9062 42.2051 21.6289 37.0371 24.5 33.5918C23.2559 30.4336 23.4473 23.7344 24.8828 20.959C28.7109 20.4805 33.8789 22.4902 36.9414 25.2656C40.5781 24.1172 44.4062 23.543 49.0957 23.543C53.7852 23.543 57.6133 24.1172 61.0586 25.1699C64.0254 22.4902 69.2891 20.4805 73.1172 20.959C74.457 23.543 74.6484 30.2422 73.4043 33.4961C76.4668 37.1328 78.0937 42.0137 78.0937 46.9902C78.0937 58.7617 69.1934 67.6621 56.3691 69.2891C59.623 71.3945 61.8242 75.9883 61.8242 81.252L61.8242 91.2051C61.8242 94.0762 64.2168 95.7031 67.0879 94.5547C84.4102 87.9512 98 70.6289 98 49.1914C98 22.1074 75.9883 6.69539e-07 48.9043 4.309e-07C21.8203 1.92261e-07 -1.9479e-07 22.1074 -4.3343e-07 49.1914C-6.20631e-07 70.4375 13.4941 88.0469 31.6777 94.6504C34.2617 95.6074 36.75 93.8848 36.75 91.3008L36.75 83.6445C35.4102 84.2188 33.6875 84.6016 32.1562 84.6016C25.8398 84.6016 22.1074 81.1563 19.4277 74.7441C18.375 72.1602 17.2266 70.6289 15.0254 70.3418C13.877 70.2461 13.4941 69.7676 13.4941 69.1934C13.4941 68.0449 15.4082 67.1836 17.3223 67.1836C20.0977 67.1836 22.4902 68.9063 24.9785 72.4473C26.8926 75.2227 28.9023 76.4668 31.2949 76.4668C33.6875 76.4668 35.2187 75.6055 37.4199 73.4043C39.0469 71.7773 40.291 70.3418 41.4395 69.3848Z" />
      </svg>
      <span className="sr-only">GitHub</span>
    </a>
  );
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  const Icon = isDark ? Sun : Moon;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      aria-pressed={isDark}
    >
      <Icon className="size-5" />
    </Button>
  );
}
