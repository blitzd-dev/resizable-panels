import {
  Panel,
  type PanelActionOptions,
  type PanelActionResult,
  type PanelApi,
  PanelGroup,
  PanelResizeHandle,
  type PanelSizeActionDetails,
} from "@blitzd/resizable-panels";
import { useRef, useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";

// Every action on this demo returns a PanelActionResult; setSize adds the
// size details, collapse carries none, so the shared type widens both.
type Result = PanelActionResult<
  number | boolean,
  Partial<PanelSizeActionDetails>
>;

const arm = (r: Result) =>
  r.applied
    ? "applied change"
    : r.reason === "unchanged"
      ? "unchanged no-op"
      : `rejected: ${r.reason}`;

const TRANSITIONS = ["default", "none"] as const;

const ACTIONS: {
  label: string;
  run: (panel: PanelApi, opts: PanelActionOptions) => Result;
}[] = [
  { label: "setSize(9999)", run: (p, o) => p.setSize(9999, o) },
  { label: "collapse()", run: (p, o) => p.collapse(o) },
  { label: 'setSize("240")', run: (p, o) => p.setSize("240", o) },
];

export default function ReadingResults() {
  const panel = useRef<PanelApi>(null);
  const [transition, setTransition] =
    useState<(typeof TRANSITIONS)[number]>("default");
  const [last, setLast] = useState<{ label: string; r: Result } | null>(null);
  const opts: PanelActionOptions = { transition };

  return (
    <>
      <DemoControls>
        {ACTIONS.map(({ label, run }) => (
          <Button
            key={label}
            variant="outline"
            size="sm"
            onClick={() => {
              if (panel.current)
                setLast({ label, r: run(panel.current, opts) });
            }}
          >
            {label}
          </Button>
        ))}
        <Segmented
          options={TRANSITIONS}
          value={transition}
          onValueChange={setTransition}
          mono
        />
      </DemoControls>

      <PanelGroup orientation="horizontal">
        <Panel
          apiRef={panel}
          side="start"
          defaultSize={240}
          minSize={120}
          maxSize="60%"
        >
          <DemoPanel label="Sidebar" />
        </Panel>
        <PanelResizeHandle />
        <Panel>
          <DemoPanel muted>
            {last ? (
              <div className="max-w-full text-center font-mono text-xs">
                <div className="text-foreground">
                  {last.label} → {arm(last.r)}
                </div>
                <pre className="mt-1 overflow-x-auto text-muted-foreground">
                  {JSON.stringify(last.r)}
                </pre>
              </div>
            ) : (
              "Run an action; press one twice for “unchanged”"
            )}
          </DemoPanel>
        </Panel>
      </PanelGroup>
    </>
  );
}
