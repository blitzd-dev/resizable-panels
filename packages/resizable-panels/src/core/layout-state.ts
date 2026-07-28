import type {
  PanelGroupLayout,
  PanelGroupOrientation,
  PanelGroupValue,
  PanelLayoutMap,
  PanelLayoutState,
} from "../types.js";

/** Version of the persisted storage document. Independent from the package
 * version; the first released format is 1 and pre-release formats are
 * rejected rather than migrated. */
const PERSISTED_VALUE_VERSION = 1 as const;

/** INTERNAL: build a live topology snapshot. Order is deduplicated and
 * reconciled against the panels map so both stay consistent. */
export function createPanelGroupLayout(
  orientation: PanelGroupOrientation,
  order: readonly string[],
  panels: PanelLayoutMap,
): PanelGroupLayout {
  const panelEntries = new Map(Object.entries(panels));
  const uniqueOrder = [...new Set(order.filter((id) => panelEntries.has(id)))];
  for (const id of panelEntries.keys()) {
    if (!uniqueOrder.includes(id)) uniqueOrder.push(id);
  }
  return {
    orientation,
    order: uniqueOrder,
    panels: panelLayoutMapFromEntries(
      [...panelEntries].map(([id, state]) => [id, { ...state }]),
    ),
  };
}

/** Serialize a group's panel values into the versioned storage document.
 * Orientation is stored as a compatibility guard; child order is not
 * persisted because storage cannot reconstruct React child order. */
export function serializePersistedValue(
  orientation: PanelGroupOrientation,
  panels: PanelLayoutMap,
): string {
  return JSON.stringify({
    version: PERSISTED_VALUE_VERSION,
    orientation,
    panels,
  });
}

/**
 * Parse a persisted storage document. Accepts exactly the version-1 format
 * with a matching orientation; anything else — including any pre-release
 * format — returns null and is treated as a deserialization failure by the
 * caller (never silently overwritten).
 */
export function parsePersistedValue(
  value: unknown,
  expectedOrientation: PanelGroupOrientation,
): PanelLayoutMap | null {
  if (!isRecord(value)) return null;
  if (value.version !== PERSISTED_VALUE_VERSION) return null;
  if (value.orientation !== expectedOrientation) return null;
  return parsePanels(value.panels);
}

export function reconcilePanelGroupLayout(
  layout: PanelGroupLayout,
  available: ReadonlyMap<
    string,
    { minSize: number; maxSize: number; collapsible: boolean }
  >,
): PanelLayoutMap {
  const layoutPanels = new Map(Object.entries(layout.panels));
  const reconciled = new Map<string, PanelLayoutState>();
  for (const id of layout.order) {
    const bounds = available.get(id);
    const state = layoutPanels.get(id);
    if (!bounds || !state) continue;
    const next: PanelLayoutState = {
      size: Math.min(bounds.maxSize, Math.max(bounds.minSize, state.size)),
    };
    if (bounds.collapsible && state.collapsed !== undefined) {
      next.collapsed = state.collapsed;
    }
    reconciled.set(id, next);
  }
  for (const [id, bounds] of available) {
    if (reconciled.has(id)) continue;
    const state = layoutPanels.get(id);
    if (!state) continue;
    const next: PanelLayoutState = {
      size: Math.min(bounds.maxSize, Math.max(bounds.minSize, state.size)),
    };
    if (bounds.collapsible && state.collapsed !== undefined) {
      next.collapsed = state.collapsed;
    }
    reconciled.set(id, next);
  }
  return panelLayoutMapFromEntries(reconciled);
}

/** Semantic equality of two panel-value maps. Key ORDER is deliberately
 * ignored: reordering identical keys is not a value change (§2). */
export function panelValuesEqual(
  a: PanelLayoutMap | PanelGroupValue,
  b: PanelLayoutMap | PanelGroupValue,
): boolean {
  if (a === b) return true;
  const aIds = Object.keys(a);
  const bIds = Object.keys(b);
  if (aIds.length !== bIds.length) return false;
  for (const id of aIds) {
    const left = getPanelLayoutState(a, id);
    const right = getPanelLayoutState(b, id);
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

/** INTERNAL: full snapshot equality — panel values plus committed order.
 * Only internal consumers that genuinely care about topology (controlled
 * commit suppression) use this; public change detection uses
 * `panelValuesEqual`. */
export function panelGroupLayoutsEqual(
  a: PanelGroupLayout | null,
  b: PanelGroupLayout | null,
): boolean {
  if (a === b) return true;
  if (!a || !b || a.orientation !== b.orientation) return false;
  if (a.order.length !== b.order.length) return false;
  for (let index = 0; index < a.order.length; index++) {
    if (a.order[index] !== b.order[index]) return false;
  }
  return panelValuesEqual(a.panels, b.panels);
}

function parsePanels(value: unknown): PanelLayoutMap | null {
  if (!isRecord(value)) return null;
  const panels = new Map<string, PanelLayoutState>();
  for (const [id, rawState] of Object.entries(value)) {
    // A single malformed entry invalidates the document: partial acceptance
    // would silently drop persisted panels and then overwrite the record.
    if (!isRecord(rawState) || !Number.isFinite(rawState.size)) return null;
    const state: PanelLayoutState = { size: rawState.size as number };
    if (rawState.collapsed !== undefined) {
      if (typeof rawState.collapsed !== "boolean") return null;
      state.collapsed = rawState.collapsed;
    }
    panels.set(id, state);
  }
  return panelLayoutMapFromEntries(panels);
}

/** Convert keyed internal state to the public, JSON-serializable record shape.
 * `Object.fromEntries` defines own data properties even for `__proto__`, while
 * keeping the ordinary `Object.prototype` expected of public layout objects. */
export function panelLayoutMapFromEntries(
  entries: Iterable<readonly [string, PanelLayoutState]>,
): PanelLayoutMap {
  return Object.fromEntries(entries);
}

/** Read panel state without mistaking inherited object properties for panel
 * ids such as `constructor`. */
export function getPanelLayoutState(
  panels: PanelLayoutMap | PanelGroupValue,
  id: string,
): PanelLayoutState | undefined {
  return Object.hasOwn(panels, id) ? (panels as PanelLayoutMap)[id] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
