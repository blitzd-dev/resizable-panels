import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { DemoPanel } from "@/components/demo-panel";

const rows = [
  { size: 240, label: "240", note: "number → 240px" },
  { size: "33%", label: '"33%"', note: "fraction of the container" },
  { size: "2rem", label: '"2rem"', note: "2 × the root font size" },
] as const;

export default function SizeUnits() {
  return (
    <div className="flex w-full flex-col gap-3">
      {rows.map((row) => (
        <div
          key={row.label}
          className="h-16 w-full overflow-hidden rounded-md border border-border"
        >
          <PanelGroup orientation="horizontal">
            <Panel
              side="start"
              defaultSize={row.size}
              minSize={0}
              collapsible={false}
            >
              <DemoPanel
                label={<span className="font-mono text-xs">{row.label}</span>}
              />
            </Panel>
            <PanelResizeHandle />
            <Panel>
              <DemoPanel
                label={row.note}
                muted
                className="px-2 text-center text-xs"
              />
            </Panel>
          </PanelGroup>
        </div>
      ))}
    </div>
  );
}
