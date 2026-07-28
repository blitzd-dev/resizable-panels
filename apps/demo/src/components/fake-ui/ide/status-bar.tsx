import {
  Bell,
  Check,
  CircleSlash,
  GitBranch,
  TriangleAlert,
} from "lucide-react";

/** VS Code-style status bar — the one deliberately colorful stripe that makes
 *  the shell read as an editor at a glance. */
export function StatusBar() {
  return (
    <div className="flex h-5 shrink-0 items-center gap-3 overflow-hidden bg-sky-600 px-2 text-[9px] font-medium text-white dark:bg-sky-700">
      <span className="flex shrink-0 items-center gap-1">
        <GitBranch className="size-2.5" />
        main
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <CircleSlash className="size-2.5" />0
        <TriangleAlert className="ml-0.5 size-2.5" />0
      </span>
      <span className="ml-auto shrink-0">Ln 7, Col 18</span>
      <span className="hidden shrink-0 @[420px]:inline">UTF-8</span>
      <span className="hidden shrink-0 @[360px]:inline">TypeScript React</span>
      <span className="flex shrink-0 items-center gap-1">
        <Check className="size-2.5" />
        Prettier
      </span>
      <Bell className="size-2.5 shrink-0" />
    </div>
  );
}
