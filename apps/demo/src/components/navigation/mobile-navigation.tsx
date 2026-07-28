import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function MobileNavSection({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-4 border-t border-border pt-3", className)}>
      <h2 className="px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </h2>
      {children}
    </section>
  );
}

export function MobileNavList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <ul className={cn("flex flex-col", className)}>{children}</ul>;
}

export function MobileNavLink({
  to,
  active,
  nested = false,
  children,
  className,
}: {
  to: string;
  active: boolean;
  nested?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center rounded-md py-2 pr-3 text-sm",
        nested ? "pl-6" : "px-3 font-medium",
        active
          ? "bg-primary/10 text-primary"
          : nested
            ? "text-muted-foreground hover:bg-accent hover:text-foreground"
            : "text-foreground hover:bg-accent",
        className,
      )}
    >
      {children}
    </Link>
  );
}
