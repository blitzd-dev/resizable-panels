import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The standard filler for docs example panels: a centered label on the
 * shared translucent surface. One component instead of a copy-pasted div
 * per example, so every demo panel looks identical.
 */
export function DemoPanel({
  label,
  muted = false,
  className,
  children,
}: {
  label?: ReactNode;
  /** Muted secondary text — use for "Main content"-style filler. */
  muted?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-1 bg-background/30 text-sm",
        muted ? "text-muted-foreground" : "font-medium text-foreground",
        className,
      )}
    >
      {label}
      {children}
    </div>
  );
}
