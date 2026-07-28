import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { Inbox, List, Mail, PanelLeft, PanelRight } from "lucide-react";
import { useCallback, useState } from "react";
import { DemoShell } from "@/components/showcase/demo-shell";
import { Dimension } from "@/components/showcase/dimension";
import { DrawerSheet } from "@/components/showcase/drawer-sheet";
import { PanelInspector } from "@/components/showcase/panel-inspector";
import { PanelScratchpad } from "@/components/showcase/panel-scratchpad";
import {
  useContainerBreakpoint,
  useRegisterDrawerControl,
  useReparentableContent,
} from "@/components/showcase/responsive-drawer";
import { Button } from "@/components/ui/button";

const GROUP_ID = "four-vertical";

// Nav and inspector demote to sheets when the group is too narrow; the list
// stays inline. enterSheetBelow / exitSheetAbove bracket a hysteresis band.
const NAV = {
  id: "nav",
  side: "start" as const,
  defaultSize: 220,
  minSize: 180,
  maxSize: 320,
  enterSheetBelow: 1040,
  exitSheetAbove: 1180,
};
const LIST = {
  id: "list",
  side: "start" as const,
  defaultSize: 300,
  minSize: 240,
  maxSize: 460,
};
const INSPECTOR = {
  id: "inspector",
  side: "end" as const,
  defaultSize: 320,
  minSize: 260,
  maxSize: 520,
  enterSheetBelow: 820,
  exitSheetAbove: 960,
};

const MENU_ITEMS = [
  { groupId: GROUP_ID, panelId: NAV.id, label: "Nav", Icon: PanelLeft },
  { groupId: GROUP_ID, panelId: LIST.id, label: "List", Icon: List },
  {
    groupId: GROUP_ID,
    panelId: INSPECTOR.id,
    label: "Inspector",
    Icon: PanelRight,
  },
];

export default function FourVerticalExample() {
  return (
    <DemoShell
      storageKey="resizable-panels:demo:four-vertical"
      menuItems={MENU_ITEMS}
    >
      {({ persistenceKey }) => (
        <FourVerticalLayout persistenceKey={persistenceKey} />
      )}
    </DemoShell>
  );
}

function FourVerticalLayout({
  persistenceKey,
}: {
  persistenceKey: string | undefined;
}) {
  const navMode = useContainerBreakpoint(GROUP_ID, NAV);
  const inspectorMode = useContainerBreakpoint(GROUP_ID, INSPECTOR);
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
      title="Nav"
      icon={<Inbox className="size-4" />}
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
      title="Inspector"
      icon={<Mail className="size-4" />}
      entries={[
        { label: "side", value: INSPECTOR.side },
        { label: "min", value: `${INSPECTOR.minSize}px` },
        { label: "max", value: `${INSPECTOR.maxSize}px` },
      ]}
    />,
  );

  return (
    <>
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

        <Panel
          panelId={LIST.id}
          side={LIST.side}
          defaultSize={LIST.defaultSize}
          minSize={LIST.minSize}
          maxSize={LIST.maxSize}
          className="bg-muted text-foreground border-r border-border"
        >
          <PanelInspector
            groupId={GROUP_ID}
            panelId={LIST.id}
            title="List"
            icon={<List className="size-4" />}
            entries={[
              { label: "side", value: LIST.side },
              { label: "min", value: `${LIST.minSize}px` },
              { label: "max", value: `${LIST.maxSize}px` },
              { label: "default", value: `${LIST.defaultSize}px` },
            ]}
          />
        </Panel>

        <PanelResizeHandle />
        <Panel className="bg-background">
          <Main
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
              className="bg-card text-card-foreground border-l border-border"
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
          title="Nav"
        >
          <div ref={nav.setHost} className="h-full" />
        </DrawerSheet>
      )}
      {inspectorMode === "sheet" && (
        <DrawerSheet
          open={inspectorSheetOpen}
          onOpenChange={setInspectorSheetOpen}
          side="right"
          title="Inspector"
        >
          <div ref={inspector.setHost} className="h-full" />
        </DrawerSheet>
      )}
    </>
  );
}

function Main({
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
