import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelActions,
  usePanelGroupState,
} from "@blitzd/resizable-panels";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const GROUP_ID = "drawer";

/**
 * Each side panel demotes to a sheet when the GROUP CONTAINER — not the
 * viewport — is too narrow to hold it. `enterSheetBelow` / `exitSheetAbove`
 * bracket a hysteresis band: once inline, the panel drops to a sheet only
 * below the lower number; once a sheet, it returns inline only above the
 * higher one, so width jitter inside the band cannot flap the mode.
 */
const NAV = {
  id: "nav",
  side: "start" as const,
  defaultSize: 280,
  minSize: 220,
  maxSize: 420,
  enterSheetBelow: 1180,
  exitSheetAbove: 1300,
};
const INSPECTOR = {
  id: "inspector",
  side: "end" as const,
  defaultSize: 460,
  minSize: 360,
  maxSize: 720,
  enterSheetBelow: 980,
  exitSheetAbove: 1100,
};

type PanelMode = "inline" | "sheet";

type BreakpointConfig = { enterSheetBelow: number; exitSheetAbove: number };

/**
 * Container-based responsive mode with a hysteresis band. Reads the group's
 * measured `containerSize` through `usePanelGroupState`, so it works for a
 * nested group or a group inside a card — unlike `window.matchMedia`.
 *
 * Mode updates run in `useEffect`, not during render: remounting PanelGroup
 * children from a render-phase setState nests into the group's layout
 * allocation under React 18 and hits max update depth. One pre-measure inline
 * frame is preferable to that loop; hysteresis still prevents flapping once
 * mode is latched.
 */
function useContainerBreakpoint(
  groupId: string,
  { enterSheetBelow, exitSheetAbove }: BreakpointConfig,
): PanelMode {
  const state = usePanelGroupState(groupId);
  const [mode, setMode] = useState<PanelMode | null>(null);
  useEffect(() => {
    if (!state?.measured) return;
    const size = state.containerSize;
    setMode((current) => {
      if (current === null) return size < enterSheetBelow ? "sheet" : "inline";
      if (current === "inline" && size < enterSheetBelow) return "sheet";
      if (current === "sheet" && size > exitSheetAbove) return "inline";
      return current;
    });
  }, [state, enterSheetBelow, exitSheetAbove]);
  return mode ?? "inline";
}

/**
 * Persistent-host portal (criterion 4): `content` mounts once into a stable,
 * manually created node and never unmounts, so its React state AND live DOM
 * (uncontrolled input values, expansion) survive being moved between an inline
 * panel and a sheet. Attach the returned `setHost` to whichever host is
 * currently rendered; a layout effect reparents the stable node into it. Only
 * the DOM moves — the component instance is untouched.
 *
 * The browser resets an element's scroll offset when it is re-inserted into
 * the document, so this host records every descendant scroll position and
 * restores it after the move. Other DOM-level costs of a reparent are NOT
 * recoverable and must be accepted honestly: focus is lost, iframes reload,
 * and playing media can stutter. When the surviving state is already external
 * (lifted or persisted), plain state-lifting is simpler and has none of these.
 */
function useReparentableContent(content: ReactNode) {
  const container = useMemo(() => {
    const el = document.createElement("div");
    el.style.height = "100%";
    return el;
  }, []);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const scrollMemo = useRef(new Map<Element, [number, number]>());
  useEffect(() => {
    const remember = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        scrollMemo.current.set(target, [target.scrollTop, target.scrollLeft]);
      }
    };
    container.addEventListener("scroll", remember, true);
    return () => container.removeEventListener("scroll", remember, true);
  }, [container]);
  useLayoutEffect(() => {
    if (!host || container.parentElement === host) return;
    host.appendChild(container);
    const restore = () => {
      for (const [element, [top, left]] of scrollMemo.current) {
        if (element instanceof HTMLElement && container.contains(element)) {
          element.scrollTop = top;
          element.scrollLeft = left;
        }
      }
    };
    restore();
    // A host that is display:none (a closed <dialog>) has no scroll range yet;
    // re-apply once it gains layout (e.g. the sheet opens).
    if (host.clientHeight === 0 && typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        if (host.clientHeight > 0) {
          restore();
          observer.disconnect();
        }
      });
      observer.observe(host);
      return () => observer.disconnect();
    }
  }, [host, container]);
  return { setHost, portal: createPortal(content, container) };
}

function DrawerDialog({
  open,
  onOpenChange,
  side,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: "start" | "end";
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={`drawer drawer--${side}`}
      onClose={() => onOpenChange(false)}
    >
      {children}
    </dialog>
  );
}

/**
 * The content that survives the swap. Everything stateful here — the counter's
 * React state, the uncontrolled draft input's DOM value, and the scroll
 * region's scroll position — persists across panel ⇄ sheet because the
 * instance and its DOM node are only moved, never remounted.
 */
function PanelContent({
  id,
  title,
  label,
}: {
  id: string;
  title: string;
  label: string;
}) {
  const [count, setCount] = useState(0);
  return (
    <div className="drawer-panel-content">
      <h2>{title}</h2>
      <div className="counter">
        <span data-testid={`counter-${id}`} className="counter-value">
          {count}
        </span>
        <button
          type="button"
          className="toolbar-toggle"
          aria-label={`Increment ${label}`}
          onClick={() => setCount((value) => value + 1)}
        >
          +1
        </button>
      </div>
      <input
        data-testid={`draft-${id}`}
        className="drawer-input"
        defaultValue=""
        placeholder="Draft note"
      />
      <div data-testid={`scroll-${id}`} className="drawer-scroll">
        {Array.from({ length: 40 }, (_, line) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static list.
          <p key={line}>scrollable line {line}</p>
        ))}
      </div>
    </div>
  );
}

function Main({
  navInline,
  inspectorInline,
  onOpenNavDrawer,
  onOpenInspectorDrawer,
}: {
  navInline: boolean;
  inspectorInline: boolean;
  onOpenNavDrawer: () => void;
  onOpenInspectorDrawer: () => void;
}) {
  const actions = usePanelActions();
  return (
    <main className="drawer-main">
      <button
        type="button"
        className="toolbar-toggle"
        onClick={() =>
          navInline
            ? actions.toggle({ groupId: GROUP_ID, panelId: NAV.id })
            : onOpenNavDrawer()
        }
      >
        Nav
      </button>
      <button
        type="button"
        className="toolbar-toggle"
        onClick={() =>
          inspectorInline
            ? actions.toggle({ groupId: GROUP_ID, panelId: INSPECTOR.id })
            : onOpenInspectorDrawer()
        }
      >
        Inspector
      </button>
    </main>
  );
}

/** The application owns the breakpoint, the drawer presentation, and where the
 * shared content lives. The panel library owns only the inline layout and the
 * container measurement the breakpoint reads. */
function DrawerLayout() {
  const navMode = useContainerBreakpoint(GROUP_ID, NAV);
  const inspectorMode = useContainerBreakpoint(GROUP_ID, INSPECTOR);
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [inspectorDrawerOpen, setInspectorDrawerOpen] = useState(false);

  // Criterion 3: the panel UNMOUNTS while presented as a sheet, so its size
  // must be held outside it. The parent keeps the last committed size and
  // feeds it back as `defaultSize`, so the panel returns to it on remount.
  const [navSize, setNavSize] = useState(NAV.defaultSize);
  const [inspectorSize, setInspectorSize] = useState(INSPECTOR.defaultSize);

  const nav = useReparentableContent(
    <PanelContent id="nav" title="LeftPanel" label="nav local state" />,
  );
  const inspector = useReparentableContent(
    <PanelContent
      id="inspector"
      title="RightPanel"
      label="inspector local state"
    />,
  );

  return (
    <div className="fixture-root">
      {/* Content mounted once, at a stable position above the swapping hosts. */}
      {nav.portal}
      {inspector.portal}

      <PanelGroup
        orientation="horizontal"
        groupId={GROUP_ID}
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
              className="panel-surface"
            >
              <div ref={nav.setHost} style={{ height: "100%" }} />
            </Panel>
            <PanelResizeHandle />
          </>
        )}
        <Panel>
          <Main
            navInline={navMode === "inline"}
            inspectorInline={inspectorMode === "inline"}
            onOpenNavDrawer={() => setNavDrawerOpen(true)}
            onOpenInspectorDrawer={() => setInspectorDrawerOpen(true)}
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
              className="panel-surface"
            >
              <div ref={inspector.setHost} style={{ height: "100%" }} />
            </Panel>
          </>
        )}
      </PanelGroup>

      {navMode === "sheet" && (
        <DrawerDialog
          open={navDrawerOpen}
          onOpenChange={setNavDrawerOpen}
          side="start"
          title="Nav drawer"
        >
          <div ref={nav.setHost} style={{ height: "100%" }} />
        </DrawerDialog>
      )}
      {inspectorMode === "sheet" && (
        <DrawerDialog
          open={inspectorDrawerOpen}
          onOpenChange={setInspectorDrawerOpen}
          side="end"
          title="Inspector drawer"
        >
          <div ref={inspector.setHost} style={{ height: "100%" }} />
        </DrawerDialog>
      )}
    </div>
  );
}

export default function ResponsiveDrawerTest() {
  return (
    <PanelProvider>
      <DrawerLayout />
    </PanelProvider>
  );
}
