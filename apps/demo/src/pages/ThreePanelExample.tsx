import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { PanelLeft, PanelRight } from "lucide-react";
import { useCallback, useState } from "react";
import { DemoShell } from "@/components/showcase/demo-shell";
import { Dimension } from "@/components/showcase/dimension";
import { DrawerSheet } from "@/components/showcase/drawer-sheet";
import { PanelScratchpad } from "@/components/showcase/panel-scratchpad";
import {
  useContainerBreakpoint,
  useRegisterDrawerControl,
  useReparentableContent,
} from "@/components/showcase/responsive-drawer";
import { Button } from "@/components/ui/button";

const GROUP_ID = "three-panel";

// Each side panel demotes to a sheet when the GROUP is too narrow to hold it.
// enterSheetBelow / exitSheetAbove bracket a hysteresis band so width jitter
// across the breakpoint cannot flap the mode.
const NAV = {
  id: "nav",
  side: "start" as const,
  defaultSize: 280,
  minSize: 220,
  maxSize: 420,
  enterSheetBelow: 900,
  exitSheetAbove: 1020,
};
const INSPECTOR = {
  id: "inspector",
  side: "end" as const,
  defaultSize: 460,
  minSize: 360,
  maxSize: 720,
  enterSheetBelow: 760,
  exitSheetAbove: 900,
};

const MENU_ITEMS = [
  { groupId: GROUP_ID, panelId: NAV.id, label: "Nav", Icon: PanelLeft },
  {
    groupId: GROUP_ID,
    panelId: INSPECTOR.id,
    label: "Inspector",
    Icon: PanelRight,
  },
];

export default function ThreePanelExample() {
  return (
    <DemoShell
      storageKey="resizable-panels:demo:three-panel"
      menuItems={MENU_ITEMS}
    >
      {({ persistenceKey }) => (
        <ThreePanelLayout persistenceKey={persistenceKey} />
      )}
    </DemoShell>
  );
}

function ThreePanelLayout({
  persistenceKey,
}: {
  persistenceKey: string | undefined;
}) {
  const navMode = useContainerBreakpoint(GROUP_ID, NAV);
  const inspectorMode = useContainerBreakpoint(GROUP_ID, INSPECTOR);
  // Parent-held layout state: each panel unmounts while a sheet, so its size
  // lives here and is fed back as defaultSize, returning on remount.
  const [navSize, setNavSize] = useState(NAV.defaultSize);
  const [inspectorSize, setInspectorSize] = useState(INSPECTOR.defaultSize);
  const [navSheetOpen, setNavSheetOpen] = useState(false);
  const [inspectorSheetOpen, setInspectorSheetOpen] = useState(false);

  // Publish each responsive panel's live mode + opener so the floating dock's
  // row follows the panel across the inline ⇄ sheet boundary (U1).
  const openNav = useCallback(() => setNavSheetOpen(true), []);
  const openInspector = useCallback(() => setInspectorSheetOpen(true), []);
  useRegisterDrawerControl(GROUP_ID, NAV.id, navMode, openNav);
  useRegisterDrawerControl(
    GROUP_ID,
    INSPECTOR.id,
    inspectorMode,
    openInspector,
  );

  const nav = useReparentableContent(
    <PanelScratchpad
      id="nav"
      title="LeftPanel"
      icon={<PanelLeft className="size-4" />}
      entries={[
        { label: "side", value: NAV.side },
        { label: "min", value: `${NAV.minSize}px` },
        { label: "max", value: `${NAV.maxSize}px` },
      ]}
    />,
  );
  const inspector = useReparentableContent(
    <PanelScratchpad
      id="inspector"
      title="RightPanel"
      icon={<PanelRight className="size-4" />}
      entries={[
        { label: "side", value: INSPECTOR.side },
        { label: "min", value: `${INSPECTOR.minSize}px` },
        { label: "max", value: `${INSPECTOR.maxSize}px` },
      ]}
    />,
  );

  return (
    <>
      {/* Content mounted once, above the swapping hosts. */}
      {nav.portal}
      {inspector.portal}

      <PanelGroup
        groupId={GROUP_ID}
        orientation="horizontal"
        persistence={persistenceKey ? { key: persistenceKey } : undefined}
        onValueChange={(value) => {
          const navValue = value[NAV.id];
          if (navValue) setNavSize(navValue.size);
          const inspectorValue = value[INSPECTOR.id];
          if (inspectorValue) setInspectorSize(inspectorValue.size);
        }}
      >
        {navMode === "inline" && (
          <>
            <Panel
              panelId={NAV.id}
              side={NAV.side}
              defaultSize={navSize}
              minSize={NAV.minSize}
              maxSize={NAV.maxSize}
              className="bg-sidebar text-sidebar-foreground border-r border-sidebar-border"
            >
              <div ref={nav.setHost} className="h-full" />
            </Panel>
            <PanelResizeHandle />
          </>
        )}

        <Panel className="bg-background">
          <Middle
            navSheet={navMode === "sheet"}
            inspectorSheet={inspectorMode === "sheet"}
            onOpenNav={openNav}
            onOpenInspector={openInspector}
          />
        </Panel>

        {inspectorMode === "inline" && (
          <>
            <PanelResizeHandle />
            <Panel
              panelId={INSPECTOR.id}
              side={INSPECTOR.side}
              defaultSize={inspectorSize}
              minSize={INSPECTOR.minSize}
              maxSize={INSPECTOR.maxSize}
              className="bg-card border-l border-border"
            >
              <div ref={inspector.setHost} className="h-full" />
            </Panel>
          </>
        )}
      </PanelGroup>

      {navMode === "sheet" && (
        <DrawerSheet
          open={navSheetOpen}
          onOpenChange={setNavSheetOpen}
          side="left"
          title="LeftPanel"
        >
          <div ref={nav.setHost} className="h-full" />
        </DrawerSheet>
      )}
      {inspectorMode === "sheet" && (
        <DrawerSheet
          open={inspectorSheetOpen}
          onOpenChange={setInspectorSheetOpen}
          side="right"
          title="RightPanel"
        >
          <div ref={inspector.setHost} className="h-full" />
        </DrawerSheet>
      )}
    </>
  );
}

function Middle({
  navSheet,
  inspectorSheet,
  onOpenNav,
  onOpenInspector,
}: {
  navSheet: boolean;
  inspectorSheet: boolean;
  onOpenNav: () => void;
  onOpenInspector: () => void;
}) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-3">
      <Dimension value="flex-1" side="top" />
      {(navSheet || inspectorSheet) && (
        <div className="flex gap-2">
          {navSheet && (
            <Button variant="secondary" size="sm" onClick={onOpenNav}>
              <PanelLeft className="size-4" /> Open Nav
            </Button>
          )}
          {inspectorSheet && (
            <Button variant="secondary" size="sm" onClick={onOpenInspector}>
              <PanelRight className="size-4" /> Open Inspector
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
