import { cn } from "@/lib/utils";

type DimensionProps = {
  value: number | string;
  unit?: string;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
};

/**
 * Figma-style dimension annotation: a thin line spanning the parent edge
 * with end caps and a pill label showing the measured value.
 */
export function Dimension({
  value,
  unit = "px",
  side = "top",
  className,
}: DimensionProps) {
  const isHorizontal = side === "top" || side === "bottom";
  // Only append unit for numeric values; strings like "flex-1" stand alone.
  const label = typeof value === "number" ? `${value}${unit}` : `${value}`;

  if (isHorizontal) {
    return (
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 flex items-center text-primary",
          side === "top" ? "top-2" : "bottom-2",
          className,
        )}
      >
        <div className="h-2 w-px bg-primary" />
        <div className="h-px flex-1 bg-primary" />
        <div className="mx-1 rounded-sm bg-primary px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-primary-foreground">
          {label}
        </div>
        <div className="h-px flex-1 bg-primary" />
        <div className="h-2 w-px bg-primary" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-y-0 flex flex-col items-center text-primary",
        side === "left" ? "left-2" : "right-2",
        className,
      )}
    >
      <div className="h-px w-2 bg-primary" />
      <div className="w-px flex-1 bg-primary" />
      <div className="my-1 rounded-sm bg-primary px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-primary-foreground">
        {label}
      </div>
      <div className="w-px flex-1 bg-primary" />
      <div className="h-px w-2 bg-primary" />
    </div>
  );
}
