import { usePanelControls } from "@blitzd/resizable-panels";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type ConfigEntry, ConfigList } from "./config-list";
import { Dimension } from "./dimension";

type PanelInspectorProps = {
  groupId: string;
  panelId: string;
  title: string;
  icon?: React.ReactNode;
  entries: ConfigEntry[];
  dimensionSide?: "top" | "bottom" | "left" | "right";
  children?: ReactNode;
};

export function PanelInspector({
  groupId,
  panelId,
  title,
  icon,
  entries,
  dimensionSide = "top",
  children,
}: PanelInspectorProps) {
  const ctrl = usePanelControls({ groupId, panelId });
  if (!ctrl) return null;

  const isHorizontal = dimensionSide === "top" || dimensionSide === "bottom";

  return (
    <div className="relative h-full w-full">
      <Dimension value={Math.round(ctrl.renderedSize)} side={dimensionSide} />
      <div
        className={cn(
          "flex h-full flex-col gap-4",
          isHorizontal ? "px-5 pt-10 pb-5" : "px-12 py-4",
        )}
      >
        <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          {icon}
          {title}
        </div>
        <ConfigList title="props" entries={entries} />
        {children}
      </div>
    </div>
  );
}
