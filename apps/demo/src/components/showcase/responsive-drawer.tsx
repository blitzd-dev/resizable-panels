import { usePanelGroupState } from "@blitzd/resizable-panels";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

/**
 * The blessed responsive-drawer pattern, container-based.
 *
 * A side panel demotes to a sheet when the GROUP's own measured width — not
 * the viewport — is too narrow to hold it. That distinction matters for a
 * nested group or a group inside a card, where the viewport is the wrong
 * number. Both hooks below read the container through `usePanelGroupState`.
 */

export type PanelMode = "inline" | "sheet";

export type BreakpointBand = {
  /** Once inline, demote to a sheet only below this container width. */
  enterSheetBelow: number;
  /** Once a sheet, return inline only above this width. The gap between the
   * two is a hysteresis band: width jitter inside it cannot flap the mode. */
  exitSheetAbove: number;
};

/**
 * Container-based responsive mode with a hysteresis band. Mode updates run in
 * `useEffect`, not during render: remounting PanelGroup children from a
 * render-phase setState nests into allocation under React 18 and hits max
 * update depth. One pre-measure inline frame is preferable; hysteresis still
 * prevents flapping once mode is latched.
 */
export function useContainerBreakpoint(
  groupId: string,
  { enterSheetBelow, exitSheetAbove }: BreakpointBand,
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
 * Persistent-host portal: `content` mounts once into a stable, manually
 * created node and never unmounts, so its React state AND live DOM
 * (uncontrolled input values, expansion, and — with the scroll bookkeeping
 * below — scroll position) survive being moved between an inline panel body
 * and a sheet body. Attach the returned `setHost` to whichever host is
 * currently rendered; a layout effect reparents the stable node into it. Only
 * the DOM moves; the component instance is untouched.
 *
 * Honest costs of a reparent that this does NOT recover: focus is lost,
 * iframes reload, playing media can stutter. When the surviving state is
 * already external (lifted or persisted), plain state-lifting is simpler and
 * has none of these — reach for this only when the state lives in the DOM or
 * deep in a component you do not own.
 */
export function useReparentableContent(content: ReactNode) {
  const container = useMemo(() => {
    const element = document.createElement("div");
    element.style.height = "100%";
    return element;
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
    // A host that is display:none (a closed sheet) has no scroll range yet;
    // re-apply once it gains layout.
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

/**
 * Lets an app-level control (the floating dock) follow a panel across the
 * inline ⇄ sheet boundary. The layout publishes each responsive panel's live
 * mode + sheet-opener here; a control reads it and, when the panel is demoted,
 * labels the state truthfully and opens the sheet instead of no-opping a
 * toggle on an unmounted panel (U1). Absent registration, controls behave
 * exactly as before — non-responsive demos are unaffected.
 */
export type DrawerControl = { mode: PanelMode; openSheet: () => void };

type DrawerRegistry = {
  get: (key: string) => DrawerControl | undefined;
  set: (key: string, control: DrawerControl | undefined) => void;
  subscribe: (cb: () => void) => () => void;
};

const DrawerRegistryContext = createContext<DrawerRegistry | null>(null);
const drawerKey = (groupId: string, panelId: string) => `${groupId}/${panelId}`;

export function ResponsiveDrawerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [registry] = useState<DrawerRegistry>(() => {
    const map = new Map<string, DrawerControl>();
    const subscribers = new Set<() => void>();
    return {
      get: (key) => map.get(key),
      set: (key, control) => {
        if (control) map.set(key, control);
        else map.delete(key);
        for (const cb of [...subscribers]) cb();
      },
      subscribe: (cb) => {
        subscribers.add(cb);
        return () => subscribers.delete(cb);
      },
    };
  });
  return (
    <DrawerRegistryContext.Provider value={registry}>
      {children}
    </DrawerRegistryContext.Provider>
  );
}

/** The layout calls this to publish a responsive panel's live mode + opener.
 * Pass a stable `openSheet` (useCallback) so the registration does not churn. */
export function useRegisterDrawerControl(
  groupId: string,
  panelId: string,
  mode: PanelMode,
  openSheet: () => void,
) {
  const registry = useContext(DrawerRegistryContext);
  useEffect(() => {
    if (!registry) return;
    const key = drawerKey(groupId, panelId);
    registry.set(key, { mode, openSheet });
    return () => registry.set(key, undefined);
  }, [registry, groupId, panelId, mode, openSheet]);
}

/** A control reads a panel's live drawer state; `undefined` when the panel is
 * not a registered responsive panel (behave as an inline control). */
export function useDrawerControl(
  groupId: string,
  panelId: string,
): DrawerControl | undefined {
  const registry = useContext(DrawerRegistryContext);
  const key = drawerKey(groupId, panelId);
  return useSyncExternalStore(
    (cb) => (registry ? registry.subscribe(cb) : () => {}),
    () => registry?.get(key),
    () => undefined,
  );
}
