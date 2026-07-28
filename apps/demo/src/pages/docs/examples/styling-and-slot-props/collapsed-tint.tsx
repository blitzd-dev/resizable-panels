import {
  Panel,
  type PanelApi,
  PanelGroup,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { useRef } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Button } from "@/components/ui/button";

export default function CollapsedTint() {
  const panel = useRef<PanelApi>(null);

  return (
    <>
      <DemoControls>
        <Button
          variant="outline"
          size="sm"
          onClick={() => panel.current?.toggle()}
        >
          Toggle
        </Button>
      </DemoControls>

      <PanelGroup orientation="horizontal">
        <Panel
          apiRef={panel}
          side="start"
          defaultSize={220}
          minSize={180}
          collapsedSize={56}
          resizableWhenCollapsed
          // The root carries data-state — react to the panel's OWN state with
          // data-[state=collapsed]; descendants use the in-data-* ancestor form.
          className="bg-background/30 transition-colors data-[state=collapsed]:bg-primary/10"
        >
          <div className="flex h-full flex-col gap-2 p-2 text-sm">
            {/* 8px pad (p-2) + 8px row (px-2) + 24px icon box centers the dot
                in the 56px rail by geometry — no justify-center jump. */}
            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className="flex size-6 shrink-0 items-center justify-center">
                <span className="size-2 rounded-full bg-muted-foreground transition-colors in-data-[state=collapsed]:bg-primary" />
              </span>
              <span className="font-medium text-foreground in-data-[state=collapsed]:hidden">
                Inspector
              </span>
            </div>
            <p className="px-2 text-muted-foreground in-data-[state=collapsed]:hidden">
              The panel tints, the status dot recolors, and the label hides —
              all keyed off data-state, no collapse tracking in React.
            </p>
          </div>
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={160}>
          <DemoPanel label="Main content" muted />
        </Panel>
      </PanelGroup>
    </>
  );
}
