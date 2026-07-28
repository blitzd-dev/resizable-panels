import { cn } from "@/lib/utils";

export type ConfigEntry = {
  label: string;
  value: string | number | boolean;
  hint?: string;
};

export function ConfigList({
  title,
  entries,
  className,
}: {
  title?: string;
  entries: ConfigEntry[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {title && (
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        {entries.map((e) => (
          <div key={e.label} className="contents">
            <dt className="text-muted-foreground">{e.label}</dt>
            <dd className="font-mono text-foreground">
              {formatValue(e.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function formatValue(v: string | number | boolean) {
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return Number.isInteger(v) ? `${v}` : v.toFixed(0);
  return v;
}
