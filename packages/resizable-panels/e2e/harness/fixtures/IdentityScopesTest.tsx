import {
  Panel,
  PanelGroup,
  PanelProvider,
  usePanelActions,
  usePanelControls,
  usePanelRegistry,
} from "@blitzd/resizable-panels";
import { useState } from "react";

const LEFT_SHARED = { groupId: "left-group", panelId: "shared" } as const;
const RIGHT_SHARED = { groupId: "right-group", panelId: "shared" } as const;

/**
 * Exercises the exact-locator identity model:
 * - the same group-local `panelId` mounted in two groups resolves per group;
 * - lookup never retargets when the addressed group unmounts;
 * - a native DOM `id` alone does not opt a panel into lookup/registry;
 * - changing a group's `groupId` re-resolves locator subscriptions.
 */
function RegistryProbe() {
  const actions = usePanelActions();
  const left = usePanelControls(LEFT_SHARED);
  const right = usePanelControls(RIGHT_SHARED);
  const leftRegistry = usePanelRegistry("left-group");

  return (
    <div className="toolbar-overlay">
      <div className="toolbar">
        <output
          data-testid="identity-registry"
          data-left-size={left ? String(Math.round(left.size)) : "missing"}
          data-right-size={right ? String(Math.round(right.size)) : "missing"}
          data-left-keys={JSON.stringify(Object.keys(leftRegistry))}
        />
        <button
          type="button"
          data-testid="resize-scoped"
          onClick={() => {
            actions.setSize(LEFT_SHARED, 240);
            actions.setSize(RIGHT_SHARED, 340);
          }}
        >
          resize scoped
        </button>
        <button
          type="button"
          data-testid="probe-right-actions"
          onClick={(event) => {
            event.currentTarget.dataset.result = JSON.stringify(
              actions.setSize(RIGHT_SHARED, 300),
            );
          }}
        >
          probe right
        </button>
        <button
          type="button"
          data-testid="probe-dom-only-actions"
          onClick={(event) => {
            event.currentTarget.dataset.result = JSON.stringify(
              actions.setSize(
                { groupId: "left-group", panelId: "dom-only-panel" },
                200,
              ),
            );
          }}
        >
          probe dom only
        </button>
      </div>
    </div>
  );
}

function DynamicProbe() {
  const alpha = usePanelControls({
    groupId: "alpha-group",
    panelId: "dynamic",
  });
  const beta = usePanelControls({ groupId: "beta-group", panelId: "dynamic" });
  return (
    <output
      data-testid="dynamic-probe"
      data-alpha={alpha ? String(Math.round(alpha.size)) : "missing"}
      data-beta={beta ? String(Math.round(beta.size)) : "missing"}
    />
  );
}

export default function IdentityScopesTest() {
  const [showRightGroup, setShowRightGroup] = useState(true);
  const [dynamicGroupId, setDynamicGroupId] = useState("alpha-group");

  return (
    <PanelProvider>
      <RegistryProbe />
      <DynamicProbe />
      <button
        type="button"
        data-testid="unmount-right-group"
        onClick={() => setShowRightGroup(false)}
      >
        unmount right
      </button>
      <button
        type="button"
        data-testid="rename-dynamic-group"
        onClick={() => setDynamicGroupId("beta-group")}
      >
        rename dynamic group
      </button>
      <div className="fixture-root" data-testid="identity-scopes-root">
        <div style={{ height: "33%" }}>
          <PanelGroup orientation="horizontal" groupId="left-group">
            <Panel
              panelId="shared"
              side="start"
              defaultSize={300}
              minSize={100}
            >
              left shared
            </Panel>
            {/* Native `id` only names the DOM node — this panel must stay
                absent from the left-group registry and unaddressable. */}
            <Panel id="dom-only-panel" defaultSize={500} minSize={100}>
              dom-only panel
            </Panel>
          </PanelGroup>
        </div>
        <div style={{ height: "33%" }}>
          {showRightGroup ? (
            <PanelGroup orientation="horizontal" groupId="right-group">
              <Panel
                panelId="shared"
                side="start"
                defaultSize={280}
                minSize={100}
              >
                right shared
              </Panel>
              <Panel defaultSize={520} minSize={100}>
                intentionally anonymous
              </Panel>
            </PanelGroup>
          ) : (
            <div data-testid="right-group-placeholder">right group gone</div>
          )}
        </div>
        <div style={{ height: "33%" }}>
          <PanelGroup orientation="horizontal" groupId={dynamicGroupId}>
            <Panel
              panelId="dynamic"
              side="start"
              defaultSize={220}
              minSize={100}
            >
              dynamic
            </Panel>
            <Panel minSize={100}>dynamic peer</Panel>
          </PanelGroup>
        </div>
      </div>
    </PanelProvider>
  );
}
