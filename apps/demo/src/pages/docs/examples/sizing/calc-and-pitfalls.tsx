import {
  Panel,
  type PanelApi,
  PanelGroup,
  PanelResizeHandle,
  type SizeSpec,
} from "@blitzd/resizable-panels";
import { useRef, useState } from "react";
import { DemoControls } from "@/components/demo-controls";
import { DemoPanel } from "@/components/demo-panel";
import { Button } from "@/components/ui/button";

const candidates: { label: string; spec: SizeSpec; valid: boolean }[] = [
  { label: "240", spec: 240, valid: true }, // number → pixels
  { label: '"33%"', spec: "33%", valid: true }, // % of the container
  { label: '"calc(50% - 24px)"', spec: "calc(50% - 24px)", valid: true },
  { label: '"calc(50% -24px)"', spec: "calc(50% -24px)", valid: false }, // no space after -
  { label: '"calc(50% * 2)"', spec: "calc(50% * 2)", valid: false }, // * not allowed
  { label: '"240"', spec: "240", valid: false }, // bare numeric string, no unit
];

export default function CalcAndPitfalls() {
  const api = useRef<PanelApi>(null);
  const [status, setStatus] = useState("Click a spec to call setSize().");

  function apply(spec: SizeSpec) {
    const r = api.current?.setSize(spec);
    if (!r) return;
    if (r.applied) {
      const bound = r.constrained ? " (constrained to bounds)" : "";
      setStatus(`applied → ${Math.round(r.value)}px${bound}`);
    } else if (r.reason === "unchanged") {
      setStatus(`unchanged → still ${Math.round(r.value)}px`);
    } else {
      setStatus(`rejected → reason: "${r.reason}"`);
    }
  }

  return (
    <>
      <DemoControls>
        {candidates.map((c) => (
          <Button
            key={c.label}
            variant={c.valid ? "outline" : "destructive"}
            size="sm"
            className="font-mono"
            onClick={() => apply(c.spec)}
          >
            {c.label}
          </Button>
        ))}
        <span className="basis-full font-mono text-xs text-muted-foreground">
          {status}
        </span>
      </DemoControls>

      <PanelGroup orientation="horizontal">
        <Panel
          apiRef={api}
          side="start"
          defaultSize="calc(50% - 24px)"
          minSize={0}
          collapsible={false}
        >
          <DemoPanel label="sidebar" />
        </Panel>
        <PanelResizeHandle />
        <Panel>
          <DemoPanel label="content" muted />
        </Panel>
      </PanelGroup>
    </>
  );
}
