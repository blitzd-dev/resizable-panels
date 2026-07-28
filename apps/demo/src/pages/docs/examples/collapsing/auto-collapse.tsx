import { Panel, PanelGroup, PanelResizeHandle } from "@blitzd/resizable-panels";
import { DemoPanel } from "@/components/demo-panel";

const items = ["Inbox", "Sent", "Drafts", "Archive"];

export default function AutoCollapse() {
  return (
    <PanelGroup orientation="horizontal">
      <Panel
        side="start"
        defaultSize={220}
        minSize={180}
        collapsible="auto"
        collapsedSize={56}
      >
        {/* data-state flips to "collapsed" the moment the width-driven fold
            lands, so the labels hide and the icons center — no JS. */}
        <nav className="flex h-full flex-col gap-1 overflow-hidden bg-background/30 p-2 text-sm">
          {items.map((item) => (
            <a
              key={item}
              href="#"
              className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-muted"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted font-mono text-xs">
                {item[0]}
              </span>
              <span className="whitespace-nowrap text-muted-foreground in-data-[state=collapsed]:hidden">
                {item}
              </span>
            </a>
          ))}
        </nav>
      </Panel>
      <PanelResizeHandle />
      <Panel minSize={160}>
        <DemoPanel label="Main content" muted />
      </Panel>
    </PanelGroup>
  );
}
