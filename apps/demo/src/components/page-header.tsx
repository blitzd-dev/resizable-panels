import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-10", className)}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {eyebrow}
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
      {children != null && (
        <p className="mt-2 text-sm text-muted-foreground">{children}</p>
      )}
    </header>
  );
}
