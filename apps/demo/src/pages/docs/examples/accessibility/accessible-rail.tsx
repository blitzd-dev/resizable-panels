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

const items = [
  { icon: "H", label: "Home", href: "#home" },
  { icon: "R", label: "Reports", href: "#reports" },
];

export default function AccessibleRail() {
  const rail = useRef<PanelApi>(null);

  return (
    <>
      <DemoControls>
        <Button
          variant="outline"
          size="sm"
          onClick={() => rail.current?.toggle()}
        >
          Toggle rail
        </Button>
      </DemoControls>

      <PanelGroup orientation="horizontal">
        <Panel
          apiRef={rail}
          side="start"
          defaultSize={180}
          minSize={140}
          collapsedSize={56}
          resizableWhenCollapsed
        >
          <nav className="flex h-full flex-col gap-1 bg-background/30 p-2 text-sm text-foreground">
            {items.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-muted"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted font-mono text-xs">
                  {item.icon}
                </span>
                <span className="whitespace-nowrap text-muted-foreground in-data-[state=collapsed]:hidden">
                  {item.label}
                </span>
              </a>
            ))}
          </nav>
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={160}>
          <DemoPanel label="Main content" muted />
        </Panel>
        <PanelResizeHandle />
        <Panel
          side="end"
          defaultSize={180}
          minSize={140}
          collapsedSize={0}
          defaultCollapsed
        >
          <DemoPanel label="Hidden sidebar" />
        </Panel>
      </PanelGroup>
    </>
  );
}
