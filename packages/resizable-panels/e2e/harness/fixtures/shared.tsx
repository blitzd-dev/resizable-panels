import {
  type PanelLocator,
  usePanelActions,
  usePanelControls,
} from "@blitzd/resizable-panels";

/**
 * Shared fixtures for the full-viewport test pages. Playwright specs key on
 * the testids rendered here — `body-<id>`, `readout-<id>`, `toggle-<id>` —
 * so changes must keep those stable. Lookup is locator-keyed, so every
 * consumer names both the group (`groupId`) and the panel (`panelId`).
 */

export function PanelBody({
  groupId,
  label,
  variant = "side",
  uppercase = false,
}: {
  groupId: string;
  label: string;
  variant?: "side" | "grow";
  uppercase?: boolean;
}) {
  return (
    <div
      data-testid={`body-${label}`}
      className={`panel-body${variant === "grow" ? " panel-body--grow" : ""}`}
    >
      <span className={`panel-body-label${uppercase ? " uppercase" : ""}`}>
        {label}
      </span>
      <Readout groupId={groupId} panelId={label} />
    </div>
  );
}

export function Readout({ groupId, panelId }: PanelLocator) {
  const ctrl = usePanelControls({ groupId, panelId });
  if (!ctrl) return null;
  return (
    <span data-testid={`readout-${panelId}`} className="readout">
      {Math.round(ctrl.renderedSize)}px
    </span>
  );
}

function ToolbarToggle({ locator }: { locator: PanelLocator }) {
  const actions = usePanelActions();
  const ctrl = usePanelControls(locator);
  const expanded = ctrl ? !ctrl.collapsed : false;
  return (
    <button
      type="button"
      className="toolbar-toggle"
      data-testid={`toggle-${locator.panelId}`}
      aria-pressed={expanded}
      onClick={() => actions.setCollapsed(locator, expanded)}
    >
      {expanded ? "Collapse" : "Expand"} {locator.panelId}
    </button>
  );
}

/** Fixed overlay with one toggle per docked panel. Tests use these (via
 *  `data-testid="toggle-<panelId>"`) to open/close panels without dragging. */
export function Toolbar({ panels }: { panels: PanelLocator[] }) {
  return (
    <div className="toolbar-overlay">
      <div className="toolbar">
        {panels.map((locator) => (
          <ToolbarToggle
            key={`${locator.groupId}:${locator.panelId}`}
            locator={locator}
          />
        ))}
      </div>
    </div>
  );
}
