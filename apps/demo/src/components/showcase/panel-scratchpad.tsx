import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type ConfigEntry, ConfigList } from "./config-list";

/**
 * The content a responsive side panel carries. It is mounted ONCE and
 * reparented between the inline panel and the sheet (see
 * `useReparentableContent`), so the note's DOM value and the counter's React
 * state persist across the swap — the "content state survives" guarantee. The
 * scrollable log demonstrates scroll position surviving too.
 */
export function PanelScratchpad({
  id,
  title,
  icon,
  entries,
}: {
  id: string;
  title: string;
  icon?: ReactNode;
  entries: ConfigEntry[];
}) {
  const [count, setCount] = useState(0);
  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        {icon}
        {title}
      </div>
      <ConfigList title="props" entries={entries} />

      <div className="space-y-2 rounded-lg border border-border bg-background/60 p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          scratch — survives the swap
        </div>
        <Input
          data-testid={`draft-${id}`}
          placeholder="Type a note, then resize…"
          className="h-8 text-xs"
        />
        <div className="flex items-center justify-between gap-3">
          <span
            data-testid={`counter-${id}`}
            className="font-mono text-2xl tabular-nums"
          >
            {count}
          </span>
          <Button
            variant="secondary"
            size="xs"
            aria-label={`Increment ${title} counter`}
            onClick={() => setCount((value) => value + 1)}
          >
            +1
          </Button>
        </div>
      </div>

      <div
        data-testid={`scroll-${id}`}
        className="mt-auto max-h-40 overflow-auto rounded-lg border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground"
      >
        {Array.from({ length: 30 }, (_, line) => (
          <p key={line} className="leading-6">
            log entry {line}
          </p>
        ))}
      </div>
    </div>
  );
}
