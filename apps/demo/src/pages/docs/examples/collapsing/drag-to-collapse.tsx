import {
  Panel,
  type PanelCollapseBelowBehavior,
  PanelGroup,
  PanelResizeHandle,
} from "@blitzd/resizable-panels";
import { DemoPanel } from "@/components/demo-panel";

const rows: { behavior: PanelCollapseBelowBehavior; label: string }[] = [
  { behavior: "animated", label: 'collapseBelowBehavior="animated"' },
  { behavior: "instant", label: 'collapseBelowBehavior="instant"' },
];

export default function DragToCollapse() {
  return (
    <div className="flex h-full w-full flex-col gap-3">
      {rows.map((row) => (
        <div key={row.behavior} className="flex min-h-0 flex-1 flex-col gap-1">
          <span className="font-mono text-xs text-muted-foreground">
            {row.label}
          </span>
          <div className="min-h-0 flex-1">
            <PanelGroup orientation="horizontal">
              <Panel
                side="start"
                defaultSize={160}
                minSize={120}
                collapsedSize={0}
                collapseBelow={90}
                collapseBelowHysteresis={24}
                collapseBelowBehavior={row.behavior}
              >
                <DemoPanel label="Drag me shut" />
              </Panel>
              <PanelResizeHandle />
              <Panel minSize={120}>
                <DemoPanel label="Main content" muted />
              </Panel>
            </PanelGroup>
          </div>
        </div>
      ))}
    </div>
  );
}
