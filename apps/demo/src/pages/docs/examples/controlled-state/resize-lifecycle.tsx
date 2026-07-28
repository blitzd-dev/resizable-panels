import type {
  PanelResizeEndEvent,
  PanelResizeStartEvent,
} from "@blitzd/resizable-panels";
import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { useRef, useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Button } from "@/components/ui/button";

type LogEntry = { id: number; text: string };

export default function ResizeLifecycle() {
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
          defaultValue={{ a: { size: 240 } }}
          // Fires once when the drag truly begins (first move past threshold).
          onResizeStart={(e: PanelResizeStartEvent) =>
            push(`start · handle=${e.handleId ?? "—"}`)
          }
          // Fires exactly once when the session ends — cancel paths included.
          onResizeEnd={(e: PanelResizeEndEvent) =>
            push(
              `end · canceled=${e.canceled} · a ` +
                `${Math.round(e.initialValue.a?.size ?? 0)} → ` +
                `${Math.round(e.value.a?.size ?? 0)}px`,
            )
          }
        >
          <Panel panelId="a" minSize={120}>
            <DemoPanel label="a" />
          </Panel>
          <PanelResizeHandle handleId="seam" />
          <Panel minSize={120}>
            <DemoPanel
              label="drag then release, or drag then Escape to cancel; arrow keys fire no lifecycle"
              muted
            />
          </Panel>
        </PanelGroup>
      </div>

      <ul className="min-h-[6rem] shrink-0 rounded-md border border-border bg-background p-2 font-mono text-xs text-muted-foreground">
        {log.length === 0 && <li>no events yet — drag the seam above</li>}
        {log.map((entry) => (
          <li key={entry.id}>{entry.text}</li>
        ))}
      </ul>
    </div>
  );
}
