import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelActions,
} from "@blitzd/resizable-panels";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Button } from "@/components/ui/button";

// Both locators name a panel called "aside" — only the groupId differs, so
// the groupId is what decides which group a button hits.
const alphaAside = { groupId: "alpha", panelId: "aside" };
const betaAside = { groupId: "beta", panelId: "aside" };

function Controls() {
  const { toggle } = usePanelActions();
  return (
    <DemoControls>
      <Button variant="outline" size="sm" onClick={() => toggle(alphaAside)}>
        Toggle alpha aside
      </Button>
      <Button variant="outline" size="sm" onClick={() => toggle(betaAside)}>
        Toggle beta aside
      </Button>
    </DemoControls>
  );
}

function Group({ groupId, label }: { groupId: string; label: string }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border">
      <PanelGroup groupId={groupId} orientation="horizontal">
        <Panel
          side="start"
          panelId="aside"
          defaultSize={120}
          minSize={100}
          collapsedSize={0}
        >
          <DemoPanel label={`${label} aside`} />
        </Panel>
        <PanelResizeHandle />
        <Panel minSize={120}>
          <DemoPanel label={`groupId="${groupId}"`} muted />
        </Panel>
      </PanelGroup>
    </div>
  );
}

export default function TwoGroupsOneProvider() {
  return (
    <PanelProvider>
      <Controls />
      <div className="flex h-full w-full flex-col gap-2">
        <Group groupId="alpha" label="Alpha" />
        <Group groupId="beta" label="Beta" />
      </div>
    </PanelProvider>
  );
}
