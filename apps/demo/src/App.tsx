import { Panel, PanelGroup, PanelProvider } from "@blitzd/resizable-panels";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { DemoNav } from "@/components/demo-nav";
import { DocumentMeta } from "@/components/document-meta";
import {
  SidebarSlotContext,
  useSidebarSlotProvider,
} from "@/components/sidebar-slot";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import Changelog from "@/pages/Changelog";
import DemosIndex from "@/pages/DemosIndex";
import Docs from "@/pages/docs";
import { DOC_PAGE_META, DOCS_HOME } from "@/pages/docs/doc-meta";
import FourPanelExample from "@/pages/FourPanelExample";
import FourVerticalExample from "@/pages/FourVerticalExample";
import MiniDemos from "@/pages/mini-demos";
import NotFound from "@/pages/NotFound";
import ShadcnSidebarExample from "@/pages/ShadcnSidebarExample";
import ShowcaseIndex from "@/pages/ShowcaseIndex";
import StressExample from "@/pages/StressExample";
import ThreePanelExample from "@/pages/ThreePanelExample";

// Dev-only harness. The false branch is DCE'd in production so arena code
// never ships in the client bundle.
const Arena = import.meta.env.DEV
  ? lazy(() => import("@/pages/arena"))
  : null;

function AppRoutes() {
  const { pathname } = useLocation();
  const sidebarSlot = useSidebarSlotProvider();
  const { setEl: setSidebarEl } = sidebarSlot;

  // Only known docs pages get the docs chrome. Unknown `/docs/...` paths
  // render the shared 404 without an empty sidebar gutter.
  const onDocs = isKnownDocsPath(pathname);
  const showDocsSidebar = useMediaQuery("(min-width: 1024px)");
  const routes = (
    <SidebarSlotContext.Provider value={sidebarSlot}>
      <Routes>
        <Route path="/" element={<ShowcaseIndex />} />
        <Route path="/docs" element={<Navigate to={DOCS_HOME} replace />} />
        <Route path="/docs/:slug" element={<Docs />} />
        <Route path="/mini-demos" element={<MiniDemos />} />
        {Arena ? (
          <Route
            path="/arena"
            element={
              <Suspense fallback={null}>
                <Arena />
              </Suspense>
            }
          />
        ) : null}
        <Route path="/changelog" element={<Changelog />} />
        <Route path="/changelog/:slug" element={<Changelog />} />
        <Route path="/demos" element={<DemosIndex />} />
        <Route
          path="/demos/shadcn-sidebar"
          element={<ShadcnSidebarExample />}
        />
        <Route path="/demos/three-panel" element={<ThreePanelExample />} />
        <Route path="/demos/four-panel" element={<FourPanelExample />} />
        <Route path="/demos/four-vertical" element={<FourVerticalExample />} />
        <Route path="/demos/stress" element={<StressExample />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </SidebarSlotContext.Provider>
  );

  const main = onDocs ? (
    <main className="h-full min-h-0">{routes}</main>
  ) : (
    <ScrollArea className="h-full min-h-0">
      <main className="h-full min-h-full">{routes}</main>
    </ScrollArea>
  );

  return (
    <PanelProvider>
      <DocumentMeta />
      <div className="flex h-full flex-col">
        <DemoNav />
        <div
          data-app-shell=""
          className={cn(
            // Full width so scroll containers reach the viewport edge and
            // the page scrollbar sits at the far right. On docs, a left
            // spacer aligns the sidebar with the centered nav container
            // (90rem = the nav's max-w-360 in demo-nav.tsx).
            "flex w-full min-h-0 flex-1",
            // Use 100% (not 100vw) so scrollbar appearance can't change the
            // centering pad and shove the docs column sideways.
            onDocs && "pl-[max(0px,calc((100%-90rem)/2))]",
          )}
        >
          {/* Only mount a PanelGroup when the docs sidebar is actually shown.
              A single peer panel gets the Playwright viewport baked into
              max-width during prerender (e.g. 1280px), so wider screens
              flash left-aligned until createRoot remounts. */}
          {onDocs && showDocsSidebar ? (
            <PanelGroup
              orientation="horizontal"
              className="h-full w-full"
              // Shell chrome must not animate on mount — a 280px width
              // transition is exactly the "content loads, then shoves right" jank.
              animation={false}
            >
              <Panel
                panelId="docs-sidebar"
                side="start"
                defaultSize={280}
                minSize={220}
                maxSize={340}
                className="bg-background"
              >
                <div ref={setSidebarEl} className="h-full" />
              </Panel>
              <Panel className="flex h-full min-w-0 flex-col bg-background">
                {main}
              </Panel>
            </PanelGroup>
          ) : (
            <div className="flex h-full min-h-0 w-full flex-col bg-background">
              {main}
            </div>
          )}
        </div>
      </div>
    </PanelProvider>
  );
}

function isKnownDocsPath(pathname: string) {
  const match = pathname.match(/^\/docs\/([^/]+)\/?$/);
  if (!match) return false;
  return DOC_PAGE_META.some((page) => page.slug === match[1]);
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
