import type {
  PanelChangeDetails,
  PanelGroupValueChangeDetails,
} from "@blitzd/resizable-panels";
import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { useRef, useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Button } from "@/components/ui/button";

type LogEntry = { id: number; text: string };

export default function ValueChangeMetadata() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const nextId = useRef(0);

  // Monotonic id so keys stay stable after the log fills to six entries.
  const push = (text: string) =>
    setLog((prev) => [{ id: nextId.current++, text }, ...prev].slice(0, 6));

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <DemoControls>
        <Button variant="outline" size="sm" onClick={() => setLog([])}>
          Clear log
        </Button>
      </DemoControls>

      <div className="min-h-0 flex-1">
        <PanelGroup
          orientation="horizontal"
          defaultValue={{ side: { size: 200 } }}
          // Group grain: PanelGroupValueChangeDetails carries reason + trigger.
          onValueChange={(_value, d: PanelGroupValueChangeDetails) =>
            push(`group · reason=${d.reason} trigger=${d.trigger}`)
          }
        >
          <Panel
            panelId="side"
            collapsible
            minSize={120}
            // Per-panel grain: PanelChangeDetails is just reason + trigger.
            onSizeChange={(size: number, d: PanelChangeDetails) =>
              push(`side · size=${Math.round(size)}px (${d.trigger})`)
            }
            onCollapsedChange={(collapsed: boolean, d: PanelChangeDetails) =>
              push(`side · collapsed=${collapsed} reason=${d.reason}`)
            }
          >
            <DemoPanel label="side" />
          </Panel>
          <PanelResizeHandle handleId="side-seam" />
          <Panel minSize={120}>
            <DemoPanel
              label="drag the seam, or focus it and press Enter to collapse"
              muted
            />
          </Panel>
        </PanelGroup>
      </div>

      <ul className="min-h-[6rem] shrink-0 rounded-md border border-border bg-background p-2 font-mono text-xs text-muted-foreground">
        {log.length === 0 && <li>no events yet — interact above</li>}
        {log.map((entry) => (
          <li key={entry.id}>{entry.text}</li>
        ))}
      </ul>
    </div>
  );
}
