import {
  type PanelLocator,
  PanelProvider,
  usePanelActions,
  usePanelControls,
} from "@blitzd/resizable-panels";
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

type PanelInfo = { groupId: string; panelId: string; label: string };

type MiniDemoFrameProps = {
  panels?: PanelInfo[];
  toolbar?: ReactNode;
  frameClassName?: string;
  children: ReactNode;
};

/**
 * Sandbox frame for an inline panel demo: own PanelProvider, a toggle toolbar,
 * and a bordered viewport. Pass `panels` to render auto-wired toggle buttons,
 * or `toolbar` for fully custom controls.
 */
/** Smallest width the demo viewport can be dragged down to, px. */
const DEMO_MIN_WIDTH = 220;

/**
 * The bordered, user-resizable demo viewport shared by MiniDemoFrame and the
 * docs Example primitive. Carries `data-resizable-panels-demo-frame`, which
 * keys the global CSS that keeps resize-handle seams visible at rest and
 * highlights them while dragging (see index.css). Callers own the height
 * (h-28 for mini demos, taller for docs examples) via `className`.
 *
 * A grab handle on the right edge resizes the viewport's width — the way a
 * reader pokes at how each demo reacts to container changes (percentages
 * rescale, px panels hold, auto panels fold). Double-click the handle to
 * restore the full width.
 */
export function DemoSurface({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  // null = follow the container (full width).
  const [width, setWidth] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  // Suppress panel width transitions until after the first layout so mount
  // measurement can't tween a sidebar open and shove preview content right.
  // User-driven collapse/expand still animates once this flips true.
  const [layoutReady, setLayoutReady] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  useLayoutEffect(() => {
    let cancelled = false;
    // Double rAF: wait out the panel group's ResizeObserver measure pass so
    // enabling transitions can't catch a late size commit and tween it.
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setLayoutReady(true);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, []);

  const maxWidth = () => {
    const track = trackRef.current;
    // The handle column (w-4 = 16px) + gap (6px) stay outside the frame.
    return track ? track.clientWidth - 22 : Number.POSITIVE_INFINITY;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const frame = trackRef.current?.firstElementChild;
    if (!(frame instanceof HTMLElement)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: frame.getBoundingClientRect().width,
    };
    setDragging(true);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const next = drag.startWidth + (event.clientX - drag.startX);
    setWidth(Math.round(Math.min(maxWidth(), Math.max(DEMO_MIN_WIDTH, next))));
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  };

  return (
    <div ref={trackRef} data-markdown-exclude className="flex items-stretch">
      <div
        data-resizable-panels-demo-frame=""
        data-demo-layout-ready={layoutReady ? "" : undefined}
        className={cn(
          "relative overflow-hidden rounded-lg border border-border bg-muted p-1",
          width === null && "flex-1",
          className,
        )}
        style={width === null ? undefined : { width }}
      >
        {children}
      </div>
      <div
        aria-hidden
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => setWidth(null)}
        title="Drag to resize the demo — double-click to reset"
        className="group flex w-4 shrink-0 cursor-ew-resize touch-none items-center justify-center"
      >
        <div
          className={cn(
            "h-10 w-1.5 rounded-full bg-border transition-colors group-hover:bg-muted-foreground/50",
            dragging && "bg-muted-foreground",
          )}
        />
      </div>
    </div>
  );
}

export function MiniDemoFrame({
  panels,
  toolbar,
  frameClassName,
  children,
}: MiniDemoFrameProps) {
  return (
    <PanelProvider>
      <div className="flex flex-col gap-2" data-markdown-exclude>
        {toolbar ?? (panels ? <DemoToolbar panels={panels} /> : null)}
        <DemoSurface className={cn("h-28", frameClassName)}>
          {children}
        </DemoSurface>
      </div>
    </PanelProvider>
  );
}

function DemoToolbar({ panels }: { panels: PanelInfo[] }) {
  const actions = usePanelActions();
  // Panels may live in different groups (nested layouts); reset each
  // group once. resetGroupValue restores the declarative defaults —
  // defaultSize and defaultCollapsed — for every panel in the group.
  const groupIds = [...new Set(panels.map((p) => p.groupId))];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {panels.map((p) => (
        <ToggleButton
          key={`${p.groupId}/${p.panelId}`}
          groupId={p.groupId}
          panelId={p.panelId}
          label={p.label}
        />
      ))}
      <Button
        variant="secondary"
        size="xs"
        onClick={() => {
          for (const groupId of groupIds) actions.resetGroupValue(groupId);
        }}
        className="ml-auto"
      >
        Reset
      </Button>
    </div>
  );
}

export function ToggleButton({
  groupId,
  panelId,
  label,
}: PanelLocator & { label: string }) {
  const ctrl = usePanelControls({ groupId, panelId });
  if (!ctrl?.collapsible) {
    return (
      <span className="rounded-md border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-foreground">
        {label}
      </span>
    );
  }
  return (
    <Toggle
      variant="outline"
      size="sm"
      pressed={!ctrl.collapsed}
      data-testid={`toggle-${panelId}`}
      aria-expanded={!ctrl.collapsed}
      onPressedChange={(pressed) => ctrl.setCollapsed(!pressed)}
      className="h-6 px-2 text-xs aria-pressed:border-primary/40 aria-pressed:bg-primary/10 aria-pressed:text-primary"
    >
      {ctrl.collapsed ? "Expand" : "Collapse"} {label}
    </Toggle>
  );
}

export function MiniPanel({
  groupId,
  panelId,
  label,
}: {
  groupId?: string;
  panelId?: string;
  label: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-0.5 bg-background/30 text-foreground">
      <span className="text-sm font-medium">{label}</span>
      {groupId && panelId ? (
        <PanelSizeReadout groupId={groupId} panelId={panelId} />
      ) : null}
    </div>
  );
}

export function PanelSizeReadout({ groupId, panelId }: PanelLocator) {
  const ctrl = usePanelControls({ groupId, panelId });
  if (!ctrl) return null;
  // Show the actually-rendered px size so the readout matches what the
  // user sees — diverges from `ctrl.size` (preferred/stored) when the
  // layout is over-constrained and dockeds have been shrunk to fit.
  return (
    <span className="font-mono text-[10px] text-muted-foreground">
      {Math.round(ctrl.renderedSize)}px
    </span>
  );
}
