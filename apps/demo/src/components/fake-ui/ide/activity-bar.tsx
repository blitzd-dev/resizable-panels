import {
  Blocks,
  Files,
  GitBranch,
  Play,
  Search,
  Settings,
  UserCircle2,
} from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

type ActivityItem = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  badge?: string;
};

const ITEMS: ActivityItem[] = [
  { icon: Files, label: "Explorer", active: true },
  { icon: Search, label: "Search" },
  { icon: GitBranch, label: "Source control", badge: "2" },
  { icon: Play, label: "Run and debug" },
  { icon: Blocks, label: "Extensions" },
];

/** VS Code-style activity rail. Pure chrome — sits outside the PanelGroup. */
export function ActivityBar() {
  return (
    <div className="flex w-9 shrink-0 flex-col items-center border-r border-border bg-card">
      {ITEMS.map((item) => (
        <ActivityIcon key={item.label} {...item} />
      ))}
      <div className="mt-auto flex flex-col items-center pb-1">
        <ActivityIcon icon={UserCircle2} label="Accounts" />
        <ActivityIcon icon={Settings} label="Settings" />
      </div>
    </div>
  );
}

function ActivityIcon({ icon: Icon, label, active, badge }: ActivityItem) {
  return (
    <div
      title={label}
      className={cn(
        "relative flex h-9 w-full items-center justify-center",
        active
          ? "text-foreground"
          : "text-muted-foreground/60 hover:text-foreground/80",
      )}
    >
      {active ? (
        <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-r bg-foreground" />
      ) : null}
      <Icon className="size-4" />
      {badge ? (
        <span className="absolute right-1 top-1 rounded-full bg-sky-600 px-[3px] text-[7px] font-semibold leading-[10px] text-white">
          {badge}
        </span>
      ) : null}
    </div>
  );
}
