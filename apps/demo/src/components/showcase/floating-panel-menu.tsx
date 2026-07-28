import {
  usePanelControls,
  usePanelInteractionState,
} from "@blitzd/resizable-panels";
import { GripHorizontal, type LucideIcon, RefreshCcw, Zap } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Item } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { clamp, cn } from "@/lib/utils";
import { useDrawerControl } from "./responsive-drawer";

/** Selector for the floating dock root. */
export const FLOATING_PANEL_MENU_SELECTOR = "[data-floating-panel-menu]";

export type FloatingPanelMenuItem = {
  /** groupId of the PanelGroup this panel belongs to — items may target
   *  panels across several groups (e.g. a nested editor group). */
  groupId: string;
  panelId: string;
  label: string;
  Icon?: LucideIcon;
};

export type FloatingPanelMenuAction = {
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
  title?: string;
};

export type FloatingPanelMenuPersistence = {
  enabled: boolean;
  onToggle: (on: boolean) => void;
  onRemount: () => void;
};

const EDGE_MARGIN = 8;

/**
 * Compact floating dock for poking at a demo's panels. Each row toggles
 * its panel (animated) and shows live state; the zap button force-toggles
 * it (instant, no animation). The persistence section toggles the group's
 * persistence key and remounts the group; the footer lights up while the layout is
 * dragging / container-resizing.
 *
 * Portaled to <body> and fixed-positioned so panel animations never shift
 * it; loads top-center (just below the demo nav) and the grip handle lets
 * you drag it anywhere on the page.
 */
export function FloatingPanelMenu({
  items,
  persistence,
  actions,
  children,
  className,
}: {
  items: FloatingPanelMenuItem[];
  persistence?: FloatingPanelMenuPersistence;
  /** Optional demo-specific buttons, rendered as a compact row below the
   *  panel rows (e.g. persistence's reset). */
  actions?: FloatingPanelMenuAction[];
  /** Optional demo-specific readout, rendered above the activity footer. */
  children?: React.ReactNode;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  // null → default docked spot (top-center); set once the user drags.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  // Cumulative so each remount click adds one smooth full rotation.
  const [spins, setSpins] = useState(0);

  const startDrag = (e: React.PointerEvent) => {
    const box = boxRef.current;
    if (!box) return;
    e.preventDefault();
    const rect = box.getBoundingClientRect();
    const grabX = e.clientX - rect.left;
    const grabY = e.clientY - rect.top;

    const onMove = (ev: PointerEvent) => {
      setPos({
        x: clamp(
          ev.clientX - grabX,
          EDGE_MARGIN,
          window.innerWidth - rect.width - EDGE_MARGIN,
        ),
        y: clamp(
          ev.clientY - grabY,
          EDGE_MARGIN,
          window.innerHeight - rect.height - EDGE_MARGIN,
        ),
      });
    };
    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  return createPortal(
    <TooltipProvider>
      <div
        ref={boxRef}
        data-floating-panel-menu=""
        className={cn(
          "fixed z-50 w-56",
          !pos && "top-20 left-1/2 -translate-x-1/2",
          className,
        )}
        style={pos ? { left: pos.x, top: pos.y } : undefined}
      >
        <ScrollArea className="max-h-[calc(100vh-1rem)] rounded-xl border border-border bg-card/90 shadow-lg backdrop-blur-sm">
          <div className="flex flex-col gap-0.5 p-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-label="Drag panel menu"
                    onPointerDown={startDrag}
                    className="h-4 w-full cursor-grab touch-none px-0 text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
                  />
                }
              >
                <GripHorizontal className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                Drag to move
              </TooltipContent>
            </Tooltip>

            {items.map((item) => (
              <PanelMenuRow
                key={`${item.groupId}/${item.panelId}`}
                item={item}
              />
            ))}

            {persistence && (
              <Item
                size="xs"
                className="mt-0.5 flex-nowrap gap-2 rounded-none border-x-0 border-b-0 border-border/70 px-2 pt-1.5 pb-0.5"
              >
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Switch
                        checked={persistence.enabled}
                        onCheckedChange={persistence.onToggle}
                        aria-label="Persist layout"
                      />
                    }
                  />
                  <TooltipContent side="left" sideOffset={10}>
                    Stores the layout across reloads
                  </TooltipContent>
                </Tooltip>
                <span className="text-[10px] font-medium text-muted-foreground">
                  persist
                </span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => {
                          setSpins((s) => s + 1);
                          persistence.onRemount();
                        }}
                        aria-label="Remount layout"
                        className="ml-auto cursor-pointer text-muted-foreground hover:text-foreground"
                      />
                    }
                  >
                    <RefreshCcw
                      className="size-3 transition-transform duration-500 ease-out"
                      style={{ transform: `rotate(${spins * -360}deg)` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>
                    Remount the layout — simulates a reload
                  </TooltipContent>
                </Tooltip>
              </Item>
            )}

            {actions && actions.length > 0 && (
              <div className="mt-0.5 flex gap-0.5 border-t border-border/70 pt-1">
                {actions.map(({ label, Icon, onClick, title }) => (
                  <Button
                    key={label}
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={onClick}
                    title={title}
                    className="h-6 flex-1 cursor-pointer gap-1.5 text-[10px] text-muted-foreground hover:text-accent-foreground"
                  >
                    <Icon className="size-3" />
                    {label}
                  </Button>
                ))}
              </div>
            )}

            {children && (
              <div className="mt-0.5 border-t border-border/70 px-1 pt-1">
                {children}
              </div>
            )}

            <ActivityFooter />
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>,
    document.body,
  );
}

/** One dock row: toggles its panel (animated), shows live state, and the zap
 *  button force-toggles it (instant, no animation). */
function PanelMenuRow({ item }: { item: FloatingPanelMenuItem }) {
  const { groupId, panelId, label, Icon } = item;
  const drawer = useDrawerControl(groupId, panelId);
  const ctrl = usePanelControls({ groupId, panelId });

  // Demoted to a sheet: the panel is unmounted, so a collapse toggle would be a
  // lie. Label the mode truthfully and open the sheet instead (U1).
  if (drawer?.mode === "sheet") {
    return (
      <Item size="xs" className="flex-nowrap gap-0.5 border-transparent p-0">
        <Toggle
          pressed={false}
          onPressedChange={() => drawer.openSheet()}
          title={`open("${panelId}") sheet`}
          className="h-7 min-w-0 flex-1 cursor-pointer justify-start gap-2 px-2 text-left text-xs"
        >
          <span className="size-1.5 shrink-0 rounded-full bg-primary/60" />
          {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" />}
          <span className="truncate font-medium">{label}</span>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            sheet
          </span>
        </Toggle>
      </Item>
    );
  }

  const expanded = ctrl ? !ctrl.collapsed : false;
  const readout = !expanded
    ? "collapsed"
    : `${Math.round(ctrl?.renderedSize ?? 0)}px`;

  return (
    <Item size="xs" className="flex-nowrap gap-0.5 border-transparent p-0">
      <Toggle
        pressed={expanded}
        onPressedChange={(pressed) => ctrl?.setCollapsed(!pressed)}
        title={`toggle("${panelId}")`}
        className="h-7 min-w-0 flex-1 cursor-pointer justify-start gap-2 px-2 text-left text-xs"
      >
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full ",
            expanded ? "bg-primary" : "bg-muted-foreground/40",
          )}
        />
        {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" />}
        <span className="truncate font-medium">{label}</span>
        <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
          {readout}
        </span>
      </Toggle>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                expanded
                  ? ctrl?.collapse({ transition: "none" })
                  : ctrl?.expand({ transition: "none" })
              }
              aria-label={`${expanded ? "Collapse" : "Expand"} ${label} immediately`}
              className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
            />
          }
        >
          <Zap className="size-3" />
        </TooltipTrigger>
        {/* Tooltips sit outside the dock — anchored past the edge
          nearest their trigger so they never cover other rows. */}
        <TooltipContent side="right" sideOffset={10}>
          <span className="font-mono">
            {expanded ? "collapse" : "expand"}({'{ transition: "none" }'})
          </span>{" "}
          — instant, no animation
        </TooltipContent>
      </Tooltip>
    </Item>
  );
}

/** Lights up while the layout is pointer-dragging / container-resizing. */
function ActivityFooter() {
  const { isPointerDragging, isContainerResizing } = usePanelInteractionState();
  return (
    <div className="mt-0.5 flex items-center justify-between border-t border-border/70 px-2 pb-1 pt-1.5 font-mono text-[10px] leading-none">
      <span
        className={cn(
          "",
          isPointerDragging ? "text-primary" : "text-muted-foreground/60",
        )}
      >
        dragging
      </span>
      <span
        className={cn(
          "",
          isContainerResizing ? "text-primary" : "text-muted-foreground/60",
        )}
      >
        resizing
      </span>
    </div>
  );
}
