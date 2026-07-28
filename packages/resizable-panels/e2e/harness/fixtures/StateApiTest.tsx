import {
  Panel,
  type PanelApi,
  PanelGroup,
  type PanelGroupApi,
  type PanelGroupValue,
  PanelProvider,
  PanelResizeHandle,
  type PanelStorage,
} from "@blitzd/resizable-panels";
import { useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    /** Set by the `?controlled&persist` variant: counts every adapter call
     *  so the spec can prove persistence neither reads nor writes when the
     *  group is controlled. */
    __stateApiPersistenceCalls?: { get: number; set: number };
  }
}

const DEFAULT_VALUE: PanelGroupValue = {
  left: { size: 260, collapsed: false },
  main: { size: 940 },
};

const APPLIED_VALUE: PanelGroupValue = {
  left: { size: 420, collapsed: false },
  main: { size: 780 },
};

function valuesEqual(a: PanelGroupValue, b: PanelGroupValue): boolean {
  const aIds = Object.keys(a);
  const bIds = Object.keys(b);
  if (aIds.length !== bIds.length) return false;
  for (const id of aIds) {
    const left = Object.hasOwn(a, id) ? a[id] : undefined;
    const right = Object.hasOwn(b, id) ? b[id] : undefined;
    if (
      !left ||
      !right ||
      left.size !== right.size ||
      left.collapsed !== right.collapsed
    ) {
      return false;
    }
  }
  return true;
}

export default function StateApiTest() {
  const params = new URLSearchParams(window.location.search);
  const asyncStorage = params.has("async-storage");
  const controlled = params.has("controlled");
  const acceptControlledChanges = params.has("accept-controlled-changes");
  // Deliberately combines controlled `value` with `persistence` — the two
  // are mutually exclusive, so the library must neither read nor write the
  // counting adapter (and warn once in dev).
  const persistControlled = params.has("persist");
  const [value, setValue] = useState<PanelGroupValue>(DEFAULT_VALUE);
  const groupRef = useRef<PanelGroupApi>(null);
  const leftRef = useRef<PanelApi>(null);
  const eventsRef = useRef<HTMLDivElement>(null);
  const counts = useRef({ value: 0, start: 0, end: 0, collapse: 0 });
  // Tracks previousValue chaining inside a pointer transaction: every
  // onValueChange's previousValue must equal the immediately prior emitted
  // value (the transaction-start value for the first change).
  const lastEmittedRef = useRef<PanelGroupValue | null>(null);
  const chainViolationsRef = useRef(0);
  // R-04 invariant probe: by the time onResizeEnd fires, its value must
  // already have been emitted — event.value === the LAST onValueChange
  // value at that instant. Unlike lastEmittedRef (reset per transaction),
  // this ref survives across events so the end handler can compare.
  const lastValueRef = useRef<PanelGroupValue | null>(null);
  const endMismatchRef = useRef(0);

  const record = (key: keyof typeof counts.current) => {
    counts.current[key] += 1;
    if (eventsRef.current) {
      eventsRef.current.dataset[key] = String(counts.current[key]);
    }
  };

  const storage = useMemo<PanelStorage | undefined>(() => {
    if (asyncStorage) {
      return {
        getItem: async () =>
          JSON.stringify({
            version: 1,
            orientation: "horizontal",
            panels: {
              left: { size: 360, collapsed: false },
              main: { size: 840 },
            },
          }),
        setItem: async () => {},
      };
    }
    if (persistControlled) {
      window.__stateApiPersistenceCalls = { get: 0, set: 0 };
      return {
        getItem: () => {
          window.__stateApiPersistenceCalls!.get += 1;
          return null;
        },
        setItem: () => {
          window.__stateApiPersistenceCalls!.set += 1;
        },
      };
    }
    return undefined;
  }, [asyncStorage, persistControlled]);

  // `defaultValue` is only the SSR/first-paint fallback: a valid restored
  // value must override it after mount, so the async-storage variant keeps
  // it to prove restoration wins.
  const stateProps = controlled ? { value } : { defaultValue: DEFAULT_VALUE };

  const persistence =
    asyncStorage || persistControlled
      ? {
          key: asyncStorage ? "async-state-api" : "controlled-state-api",
          storage,
        }
      : undefined;

  return (
    <PanelProvider>
      <div className="fixture-root">
        <PanelGroup
          apiRef={groupRef}
          orientation="horizontal"
          {...stateProps}
          persistence={persistence}
          onResizeStart={(event) => {
            record("start");
            lastEmittedRef.current = event.value;
            if (eventsRef.current) {
              eventsRef.current.dataset.handle = event.handleId ?? "";
              eventsRef.current.dataset.startValue = JSON.stringify(
                event.value,
              );
            }
          }}
          onResizeEnd={(event) => {
            record("end");
            lastEmittedRef.current = null;
            // R-04: a session may not end with its final value unemitted —
            // the end value must equal the last emitted value RIGHT NOW,
            // not after some later microtask delivers it.
            if (
              !lastValueRef.current ||
              !valuesEqual(event.value, lastValueRef.current)
            ) {
              endMismatchRef.current += 1;
            }
            if (eventsRef.current) {
              eventsRef.current.dataset.endMismatch = String(
                endMismatchRef.current,
              );
              eventsRef.current.dataset.handle = event.handleId ?? "";
              eventsRef.current.dataset.endInitial = JSON.stringify(
                event.initialValue,
              );
              eventsRef.current.dataset.endValue = JSON.stringify(event.value);
              eventsRef.current.dataset.endCanceled = String(event.canceled);
            }
          }}
          onValueChange={(nextValue, details) => {
            record("value");
            lastValueRef.current = nextValue;
            if (
              nextValue.left?.collapsed !==
              details.previousValue.left?.collapsed
            ) {
              record("collapse");
            }
            if (lastEmittedRef.current) {
              if (!valuesEqual(details.previousValue, lastEmittedRef.current)) {
                chainViolationsRef.current += 1;
              }
              lastEmittedRef.current = nextValue;
            }
            if (eventsRef.current) {
              eventsRef.current.dataset.log = `${
                eventsRef.current.dataset.log ?? ""
              }${details.reason}:${details.trigger},`;
              eventsRef.current.dataset.handle = details.handleId ?? "";
              eventsRef.current.dataset.reason = details.reason;
              eventsRef.current.dataset.trigger = details.trigger;
              eventsRef.current.dataset.eventValue = JSON.stringify(nextValue);
              eventsRef.current.dataset.previousValue = JSON.stringify(
                details.previousValue,
              );
              eventsRef.current.dataset.chainViolations = String(
                chainViolationsRef.current,
              );
            }
            if (controlled && acceptControlledChanges) {
              setValue(nextValue);
            }
          }}
        >
          <Panel
            apiRef={leftRef}
            panelId="left"
            side="start"
            defaultSize={300}
            minSize={100}
            maxSize={500}
          >
            left
          </Panel>
          <PanelResizeHandle
            handleId="primary-handle"
            data-testid="state-handle"
          />
          <Panel panelId="main" minSize={100}>
            main
          </Panel>
        </PanelGroup>
        <div className="toolbar-overlay">
          <div className="toolbar">
            <button
              type="button"
              data-testid="read-layout"
              onClick={(event) => {
                event.currentTarget.dataset.layout = JSON.stringify(
                  groupRef.current?.getValue(),
                );
              }}
            >
              read
            </button>
            <button
              type="button"
              data-testid="read-panel"
              onClick={(event) => {
                event.currentTarget.dataset.preferred = JSON.stringify(
                  leftRef.current?.getSize(),
                );
                event.currentTarget.dataset.rendered = JSON.stringify(
                  leftRef.current?.getRenderedSize(),
                );
              }}
            >
              read panel
            </button>
            <button
              type="button"
              data-testid="set-layout"
              onClick={() => groupRef.current?.setValue(APPLIED_VALUE)}
            >
              set value
            </button>
            <button
              type="button"
              data-testid="reset-layout"
              onClick={() => groupRef.current?.resetValue()}
            >
              reset
            </button>
            <button
              type="button"
              data-testid="panel-resize"
              onClick={() => leftRef.current?.setSize(380)}
            >
              panel resize
            </button>
            <button
              type="button"
              data-testid="panel-collapse"
              onClick={() => leftRef.current?.collapse()}
            >
              collapse
            </button>
            <button
              type="button"
              data-testid="panel-expand"
              onClick={() => leftRef.current?.expand()}
            >
              expand
            </button>
            <button
              type="button"
              data-testid="controlled-layout"
              onClick={() => setValue(APPLIED_VALUE)}
            >
              controlled
            </button>
          </div>
        </div>
        <div
          ref={eventsRef}
          data-testid="state-events"
          data-value="0"
          data-start="0"
          data-end="0"
          data-collapse="0"
          data-handle=""
          data-reason=""
          data-trigger=""
          data-start-value=""
          data-end-initial=""
          data-end-value=""
          data-end-canceled=""
          data-end-mismatch="0"
          data-event-value=""
          data-previous-value=""
          data-chain-violations="0"
          data-log=""
        />
      </div>
    </PanelProvider>
  );
}
