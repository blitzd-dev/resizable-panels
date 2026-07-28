import {
  Panel,
  PanelGroup,
  type PanelGroupApi,
  PanelProvider,
  PanelResizeHandle,
  type PanelStorage,
  usePanelRegistry,
} from "@blitzd/resizable-panels";
import { useMemo, useRef, useState } from "react";

const SPECIAL_IDS = ["__proto__", "constructor", "prototype"] as const;

function RegistryProbe({
  groupRef,
  removePrimaryConstructor,
  restorePrimaryConstructor,
  removeDuplicateConstructor,
}: {
  groupRef: React.RefObject<PanelGroupApi | null>;
  removePrimaryConstructor: () => void;
  restorePrimaryConstructor: () => void;
  removeDuplicateConstructor: () => void;
}) {
  const primary = usePanelRegistry("special-ids");
  const duplicate = usePanelRegistry("special-ids-duplicate");
  const empty = usePanelRegistry("special-ids-empty");
  const registryKeys = Object.keys(primary);
  // The registry snapshot exposes live control facts, not the declarative
  // config. `constraints.minSize` is deterministic here (80 in the primary
  // group, the peer default 0 in the duplicate) and distinguishes the two
  // groups' panels that share the local panelId "constructor".
  // biome-ignore lint/complexity/useLiteralKeys: bracket lookup selects the string index signature instead of Object.constructor.
  const constructorMinSize = primary["constructor"]?.constraints.minSize;
  // biome-ignore lint/complexity/useLiteralKeys: bracket lookup selects the string index signature instead of Object.constructor.
  const duplicateMinSize = duplicate["constructor"]?.constraints.minSize;

  return (
    <div data-testid="special-id-controls" className="toolbar-overlay">
      <div className="toolbar">
        <output
          data-testid="registry"
          data-keys={JSON.stringify(registryKeys)}
          data-all-own={String(
            SPECIAL_IDS.every((id) => Object.hasOwn(primary, id)),
          )}
          data-empty-own={String(
            Object.hasOwn(primary, "") || Object.hasOwn(empty, ""),
          )}
          data-constructor-min-size={String(constructorMinSize ?? "missing")}
          data-duplicate-constructor-min-size={String(
            duplicateMinSize ?? "missing",
          )}
        />
        <button
          type="button"
          data-testid="read-layout"
          onClick={(event) => {
            event.currentTarget.dataset.layout = JSON.stringify(
              groupRef.current?.getValue() ?? null,
            );
          }}
        >
          read layout
        </button>
        <button
          type="button"
          data-testid="apply-layout"
          onClick={() => {
            groupRef.current?.setValue(
              Object.fromEntries([
                ["__proto__", { size: 220, collapsed: false }],
                ["constructor", { size: 540 }],
                ["prototype", { size: 180, collapsed: false }],
              ]),
            );
          }}
        >
          apply layout
        </button>
        <button
          type="button"
          data-testid="remove-primary-constructor"
          onClick={removePrimaryConstructor}
        >
          remove primary
        </button>
        <button
          type="button"
          data-testid="restore-primary-constructor"
          onClick={restorePrimaryConstructor}
        >
          restore primary
        </button>
        <button
          type="button"
          data-testid="remove-duplicate-constructor"
          onClick={removeDuplicateConstructor}
        >
          remove duplicate
        </button>
      </div>
    </div>
  );
}

export default function SpecialIdsTest() {
  const groupRef = useRef<PanelGroupApi>(null);
  const [showPrimaryConstructor, setShowPrimaryConstructor] = useState(true);
  const [showDuplicateConstructor, setShowDuplicateConstructor] =
    useState(true);
  const [stored, setStored] = useState<string | null>(null);
  const storage = useMemo<PanelStorage>(
    () => ({
      getItem: () => null,
      setItem: (_key, value) => setStored(value),
    }),
    [],
  );

  return (
    <PanelProvider>
      <RegistryProbe
        groupRef={groupRef}
        removePrimaryConstructor={() => setShowPrimaryConstructor(false)}
        restorePrimaryConstructor={() => setShowPrimaryConstructor(true)}
        removeDuplicateConstructor={() => setShowDuplicateConstructor(false)}
      />
      <output data-testid="stored-layout" data-layout={stored ?? ""} />
      <div className="fixture-root" data-testid="special-ids-root">
        <div style={{ height: "60%" }}>
          <PanelGroup
            orientation="horizontal"
            groupId="special-ids"
            apiRef={groupRef}
            persistence={{ key: "special-ids", storage }}
          >
            <Panel
              panelId="__proto__"
              side="start"
              defaultSize={180}
              minSize={80}
              maxSize={400}
            >
              __proto__
            </Panel>
            <PanelResizeHandle />
            {showPrimaryConstructor ? (
              <>
                <Panel
                  panelId="constructor"
                  defaultSize={260}
                  minSize={80}
                  maxSize={800}
                >
                  constructor primary
                </Panel>
                <PanelResizeHandle />
              </>
            ) : null}
            <Panel
              panelId="prototype"
              side="end"
              defaultSize={160}
              minSize={80}
              maxSize={400}
            >
              prototype
            </Panel>
          </PanelGroup>
        </div>
        <div style={{ display: "flex", height: "40%" }}>
          <PanelGroup orientation="horizontal" groupId="special-ids-duplicate">
            {showDuplicateConstructor ? (
              <Panel panelId="constructor" defaultSize={360}>
                constructor duplicate
              </Panel>
            ) : (
              <Panel>duplicate removed</Panel>
            )}
          </PanelGroup>
          <PanelGroup orientation="horizontal" groupId="special-ids-empty">
            <Panel defaultSize={300}>anonymous (no panelId)</Panel>
          </PanelGroup>
        </div>
      </div>
    </PanelProvider>
  );
}
