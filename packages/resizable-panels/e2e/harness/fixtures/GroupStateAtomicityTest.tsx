import {
  Panel,
  PanelGroup,
  PanelProvider,
  PanelResizeHandle,
  usePanelGroupState,
} from "@blitzd/resizable-panels";
import { memo, Profiler, useEffect, useRef, useState } from "react";

/**
 * Snapshot-atomicity + positive-locality fixture (R-36, P1 + P2). A Σmax-bound
 * group (peers capped so the container always has unallocated space) is swept
 * across a range by an rAF loop. A memo'd consumer — isolated from the width
 * re-render — records EVERY distinct published snapshot AND counts its own
 * commits. The spec asserts (P1) each snapshot is internally consistent, and
 * (P2) the consumer re-rendered ~once per distinct snapshot (alive AND not
 * amplifying — a dead subscription would record ~1 snapshot and ~0 commits).
 */

const PANEL_MAX = 240;
const SUM_MAX = PANEL_MAX * 2; // 480, no gutter (overlay handle)
const WIDE = 900;
const NARROW = 520;

declare global {
  interface Window {
    __groupStateAtomicity?: {
      samples: { cs: number; un: number; oc: number }[];
      consumerCommits: number;
      done: boolean;
    };
  }
}

function store() {
  window.__groupStateAtomicity ??= {
    samples: [],
    consumerCommits: 0,
    done: false,
  };
  return window.__groupStateAtomicity;
}

// Memo'd so the parent's per-frame width re-render does not commit it: the only
// thing that re-renders this consumer is usePanelGroupState returning a new
// snapshot reference — making its commit count a faithful 1:1 proxy (P2).
const Consumer = memo(function Consumer() {
  const state = usePanelGroupState("atomicity");
  useEffect(() => {
    if (!state?.measured) return;
    store().samples.push({
      cs: state.containerSize,
      un: state.unallocatedPx,
      oc: state.overconstrainedBy,
    });
  }, [state]);
  return (
    <Profiler
      id="atomicity-consumer"
      onRender={() => {
        store().consumerCommits += 1;
      }}
    >
      <div
        data-testid="atomicity-consumer"
        data-cs={state ? String(Math.round(state.containerSize)) : ""}
      />
    </Profiler>
  );
});

export default function GroupStateAtomicityTest() {
  const [width, setWidth] = useState(WIDE);
  const raf = useRef(0);
  useEffect(() => {
    store().done = false;
    // Continuous sweep WIDE → NARROW → WIDE so containerSize changes on many
    // consecutive frames — the regime where a one-commit lag surfaces.
    const steps: number[] = [];
    for (let w = WIDE; w >= NARROW; w -= 8) steps.push(w);
    for (let w = NARROW; w <= WIDE; w += 8) steps.push(w);
    let i = 0;
    const tick = () => {
      if (i >= steps.length) {
        store().done = true;
        return;
      }
      setWidth(steps[i++]);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  return (
    <PanelProvider>
      <div className="fixture-root">
        <Consumer />
        <PanelGroup
          orientation="horizontal"
          groupId="atomicity"
          data-testid="atomicity-group"
          style={{ width, height: 300 }}
        >
          <Panel
            panelId="a"
            defaultSize={PANEL_MAX}
            minSize={80}
            maxSize={PANEL_MAX}
          >
            a
          </Panel>
          <PanelResizeHandle />
          <Panel
            panelId="b"
            defaultSize={PANEL_MAX}
            minSize={80}
            maxSize={PANEL_MAX}
          >
            b
          </Panel>
        </PanelGroup>
      </div>
    </PanelProvider>
  );
}

export { SUM_MAX };
