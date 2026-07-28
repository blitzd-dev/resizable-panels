import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  usePanelControls,
} from "@blitzd/resizable-panels";
import {
  FileCode,
  FileText,
  FolderTree,
  type LucideIcon,
  Palette,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Terminal,
  X,
} from "lucide-react";
import { Fragment, useState } from "react";
import { DemoShell } from "@/components/showcase/demo-shell";
import { Dimension } from "@/components/showcase/dimension";
import { PanelInspector } from "@/components/showcase/panel-inspector";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const GROUP_ID = "four-panel";
/** The terminal lives in the nested vertical editor group, not the outer one. */
const EDITOR_GROUP_ID = "four-panel-editor";
/** One peer panel per open file — membership changes at runtime. */
const SPLITS_GROUP_ID = "four-panel-splits";

const NAV = {
  id: "nav",
  side: "start" as const,
  axis: "horizontal" as const,
  defaultSize: 240,
  minSize: 180,
  maxSize: 360,
};
const TERMINAL = {
  id: "terminal",
  side: "end" as const,
  axis: "vertical" as const,
  defaultSize: 200,
  minSize: 100,
  maxSize: 500,
};
const INSPECTOR = {
  id: "inspector",
  side: "end" as const,
  axis: "horizontal" as const,
  defaultSize: 360,
  minSize: 280,
  maxSize: 600,
};
const SPLIT_MIN_SIZE = 140;

const MENU_ITEMS = [
  { groupId: GROUP_ID, panelId: NAV.id, label: "Explorer", Icon: PanelLeft },
  {
    groupId: EDITOR_GROUP_ID,
    panelId: TERMINAL.id,
    label: "Terminal",
    Icon: PanelBottom,
  },
  {
    groupId: GROUP_ID,
    panelId: INSPECTOR.id,
    label: "Inspector",
    Icon: PanelRight,
  },
];

type EditorFile = {
  id: string;
  name: string;
  Icon: LucideIcon;
  code: string;
};

const FILES: EditorFile[] = [
  {
    id: "app-tsx",
    name: "app.tsx",
    Icon: FileCode,
    code: `import {
  Panel,
  PanelGroup,
} from "@blitzd/resizable-panels";

export function Editors({ files }) {
  return (
    <PanelGroup orientation="horizontal">
      {files.map((file) => (
        <Panel
          key={file.id}
          panelId={file.id}
          minSize={140}
        >
          <Editor file={file} />
        </Panel>
      ))}
    </PanelGroup>
  );
}`,
  },
  {
    id: "panel-group-tsx",
    name: "panel-group.tsx",
    Icon: FileCode,
    code: `// Peer panels have no \`side\`.
// They share whatever space the
// docked panels leave behind.

const peers = children.filter(
  (child) => child.side === undefined,
);

// A peer with no defaultSize gets
// an equal share on mount, and the
// group redistributes when any
// peer mounts or unmounts.
allocate(peers, remainingSpace);`,
  },
  {
    id: "styles-css",
    name: "styles.css",
    Icon: Palette,
    code: `.editor-split {
  display: flex;
  min-width: 140px;
  flex-direction: column;
}

.editor-split > header {
  border-bottom: 1px solid
    var(--border);
}`,
  },
  {
    id: "readme-md",
    name: "README.md",
    Icon: FileText,
    code: `# Editor splits

Every open file is a peer
<Panel> in one horizontal
PanelGroup.

- Open files from the Explorer;
  each mounts a new panel and
  the group makes room for it.
- Drag the seams to resize a
  split; 140px is the minimum.
- Close a split and the others
  reclaim its space.`,
  },
];

export default function FourPanelExample() {
  // Open-file membership is app state, not layout state — the splits group
  // deliberately has no persistence, so only the docked panels round-trip.
  const [openIds, setOpenIds] = useState<string[]>(["app-tsx", "readme-md"]);
  const openFiles = openIds.flatMap((id) => {
    const file = FILES.find((f) => f.id === id);
    return file ? [file] : [];
  });
  const toggleFile = (id: string) =>
    setOpenIds((ids) =>
      ids.includes(id) ? ids.filter((open) => open !== id) : [...ids, id],
    );
  const closeFile = (id: string) =>
    setOpenIds((ids) => ids.filter((open) => open !== id));

  return (
    <DemoShell
      storageKey="resizable-panels:demo:four-panel"
      menuItems={MENU_ITEMS}
    >
      {({ persistenceKey }) => (
        <div className="flex h-full w-full flex-col">
          <TitleBar />
          <div className="min-h-0 w-full flex-1">
            <PanelGroup
              groupId={GROUP_ID}
              orientation="horizontal"
              persistence={persistenceKey ? { key: persistenceKey } : undefined}
            >
              <Panel
                panelId={NAV.id}
                side={NAV.side}
                defaultSize={NAV.defaultSize}
                minSize={NAV.minSize}
                maxSize={NAV.maxSize}
                className="bg-sidebar text-sidebar-foreground border-r border-sidebar-border"
              >
                <PanelInspector
                  groupId={GROUP_ID}
                  panelId={NAV.id}
                  title="Explorer"
                  icon={<FolderTree className="size-4" />}
                  entries={[
                    { label: "axis", value: NAV.axis },
                    { label: "side", value: NAV.side },
                    { label: "min", value: `${NAV.minSize}px` },
                    { label: "max", value: `${NAV.maxSize}px` },
                  ]}
                >
                  <ExplorerFiles openIds={openIds} onToggle={toggleFile} />
                </PanelInspector>
              </Panel>

              <PanelResizeHandle />
              <Panel className="bg-background">
                {/* Nested group persists under its own key — a group only saves
                its direct children. */}
                <PanelGroup
                  groupId={EDITOR_GROUP_ID}
                  orientation="vertical"
                  persistence={
                    persistenceKey
                      ? { key: `${persistenceKey}:editor` }
                      : undefined
                  }
                >
                  <Panel className="bg-background">
                    <PanelGroup
                      groupId={SPLITS_GROUP_ID}
                      orientation="horizontal"
                    >
                      {openFiles.length === 0 ? (
                        <Panel className="bg-background">
                          <EmptyEditors />
                        </Panel>
                      ) : (
                        openFiles.map((file, index) => (
                          <Fragment key={file.id}>
                            {index > 0 && <PanelResizeHandle />}
                            <Panel
                              panelId={file.id}
                              minSize={SPLIT_MIN_SIZE}
                              className={cn(
                                "bg-background",
                                index > 0 && "border-l border-border",
                              )}
                            >
                              <EditorSplit
                                file={file}
                                onClose={() => closeFile(file.id)}
                              />
                            </Panel>
                          </Fragment>
                        ))
                      )}
                    </PanelGroup>
                  </Panel>
                  <PanelResizeHandle />
                  <Panel
                    panelId={TERMINAL.id}
                    side={TERMINAL.side}
                    defaultSize={TERMINAL.defaultSize}
                    minSize={TERMINAL.minSize}
                    maxSize={TERMINAL.maxSize}
                    className="bg-card border-t border-border"
                  >
                    <PanelInspector
                      groupId={EDITOR_GROUP_ID}
                      panelId={TERMINAL.id}
                      title="Terminal"
                      icon={<Terminal className="size-4" />}
                      dimensionSide="left"
                      entries={[
                        { label: "axis", value: TERMINAL.axis },
                        { label: "side", value: TERMINAL.side },
                        { label: "min", value: `${TERMINAL.minSize}px` },
                        { label: "max", value: `${TERMINAL.maxSize}px` },
                      ]}
                    />
                  </Panel>
                </PanelGroup>
              </Panel>

              <PanelResizeHandle />
              <Panel
                panelId={INSPECTOR.id}
                side={INSPECTOR.side}
                defaultSize={INSPECTOR.defaultSize}
                minSize={INSPECTOR.minSize}
                maxSize={INSPECTOR.maxSize}
                className="bg-card border-l border-border"
              >
                <PanelInspector
                  groupId={GROUP_ID}
                  panelId={INSPECTOR.id}
                  title="Inspector"
                  entries={[
                    { label: "axis", value: INSPECTOR.axis },
                    { label: "side", value: INSPECTOR.side },
                    { label: "min", value: `${INSPECTOR.minSize}px` },
                    { label: "max", value: `${INSPECTOR.maxSize}px` },
                  ]}
                />
              </Panel>
            </PanelGroup>
          </div>
        </div>
      )}
    </DemoShell>
  );
}

/** VS Code-style layout controls: one animated toggle per dockable panel.
 *  `setCollapsed` runs the same animated collapse pipeline as the dock. */
function LayoutToggle({
  groupId,
  panelId,
  label,
  Icon,
}: {
  groupId: string;
  panelId: string;
  label: string;
  Icon: LucideIcon;
}) {
  const ctrl = usePanelControls({ groupId, panelId });
  const open = ctrl ? !ctrl.collapsed : true;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-pressed={open}
      aria-label={`${open ? "Hide" : "Show"} ${label}`}
      title={`${open ? "Hide" : "Show"} ${label}`}
      onClick={() => ctrl?.setCollapsed(open)}
      className={cn(
        "cursor-pointer",
        open
          ? "text-foreground"
          : "text-muted-foreground/50 hover:text-muted-foreground",
      )}
    >
      <Icon className="size-4" />
    </Button>
  );
}

function TitleBar() {
  return (
    <div className="flex h-9 w-full shrink-0 items-center justify-between border-b border-border bg-card/60 px-3">
      <span className="text-xs font-medium text-muted-foreground">
        four-panel · IDE demo
      </span>
      <div className="flex items-center gap-0.5">
        <LayoutToggle
          groupId={GROUP_ID}
          panelId={NAV.id}
          label="Explorer"
          Icon={PanelLeft}
        />
        <LayoutToggle
          groupId={EDITOR_GROUP_ID}
          panelId={TERMINAL.id}
          label="Terminal"
          Icon={PanelBottom}
        />
        <LayoutToggle
          groupId={GROUP_ID}
          panelId={INSPECTOR.id}
          label="Inspector"
          Icon={PanelRight}
        />
      </div>
    </div>
  );
}

function ExplorerFiles({
  openIds,
  onToggle,
}: {
  openIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        files
      </div>
      <div className="flex flex-col gap-0.5">
        {FILES.map((file) => {
          const open = openIds.includes(file.id);
          return (
            <button
              key={file.id}
              type="button"
              onClick={() => onToggle(file.id)}
              title={open ? `Close ${file.name}` : `Open ${file.name}`}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs",
                open
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
              )}
            >
              <file.Icon className="size-3.5 shrink-0" />
              <span className="truncate">{file.name}</span>
              {open && (
                <span className="ml-auto size-1.5 shrink-0 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] leading-4 text-muted-foreground/70">
        Each open file is a peer panel in the editors group — opening one makes
        room for it, closing one gives its space back.
      </p>
    </div>
  );
}

/** One open file: tab-style header with a close button, fake code content,
 *  and a live width readout from the splits group. */
function EditorSplit({
  file,
  onClose,
}: {
  file: EditorFile;
  onClose: () => void;
}) {
  const ctrl = usePanelControls({
    groupId: SPLITS_GROUP_ID,
    panelId: file.id,
  });
  const lines = file.code.split("\n");
  const gutter = lines.map((_, i) => String(i + 1)).join("\n");
  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-card/60 px-3 py-1.5">
        <file.Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs font-medium">{file.name}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          aria-label={`Close ${file.name}`}
          className="ml-auto shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 gap-3 overflow-auto px-3 py-2 pb-12 font-mono text-xs leading-5">
        <pre className="select-none text-right text-muted-foreground/40">
          {gutter}
        </pre>
        <pre className="text-muted-foreground">{file.code}</pre>
      </div>
      {ctrl && (
        <Dimension value={Math.round(ctrl.renderedSize)} side="bottom" />
      )}
    </div>
  );
}

function EmptyEditors() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
      <div className="text-sm font-medium text-muted-foreground">
        No editors open
      </div>
      <div className="text-xs text-muted-foreground/70">
        Open a file from the Explorer to add a panel here.
      </div>
    </div>
  );
}
