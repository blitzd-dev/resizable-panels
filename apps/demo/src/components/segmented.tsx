import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/**
 * The one segmented control used across the docs — the Example Preview/Code
 * switch and every enumerated-prop selector. Built on the shadcn ToggleGroup
 * (keyboard navigation and pressed semantics for free), restyled to the
 * bordered-pill look: secondary = active, ghost text = inactive.
 */
export function Segmented<T extends string>({
  options,
  value,
  onValueChange,
  mono = false,
  labels,
}: {
  options: readonly T[];
  value: T;
  onValueChange: (value: T) => void;
  /** Render option labels in the mono font (code-ish values). */
  mono?: boolean;
  /** Optional display label per option; defaults to the option itself. */
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(next: unknown[]) => {
        const pick = next[0];
        // Single-select that can never be emptied: re-clicking the active
        // segment keeps it selected instead of deselecting the group.
        if (typeof pick === "string" && pick !== value) {
          onValueChange(pick as T);
        }
      }}
      spacing={0.5}
      className="rounded-md border border-border p-0.5"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          className={cn(
            // Hover on an unselected segment brightens the TEXT only — the
            // background is reserved for the active segment.
            "h-5 min-w-0 rounded-[5px] px-2 text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-foreground data-pressed:bg-secondary data-pressed:text-secondary-foreground",
            mono && "font-mono",
          )}
        >
          {labels?.[option] ?? option}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
