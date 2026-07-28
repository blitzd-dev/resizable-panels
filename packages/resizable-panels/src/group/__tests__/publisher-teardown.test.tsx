// @vitest-environment jsdom
// Protected contract (R-30): unmounting a group emits NOTHING. During
// teardown, child panels unregister before the group's publisher effect is
// cleaned up; the store notification schedules the publisher's coalesced
// microtask, which — without a cancel — drains after teardown, observes the
// empty registry, and emits `{}` with the fallback `set-value`/`api`
// attribution. Consumers mirroring onValueChange into storage would clobber
// their saved layout with `{}` on every remount.
//
// The guard is instance-scoped, not "registry became smaller": unmounting
// ONE identified panel while the group lives must still emit the §2
// membership change (`children`/`system`) with the surviving panels, and a
// StrictMode-style cancel-then-resubscribe must not silence the group.
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Panel } from "../../panel/panel";
import { PanelProvider } from "../../provider/panel-provider";
import type {
  PanelGroupValue,
  PanelGroupValueChangeDetails,
} from "../../types";
import { PanelGroup } from "../panel-group";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(async () => root.unmount());
  }
  document.body.innerHTML = "";
});

async function render(element: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(element);
  });
  return { container, root };
}

/** Let the publisher's rAF-scheduled initialization (and any frame-timed
 * ledger windows) run before the interaction under test. */
async function settleFrame() {
  await act(async () => {
    await new Promise((resolve) => {
      requestAnimationFrame(() => resolve(null));
    });
  });
}

/** Two identified docked panels around an anonymous peer; `showRight`
 * removes one identified panel while the group stays mounted. */
function App({
  showRight,
  onValueChange,
}: {
  showRight: boolean;
  onValueChange: (
    value: PanelGroupValue,
    details: PanelGroupValueChangeDetails,
  ) => void;
}) {
  return (
    <PanelProvider>
      <PanelGroup
        orientation="horizontal"
        groupId="g"
        onValueChange={onValueChange}
      >
        <Panel
          side="start"
          panelId="left"
          defaultSize={200}
          minSize={0}
          maxSize={1000}
        />
        <Panel />
        {showRight ? (
          <Panel
            side="end"
            panelId="right"
            defaultSize={150}
            minSize={0}
            maxSize={1000}
          />
        ) : null}
      </PanelGroup>
    </PanelProvider>
  );
}

describe("group teardown never emits onValueChange (R-30)", () => {
  it("unmounting the group emits nothing — no empty value, no fabricated attribution", async () => {
    const onValueChange = vi.fn();
    const { root } = await render(
      <App showRight={true} onValueChange={onValueChange} />,
    );
    await settleFrame();
    const callsBeforeUnmount = onValueChange.mock.calls.length;

    await act(async () => root.unmount());
    // The leaked pass is a microtask queued during teardown; give it every
    // chance to drain (act drains microtasks, the timeout covers jsdom's
    // timer-based rAF) before asserting silence.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const emptyEmissions = onValueChange.mock.calls.filter(
      ([value]) => Object.keys(value as object).length === 0,
    );
    expect(emptyEmissions).toEqual([]);
    expect(onValueChange.mock.calls.length).toBe(callsBeforeUnmount);
  });

  it("unmounting one identified panel while the group lives still emits children/system with the survivors", async () => {
    const onValueChange = vi.fn();
    const { root } = await render(
      <App showRight={true} onValueChange={onValueChange} />,
    );
    await settleFrame();
    const callsBefore = onValueChange.mock.calls.length;

    await act(async () => {
      root.render(<App showRight={false} onValueChange={onValueChange} />);
    });
    await settleFrame();

    const newCalls = onValueChange.mock.calls.slice(callsBefore);
    // Exactly one emission for the membership change: the coalesced store
    // pass must dedup (or be cancelled) against it, never double-report.
    expect(newCalls).toHaveLength(1);
    const [value, details] = newCalls[0];
    expect(Object.keys(value as object)).toEqual(["left"]);
    expect(details).toMatchObject({ reason: "children", trigger: "system" });
  });

  it("StrictMode mount (cancel then immediate re-subscribe) does not silence later membership changes", async () => {
    const onValueChange = vi.fn();
    const { root } = await render(
      <StrictMode>
        <App showRight={true} onValueChange={onValueChange} />
      </StrictMode>,
    );
    await settleFrame();
    const callsBefore = onValueChange.mock.calls.length;

    await act(async () => {
      root.render(
        <StrictMode>
          <App showRight={false} onValueChange={onValueChange} />
        </StrictMode>,
      );
    });
    await settleFrame();

    const newCalls = onValueChange.mock.calls.slice(callsBefore);
    expect(newCalls).toHaveLength(1);
    const [value, details] = newCalls[0];
    expect(Object.keys(value as object)).toEqual(["left"]);
    expect(details).toMatchObject({ reason: "children", trigger: "system" });
    // And the empty-teardown assertion holds under StrictMode too.
    await act(async () => root.unmount());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    const emptyEmissions = onValueChange.mock.calls.filter(
      ([value_]) => Object.keys(value_ as object).length === 0,
    );
    expect(emptyEmissions).toEqual([]);
  });
});
