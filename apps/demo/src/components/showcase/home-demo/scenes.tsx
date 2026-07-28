import {
  Panel,
  type PanelActionDispatcher,
  PanelGroup,
  type PanelLocator,
  PanelResizeHandle,
  usePanelActions,
  usePanelCollapsed,
} from "@blitzd/resizable-panels";
import {
  Calendar,
  Columns2,
  FileText,
  Inbox,
  LayoutDashboard,
  Mail,
  MoreHorizontal,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelsTopLeft,
  Search,
  Settings,
  Star,
} from "lucide-react";
import {
  type ComponentType,
  Fragment,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityBar,
  type AgentReply,
  AiChat,
  Editor,
  FileTree,
  StatusBar,
  Terminal,
} from "@/components/fake-ui/ide";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { useSceneEngage } from "./engagement";

export type SceneStep = {
  /** Source-like snippet shown in the code stack. For drag steps this is a
   *  plain caption (no code) — the stack renders it with a cursor icon. */
  code: string;
  /** Milliseconds to dwell after the step's work completes. */
  dwell: number;
  /** Imperative command fired against the provider's action dispatcher. */
  action?: (actions: PanelActionDispatcher) => void;
  /** Cursor gesture: travel to a real panel control and visibly click it.
   *  The step's action fires at the bottom of the press. */
  click?: { selector: string };
  /** Cursor gesture: the fake cursor grabs this panel's seam and drags
   *  until the panel is `toSize` px. */
  drag?: { target: PanelLocator; toSize: number };
};

export type Scene = {
  id: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  /** One-line "what to watch for" shown on the scene card under the demo. */
  blurb: string;
  /** Panel tree for this scene. Each scene owns its own panel ids so
   *  remounting between cycles starts from a clean state. */
  Layout: ComponentType;
  script: SceneStep[];
};

const panelControlSelector = (target: PanelLocator) =>
  `[data-home-panel-control="${target.panelId}"]`;

type PanelControl = {
  target: PanelLocator;
  label: string;
  icon: ReactNode;
};

/**
 * A stable visibility group in the app's main header. Buttons never mount or
 * move as panels change; their pressed treatment is the only state signal.
 * Each item subscribes to its own panel (controls may span nested groups,
 * so a single group-registry read can't cover them all).
 */
function PanelControlGroup({ controls }: { controls: PanelControl[] }) {
  return (
    // Toolbar of unrelated toggles — not a form fieldset.
    // biome-ignore lint/a11y/useSemanticElements: role=group is the correct ARIA pattern here
    <div
      role="group"
      aria-label="Panel visibility"
      className="flex shrink-0 items-center gap-0.5 rounded border border-border/70 bg-background/60 p-0.5"
    >
      {controls.map((control) => (
        <PanelControlToggle key={control.target.panelId} {...control} />
      ))}
    </div>
  );
}

function PanelControlToggle({ target, label, icon }: PanelControl) {
  const actions = usePanelActions();
  const expanded = !(usePanelCollapsed(target) ?? false);

  return (
    <Toggle
      pressed={expanded}
      data-home-panel-control={target.panelId}
      aria-label={`${expanded ? "Hide" : "Show"} ${label} panel`}
      aria-pressed={expanded}
      title={`${expanded ? "Hide" : "Show"} ${label} panel`}
      onPressedChange={(pressed) => actions.setCollapsed(target, !pressed)}
      className={cn(
        "size-5 min-w-5 shrink-0 rounded-sm p-0 transition-transform duration-150 active:scale-90",
        expanded ? "bg-accent text-foreground" : "text-muted-foreground/50",
      )}
    >
      {icon}
    </Toggle>
  );
}

/** The inbox toggle lives in the mail app's permanent navigation rail. */
function RailPanelControl({ target, label, icon }: PanelControl) {
  const actions = usePanelActions();
  const expanded = !(usePanelCollapsed(target) ?? false);

  return (
    <Toggle
      pressed={expanded}
      data-home-panel-control={target.panelId}
      aria-label={`${expanded ? "Hide" : "Show"} ${label} panel`}
      aria-pressed={expanded}
      title={`${expanded ? "Hide" : "Show"} ${label} panel`}
      onPressedChange={(pressed) => actions.setCollapsed(target, !pressed)}
      className={cn(
        "size-9 min-w-9 p-0 transition-transform duration-150 active:scale-95",
        expanded ? "bg-primary/15 text-primary" : "text-muted-foreground",
      )}
    >
      {icon}
    </Toggle>
  );
}

// ─── scene 1: IDE shell ──────────────────────────────────────────────────────

const IDE_GROUP = "home-ide";
/** The terminal lives in the nested vertical editor group. */
const IDE_EDITOR_GROUP = "home-ide-editor";
/** Side-by-side editor panes when the user splits the editor. */
const IDE_SPLIT_GROUP = "home-ide-splits";

const IDE = {
  nav: { groupId: IDE_GROUP, panelId: "home-ide-nav" },
  terminal: { groupId: IDE_EDITOR_GROUP, panelId: "home-ide-terminal" },
  chat: { groupId: IDE_GROUP, panelId: "home-ide-chat" },
} satisfies Record<string, PanelLocator>;

/** Canned agent replies for messages that don't match a panel command. */
const AGENT_SMALL_TALK: AgentReply[] = [
  {
    text: 'I can drive the real layout — try "hide the terminal", "show the sidebar", or "make the terminal bigger".',
  },
  {
    tool: "panels.inspect()",
    text: "Three panels in this group: files (start), editor (center), me (end) — plus a nested vertical split for the terminal. All real, all resizable.",
  },
  {
    text: "Everything in this window is the actual library running — the seams, the collapse rails, the keyboard support. Drag something.",
  },
];

type EditorPane = { id: number; tabs: string[]; active: string };

function IdeLayout() {
  const engage = useSceneEngage();
  const actions = usePanelActions();
  // One editor pane by default; the split button adds a second, VS Code
  // style — a real nested horizontal PanelGroup with a draggable seam.
  const [panes, setPanes] = useState<EditorPane[]>([
    { id: 0, tabs: ["App.tsx", "Panel.tsx", "main.tsx"], active: "App.tsx" },
  ]);
  const [focusedPane, setFocusedPane] = useState(0);
  const smallTalkIdx = useRef(0);

  const openFileInPane = (paneIdx: number, name: string) => {
    engage();
    setFocusedPane(paneIdx);
    setPanes(
      panes.map((pane, i) =>
        i === paneIdx
          ? {
              ...pane,
              tabs: pane.tabs.includes(name) ? pane.tabs : [...pane.tabs, name],
              active: name,
            }
          : pane,
      ),
    );
  };

  const openFile = (name: string) =>
    openFileInPane(Math.min(focusedPane, panes.length - 1), name);

  const closeTab = (paneIdx: number, name: string) => {
    engage();
    const pane = panes[paneIdx];
    const nextTabs = pane.tabs.filter((tab) => tab !== name);
    if (nextTabs.length === 0 && panes.length > 1) {
      // Last tab of a split pane: the pane goes with it.
      setPanes(panes.filter((_, i) => i !== paneIdx));
      setFocusedPane(0);
      return;
    }
    setPanes(
      panes.map((p, i) =>
        i === paneIdx
          ? {
              id: p.id,
              tabs: nextTabs.length ? nextTabs : ["App.tsx"],
              active:
                name === p.active
                  ? (nextTabs[nextTabs.length - 1] ?? "App.tsx")
                  : p.active,
            }
          : p,
      ),
    );
  };

  const toggleSplit = () => {
    engage();
    if (panes.length === 1) {
      const current = panes[0];
      setPanes([
        current,
        { id: current.id + 1, tabs: [current.active], active: current.active },
      ]);
      setFocusedPane(1);
    } else {
      setPanes([panes[0]]);
      setFocusedPane(0);
    }
  };

  // The agent parses just enough intent to visibly drive the real panels.
  const agentReply = (text: string): AgentReply => {
    const q = text.toLowerCase();
    const hide = /\b(hide|close|collapse)\b/.test(q);
    const show = /\b(show|open|expand|bring|restore)\b/.test(q);
    const target = /terminal/.test(q)
      ? ("terminal" as const)
      : /(sidebar|nav|file|explorer|tree)/.test(q)
        ? ("nav" as const)
        : /(chat|agent|yourself)/.test(q)
          ? ("chat" as const)
          : null;

    if (target && (hide || show)) {
      if (show) {
        actions.expand(IDE[target]);
        return {
          tool: `${target}.expand()`,
          text: `Brought the ${target} panel back — it springs from its collapse rail, no remount.`,
        };
      }
      actions.collapse(IDE[target]);
      return target === "chat"
        ? {
            tool: "chat.collapse()",
            text: "Collapsing myself — use the panel toggle in the tab strip to bring me back. 👋",
          }
        : {
            tool: `${target}.collapse()`,
            text: `Collapsed the ${target} panel. Ask me to bring it back, or use the toggles in the tab strip.`,
          };
    }
    if (
      /(bigger|larger|taller|wider|grow|resize)/.test(q) &&
      /terminal/.test(q)
    ) {
      actions.setSize(IDE.terminal, 260);
      return {
        tool: "terminal.setSize(260)",
        text: "Resized the terminal to 260px — animated by the library, same as dragging the seam.",
      };
    }
    const reply =
      AGENT_SMALL_TALK[smallTalkIdx.current % AGENT_SMALL_TALK.length];
    smallTalkIdx.current += 1;
    return reply;
  };

  return (
    // Activity bar and status bar are VS Code chrome, not resizable panels —
    // they frame the PanelGroup the way the email scene's nav rail does.
    <div className="@container relative flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <ActivityBar />
        <div className="min-w-0 flex-1">
          <PanelGroup
            groupId={IDE_GROUP}
            orientation="horizontal"
            className="h-full"
          >
            <Panel
              panelId={IDE.nav.panelId}
              side="start"
              defaultSize={180}
              minSize={140}
              maxSize={280}
              className="border-r border-border bg-card"
            >
              <FileTree
                activeFile={
                  panes[Math.min(focusedPane, panes.length - 1)].active
                }
                onOpenFile={openFile}
              />
            </Panel>
            <PanelResizeHandle />
            <Panel className="bg-background">
              <PanelGroup
                groupId={IDE_EDITOR_GROUP}
                orientation="vertical"
                className="h-full"
              >
                <Panel className="bg-background">
                  <PanelGroup
                    groupId={IDE_SPLIT_GROUP}
                    orientation="horizontal"
                    className="h-full"
                  >
                    {panes.map((pane, i) => (
                      <Fragment key={pane.id}>
                        {i > 0 ? <PanelResizeHandle /> : null}
                        <Panel
                          minSize={150}
                          className={cn(
                            "bg-background",
                            i > 0 && "border-l border-border",
                          )}
                        >
                          <Editor
                            openTabs={pane.tabs}
                            activeTab={pane.active}
                            focused={panes.length === 1 || i === focusedPane}
                            onFocusPane={() => setFocusedPane(i)}
                            onSelectTab={(name) => openFileInPane(i, name)}
                            onCloseTab={(name) => closeTab(i, name)}
                            actions={
                              i === panes.length - 1 ? (
                                <>
                                  <Toggle
                                    pressed={panes.length > 1}
                                    onPressedChange={toggleSplit}
                                    aria-label={
                                      panes.length > 1
                                        ? "Close split editor"
                                        : "Split editor"
                                    }
                                    title={
                                      panes.length > 1
                                        ? "Close split editor"
                                        : "Split editor"
                                    }
                                    className={cn(
                                      "size-5 min-w-5 shrink-0 rounded-sm p-0",
                                      panes.length > 1
                                        ? "bg-accent text-foreground"
                                        : "text-muted-foreground/50",
                                    )}
                                  >
                                    <Columns2 className="size-3.5" />
                                  </Toggle>
                                  <PanelControlGroup
                                    controls={[
                                      {
                                        target: IDE.nav,
                                        label: "navigation",
                                        icon: (
                                          <PanelLeft className="size-3.5" />
                                        ),
                                      },
                                      {
                                        target: IDE.terminal,
                                        label: "terminal",
                                        icon: (
                                          <PanelBottom className="size-3.5" />
                                        ),
                                      },
                                      {
                                        target: IDE.chat,
                                        label: "chat",
                                        icon: (
                                          <PanelRight className="size-3.5" />
                                        ),
                                      },
                                    ]}
                                  />
                                </>
                              ) : undefined
                            }
                          />
                        </Panel>
                      </Fragment>
                    ))}
                  </PanelGroup>
                </Panel>
                <PanelResizeHandle />
                <Panel
                  panelId={IDE.terminal.panelId}
                  side="end"
                  defaultSize={160}
                  minSize={80}
                  maxSize={300}
                  className="border-t border-border bg-card"
                >
                  <Terminal onInteract={engage} />
                </Panel>
              </PanelGroup>
            </Panel>
            <PanelResizeHandle />
            <Panel
              panelId={IDE.chat.panelId}
              side="end"
              defaultSize={260}
              minSize={200}
              maxSize={400}
              className="border-l border-border bg-card"
            >
              <AiChat onSend={agentReply} onInteract={engage} />
            </Panel>
          </PanelGroup>
        </div>
      </div>
      <StatusBar />
    </div>
  );
}

const ideScript: SceneStep[] = [
  {
    code: "drag the seam",
    drag: { target: IDE.terminal, toSize: 240 },
    dwell: 1000,
  },
  {
    code: "nav.setSize(220)",
    action: (a) => a.setSize(IDE.nav, 220),
    dwell: 1300,
  },
  {
    code: "chat.collapse()",
    action: (a) => a.collapse(IDE.chat),
    click: { selector: panelControlSelector(IDE.chat) },
    dwell: 1500,
  },
  {
    code: "chat.expand()",
    action: (a) => a.expand(IDE.chat),
    click: { selector: panelControlSelector(IDE.chat) },
    dwell: 1500,
  },
  {
    code: "works on any edge",
    drag: { target: IDE.chat, toSize: 320 },
    dwell: 1000,
  },
  {
    code: "nav.toggle()",
    action: (a) => a.toggle(IDE.nav),
    click: { selector: panelControlSelector(IDE.nav) },
    dwell: 1400,
  },
  {
    code: 'chat.collapse({ transition: "none" })',
    action: (a) => a.collapse(IDE.chat, { transition: "none" }),
    click: { selector: panelControlSelector(IDE.chat) },
    dwell: 1500,
  },
];

// ─── scene 2: email-style four columns ───────────────────────────────────────

const EMAIL_GROUP = "home-email";

const EMAIL = {
  list: { groupId: EMAIL_GROUP, panelId: "home-email-list" },
  contact: { groupId: EMAIL_GROUP, panelId: "home-email-contact" },
} satisfies Record<string, PanelLocator>;

type EmailContact = {
  title: string;
  subtitle: string;
  initials: string;
  email: string;
  files: string[];
  threads: { subj: string; time: string }[];
};

type EmailRecord = {
  from: string;
  subj: string;
  time: string;
  body: ReactNode[];
  contact: EmailContact;
};

const EMAILS: EmailRecord[] = [
  {
    from: "Daisy",
    subj: "Re: panel layout demo",
    time: "10:42",
    body: [
      "Looks great! Could we make the inspector slide back in faster?",
      "Also — the pinned sidebar in scene 3 is exactly what we want for the ops dashboard.",
      "One more thing: the zoomed-out hero reads so much better. Ship it.",
      "— D",
    ],
    contact: {
      title: "Daisy Lin",
      subtitle: "Product Engineer · Blitzd",
      initials: "DL",
      email: "daisy@blitzd.dev",
      files: ["layout-spec.fig", "panels-brief.pdf"],
      threads: [
        { subj: "Re: panel layout demo", time: "10:42" },
        { subj: "Sidebar spring motion", time: "Mon" },
        { subj: "Q3 design review", time: "May 12" },
      ],
    },
  },
  {
    from: "GitHub",
    subj: "PR #842 ready for review",
    time: "09:18",
    body: [
      "tristansinclair opened a pull request.",
      "refactor(demo): extract IDE archetype into reusable components",
      "+397 −91 across 6 files · 1 reviewer requested",
      "All checks passed · ci / build · 3m 12s",
    ],
    contact: {
      title: "GitHub",
      subtitle: "blitzd / panel-layout",
      initials: "GH",
      email: "notifications@github.com",
      files: ["pr-842.diff"],
      threads: [
        { subj: "PR #842 ready for review", time: "09:18" },
        { subj: "PR #836 merged", time: "Tue" },
        { subj: "Release v0.4.0 tagged", time: "Mon" },
      ],
    },
  },
  {
    from: "Vercel",
    subj: "Deployment succeeded",
    time: "08:51",
    body: [
      "Production deployment ready.",
      "resizable-panels.blitzd.dev · 1.2s build",
      "Triggered by commit 478a41e",
      "Preview: resizable-panels-git-docs.vercel.app",
    ],
    contact: {
      title: "Vercel",
      subtitle: "resizable-panels · production",
      initials: "VE",
      email: "notifications@vercel.com",
      files: ["build-log.txt"],
      threads: [
        { subj: "Deployment succeeded", time: "08:51" },
        { subj: "Preview ready for docs", time: "Tue" },
        { subj: "Domain verified", time: "May 20" },
      ],
    },
  },
  // Below here: filler threads the script never opens, but visitors can —
  // the inbox is a real list wired to real selection state.
  {
    from: "Figma",
    subj: "Design tokens updated",
    time: "08:12",
    body: [
      "libby pushed 14 changes to panel-layout / tokens.",
      "Updated: seam hover color, rail width, motion curves.",
    ],
    contact: {
      title: "Figma",
      subtitle: "panel-layout · tokens",
      initials: "FI",
      email: "team@figma.com",
      files: ["tokens.fig"],
      threads: [
        { subj: "Design tokens updated", time: "08:12" },
        { subj: "Library published", time: "Mon" },
      ],
    },
  },
  {
    from: "Linear",
    subj: "BLZ-214 moved to In Review",
    time: "07:58",
    body: [
      "Docs rewrite: landing page hero demo.",
      "Assigned to tristan · Cycle 14 · Urgent",
    ],
    contact: {
      title: "Linear",
      subtitle: "Docs rewrite · Cycle 14",
      initials: "LI",
      email: "notifications@linear.app",
      files: [],
      threads: [
        { subj: "BLZ-214 moved to In Review", time: "07:58" },
        { subj: "BLZ-198 completed", time: "Tue" },
      ],
    },
  },
  {
    from: "npm",
    subj: "Weekly downloads report",
    time: "07:30",
    body: [
      "@blitzd/resizable-panels — weekly summary.",
      "Downloads trending up since the docs refresh.",
    ],
    contact: {
      title: "npm",
      subtitle: "@blitzd/resizable-panels",
      initials: "NP",
      email: "support@npmjs.com",
      files: [],
      threads: [
        { subj: "Weekly downloads report", time: "07:30" },
        { subj: "v0.4.0 published", time: "Mon" },
      ],
    },
  },
];

// Script steps reach into the live email scene to change the selected
// thread. Installed by EmailLayout on mount, cleared on unmount so a stale
// setter never fires after the scene crossfades away.
const emailSceneApi: { setActive: ((i: number) => void) | null } = {
  setActive: null,
};

function EmailLayout() {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    emailSceneApi.setActive = setActiveIdx;
    return () => {
      emailSceneApi.setActive = null;
    };
  }, []);

  const active = EMAILS[activeIdx];

  return (
    // Nav rail sits outside the PanelGroup as a plain static sidebar —
    // it's purely chrome (a 64px icon strip) so making it a Panel adds
    // resize affordances the user can't really use meaningfully. The
    // resizable layout starts at the mail list.
    <div className="relative flex h-full">
      <aside className="w-16 shrink-0 border-r border-border bg-card">
        <NavRailStub
          inboxControl={
            <RailPanelControl
              target={EMAIL.list}
              label="inbox"
              icon={<Inbox className="size-4" />}
            />
          }
        />
      </aside>
      <div className="min-w-0 flex-1">
        <PanelGroup
          groupId={EMAIL_GROUP}
          orientation="horizontal"
          className="h-full"
        >
          <Panel
            panelId={EMAIL.list.panelId}
            side="start"
            defaultSize={200}
            minSize={160}
            maxSize={400}
            className="border-r border-border bg-card"
          >
            <MailListStub
              items={EMAILS}
              activeIdx={activeIdx}
              onSelect={setActiveIdx}
            />
          </Panel>
          <PanelResizeHandle />
          <Panel minSize={220} className="bg-background">
            <MailReaderStub
              email={active}
              headerActions={
                <PanelControlGroup
                  controls={[
                    {
                      target: EMAIL.contact,
                      label: "contact",
                      icon: <PanelRight className="size-3.5" />,
                    },
                  ]}
                />
              }
            />
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId={EMAIL.contact.panelId}
            side="end"
            defaultSize={240}
            minSize={200}
            maxSize={360}
            className="border-l border-border bg-card"
          >
            <ContactCard contact={active.contact} />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

const emailScript: SceneStep[] = [
  {
    code: "drag to resize",
    drag: { target: EMAIL.list, toSize: 260 },
    dwell: 1000,
  },
  {
    // Switching threads: force-close the contact rail so the previous
    // sender's panel doesn't slide out while the new thread loads.
    code: 'inbox.select("PR #842")\ncontact.collapse({ transition: "none" })',
    action: (a) => {
      emailSceneApi.setActive?.(1);
      a.collapse(EMAIL.contact, { transition: "none" });
    },
    click: { selector: panelControlSelector(EMAIL.contact) },
    dwell: 1600,
  },
  {
    code: "contact.expand()",
    action: (a) => a.expand(EMAIL.contact),
    click: { selector: panelControlSelector(EMAIL.contact) },
    dwell: 1700,
  },
  {
    code: "inbox.collapse()",
    action: (a) => a.collapse(EMAIL.list),
    click: { selector: panelControlSelector(EMAIL.list) },
    dwell: 1400,
  },
  {
    code: "inbox.expand()",
    action: (a) => a.expand(EMAIL.list),
    click: { selector: panelControlSelector(EMAIL.list) },
    dwell: 1500,
  },
  {
    code: 'inbox.select("Deployment")\ncontact.collapse({ transition: "none" })',
    action: (a) => {
      emailSceneApi.setActive?.(2);
      a.collapse(EMAIL.contact, { transition: "none" });
    },
    click: { selector: panelControlSelector(EMAIL.contact) },
    dwell: 1600,
  },
  {
    code: "contact.expand()",
    action: (a) => a.expand(EMAIL.contact),
    click: { selector: panelControlSelector(EMAIL.contact) },
    dwell: 1900,
  },
];

// ─── scene 3: pinned-sidebar dashboard ───────────────────────────────────────

const DASH_GROUP = "home-dash";

const DASH = {
  nav: { groupId: DASH_GROUP, panelId: "home-dash-nav" },
  rail: { groupId: DASH_GROUP, panelId: "home-dash-rail" },
} satisfies Record<string, PanelLocator>;

function DashLayout() {
  return (
    <div className="relative h-full">
      <PanelGroup
        groupId={DASH_GROUP}
        orientation="horizontal"
        className="h-full"
      >
        <Panel
          panelId={DASH.nav.panelId}
          side="start"
          defaultSize={200}
          minSize={180}
          maxSize={280}
          pinned
          className="border-r border-border bg-card"
        >
          <SidebarStub
            icon={<LayoutDashboard className="size-3.5" />}
            title="dashboard"
            items={["overview", "metrics", "logs", "alerts", "billing"]}
            badge="pinned"
          />
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={240} className="bg-background">
          <DashMainStub
            headerActions={
              <PanelControlGroup
                controls={[
                  {
                    target: DASH.nav,
                    label: "navigation",
                    icon: <PanelLeft className="size-3.5" />,
                  },
                  {
                    target: DASH.rail,
                    label: "activity",
                    icon: <PanelRight className="size-3.5" />,
                  },
                ]}
              />
            }
          />
        </Panel>
        <PanelResizeHandle />
        <Panel
          panelId={DASH.rail.panelId}
          side="end"
          defaultSize={220}
          minSize={180}
          maxSize={340}
          className="border-l border-border bg-card"
        >
          <ActivityFeedStub />
        </Panel>
      </PanelGroup>
    </div>
  );
}

const dashScript: SceneStep[] = [
  {
    code: "drag the seam",
    drag: { target: DASH.rail, toSize: 320 },
    dwell: 1000,
  },
  {
    code: "rail.collapse()",
    action: (a) => a.collapse(DASH.rail),
    click: { selector: panelControlSelector(DASH.rail) },
    dwell: 1400,
  },
  {
    code: "rail.expand()",
    action: (a) => a.expand(DASH.rail),
    click: { selector: panelControlSelector(DASH.rail) },
    dwell: 1500,
  },
  {
    code: "pinned panels resize too",
    drag: { target: DASH.nav, toSize: 240 },
    dwell: 1000,
  },
  {
    code: "nav.collapse()",
    action: (a) => a.collapse(DASH.nav),
    click: { selector: panelControlSelector(DASH.nav) },
    dwell: 1500,
  },
  {
    code: "nav.expand()",
    action: (a) => a.expand(DASH.nav),
    click: { selector: panelControlSelector(DASH.nav) },
    dwell: 1500,
  },
];

// ─── exports ─────────────────────────────────────────────────────────────────

export const SCENES: Scene[] = [
  {
    id: "ide",
    title: "IDE shell",
    icon: PanelsTopLeft,
    blurb:
      "Fully interactive: open files, split the editor, run commands, ask the agent — every pane is a real panel.",
    Layout: IdeLayout,
    script: ideScript,
  },
  {
    id: "email",
    title: "Email layout",
    icon: Inbox,
    blurb:
      "Peer columns: the inbox and contact rail collapse away and slide back without unmounting.",
    Layout: EmailLayout,
    script: emailScript,
  },
  {
    id: "dash",
    title: "Dashboard",
    icon: LayoutDashboard,
    blurb:
      "Pinned navigation plus an activity rail — both resizable, both collapsible on command.",
    Layout: DashLayout,
    script: dashScript,
  },
];

// ─── stub content components ─────────────────────────────────────────────────

function SidebarStub({
  icon,
  title,
  items,
  badge,
}: {
  icon: ReactNode;
  title: string;
  items: string[];
  badge?: string;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {icon}
          {title}
        </div>
        {badge ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-primary">
            {badge}
          </span>
        ) : null}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="px-2 py-2 text-xs text-foreground/80">
          {items.map((item) => (
            <li
              key={item}
              className="truncate rounded px-2 py-1 hover:bg-accent"
            >
              {item}
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}

function NavRailStub({ inboxControl }: { inboxControl: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center gap-1 py-3">
      {inboxControl}
      {[Star, Search, Settings].map((Icon, i) => (
        <div
          key={i}
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
        >
          <Icon className="size-4" />
        </div>
      ))}
    </div>
  );
}

function MailListStub({
  items,
  activeIdx,
  onSelect,
}: {
  items: EmailRecord[];
  activeIdx: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <span>inbox</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] text-primary">
          2 new
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ToggleGroup
          render={<ul />}
          value={[String(activeIdx)]}
          onValueChange={(value) => {
            if (value[0] !== undefined) onSelect(Number(value[0]));
          }}
          className="flex w-full flex-col items-stretch gap-0 rounded-none"
        >
          {items.map((m, i) => {
            const isActive = i === activeIdx;
            return (
              <li key={i}>
                <ToggleGroupItem
                  value={String(i)}
                  className={cn(
                    "h-auto w-full flex-col items-stretch justify-start rounded-none border-b border-border/60 px-3 py-2 text-left text-xs",
                    isActive ? "bg-accent/60" : "hover:bg-accent/30",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium text-foreground">
                      {m.from}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {m.time}
                    </span>
                  </div>
                  <div className="truncate text-muted-foreground">{m.subj}</div>
                </ToggleGroupItem>
              </li>
            );
          })}
        </ToggleGroup>
      </ScrollArea>
    </div>
  );
}

function MailReaderStub({
  email,
  headerActions,
}: {
  email: EmailRecord;
  headerActions?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">
            {email.from} · {email.time}
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold text-foreground">
            {email.subj}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {headerActions}
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 px-4 py-3 text-xs leading-5 text-foreground/80">
          {email.body.map((line, i) => (
            <p
              key={i}
              className={
                i === email.body.length - 1
                  ? "text-muted-foreground"
                  : undefined
              }
            >
              {line}
            </p>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

const DASH_STATS = [
  {
    label: "Requests",
    value: "1.2M",
    delta: "+4.2%",
    good: true,
    trend: [4, 6, 5, 8, 7, 9, 8, 11, 10, 12, 11, 13],
  },
  {
    label: "p95 latency",
    value: "184ms",
    delta: "−12ms",
    good: true,
    trend: [9, 7, 8, 6, 7, 5, 6, 5, 4, 5, 4, 4],
  },
  {
    label: "Error rate",
    value: "0.04%",
    delta: "−0.01%",
    good: true,
    trend: [3, 4, 2, 3, 2, 2, 3, 2, 1, 2, 1, 1],
  },
  {
    label: "Uptime",
    value: "99.99%",
    delta: "stable",
    good: true,
    trend: [5, 5, 6, 5, 5, 6, 5, 6, 5, 5, 6, 6],
  },
];

const DASH_REQUEST_SERIES = [
  22, 25, 24, 28, 26, 31, 29, 34, 30, 36, 33, 38, 35, 41, 37, 40, 44, 42, 47,
  45, 50, 48, 53, 56,
];

const DASH_DEPLOYS = [
  {
    sha: "478a41e",
    msg: "docs: landing hero refresh",
    time: "2m",
    building: true,
  },
  {
    sha: "161bdfa",
    msg: "docs: header menu groups",
    time: "1h",
    building: false,
  },
  {
    sha: "50e7174",
    msg: "docs: registry skeleton",
    time: "3h",
    building: false,
  },
  { sha: "eee3881", msg: "docs: style contract", time: "5h", building: false },
  {
    sha: "5015810",
    msg: "docs: warning callouts",
    time: "8h",
    building: false,
  },
  {
    sha: "9b88c0c",
    msg: "docs: consistency pass",
    time: "12h",
    building: false,
  },
];

function DashMainStub({ headerActions }: { headerActions?: ReactNode }) {
  return (
    <div className="@container flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <PanelLeft className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Overview</span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          last 24h
        </span>
        <div className="flex items-center gap-0.5">{headerActions}</div>
      </div>

      {/* Stat strip: hairline dividers, no boxes. */}
      <div className="@[320px]:grid-cols-2 @[560px]:grid-cols-4 @[560px]:divide-x grid shrink-0 grid-cols-1 divide-border/50 border-b border-border/60">
        {DASH_STATS.map((s) => (
          <div key={s.label} className="min-w-0 px-4 py-2.5">
            <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
              {s.label}
            </div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-lg font-semibold tabular-nums text-foreground">
                {s.value}
              </span>
              <span
                className={cn(
                  "truncate text-[10px]",
                  s.good ? "text-emerald-400" : "text-red-400",
                )}
              >
                {s.delta}
              </span>
            </div>
            <Sparkline points={s.trend} className="mt-1.5" />
          </div>
        ))}
      </div>

      <div className="shrink-0 border-b border-border/60 px-4 pb-3 pt-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Requests
          </span>
          <span className="text-[10px] text-muted-foreground/60">
            48 req/s now
          </span>
        </div>
        <AreaChart points={DASH_REQUEST_SERIES} className="mt-2 h-20 w-full" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2 pt-2">
        <div className="flex shrink-0 items-baseline justify-between pb-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Recent deploys
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/60">
            main
          </span>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-border/40 overflow-hidden text-[11px]">
          {DASH_DEPLOYS.map((d) => (
            <li key={d.sha} className="flex items-center gap-2 py-1.5">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  d.building ? "animate-pulse bg-amber-400" : "bg-emerald-400",
                )}
              />
              <span className="font-mono text-muted-foreground">{d.sha}</span>
              <span className="min-w-0 truncate text-foreground/80">
                {d.msg}
              </span>
              <span className="ml-auto shrink-0 text-muted-foreground">
                {d.time}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── chart + detail stubs ────────────────────────────────────────────────────

/** Points normalized into the viewBox with a little breathing room. */
const chartPath = (points: number[], height: number, inset: number) => {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  return points.map((p, i) => {
    const x = (i / (points.length - 1)) * 100;
    const y = height - inset - ((p - min) / span) * (height - inset * 2);
    return `${x},${y}`;
  });
};

/** Decorative single-series sparkline — one hue, no axes at this size. */
function Sparkline({
  points,
  className,
}: {
  points: number[];
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("h-5 w-full text-sky-400/70", className)}
    >
      <polyline
        points={chartPath(points, 24, 2).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Single-series area chart with a soft gradient fill under the line. */
function AreaChart({
  points,
  className,
}: {
  points: number[];
  className?: string;
}) {
  const coords = chartPath(points, 40, 3);
  const line = `M${coords.join(" L")}`;
  const area = `${line} L100,40 L0,40 Z`;
  return (
    <svg
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("text-sky-400", className)}
    >
      <defs>
        <linearGradient id="dash-area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#dash-area-fill)" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Contact profile for the email scene's detail rail. */
function ContactCard({ contact }: { contact: EmailContact }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Contact
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col items-center px-3 pb-3 pt-4 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {contact.initials}
          </div>
          <div className="mt-2 text-sm font-semibold text-foreground">
            {contact.title}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {contact.subtitle}
          </div>
          <div className="mt-2 flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={`Email ${contact.title}`}
            >
              <Mail className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={`Schedule with ${contact.title}`}
            >
              <Calendar className="size-3.5" />
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="More actions">
              <MoreHorizontal className="size-3.5" />
            </Button>
          </div>
          <div className="mt-2 max-w-full truncate font-mono text-[10px] text-muted-foreground">
            {contact.email}
          </div>
        </div>
        {contact.files.length > 0 ? (
          <ContactSection label="Shared files">
            {contact.files.map((name) => (
              <li key={name} className="flex items-center gap-1.5 py-1">
                <FileText className="size-3 shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate text-foreground/80">
                  {name}
                </span>
              </li>
            ))}
          </ContactSection>
        ) : null}
        <ContactSection label="Recent threads">
          {contact.threads.map((thread) => (
            <li
              key={thread.subj}
              className="flex items-baseline justify-between gap-2 py-1"
            >
              <span className="min-w-0 truncate text-foreground/80">
                {thread.subj}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {thread.time}
              </span>
            </li>
          ))}
        </ContactSection>
      </ScrollArea>
    </div>
  );
}

function ContactSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-border/60 px-3 py-2">
      <div className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground/70">
        {label}
      </div>
      <ul className="mt-1 text-[11px]">{children}</ul>
    </div>
  );
}

/** Live-feeling event feed for the dashboard's end rail. */
function ActivityFeedStub() {
  const events = [
    {
      dot: "bg-amber-400 animate-pulse",
      text: "deploy started · 478a41e",
      time: "2m",
    },
    { dot: "bg-emerald-400", text: "PR #842 merged", time: "1h" },
    { dot: "bg-emerald-400", text: "alert resolved · p95 latency", time: "2h" },
    { dot: "bg-sky-400", text: "cron: nightly backup ok", time: "6h" },
    { dot: "bg-emerald-400", text: "deploy succeeded · 161bdfa", time: "8h" },
    { dot: "bg-red-400", text: "alert fired · error rate", time: "9h" },
    { dot: "bg-emerald-400", text: "autoscaled to 6 instances", time: "12h" },
  ];
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Star className="size-3.5" />
        Activity
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="divide-y divide-border/40 px-3 text-[11px]">
          {events.map((event) => (
            <li key={event.text} className="flex items-center gap-2 py-1.5">
              <span
                className={cn("size-1.5 shrink-0 rounded-full", event.dot)}
              />
              <span className="min-w-0 truncate text-foreground/80">
                {event.text}
              </span>
              <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                {event.time}
              </span>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
