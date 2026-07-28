export type TypeReferenceCategory =
  | "component-props"
  | "layout-types"
  | "value-event-types"
  | "action-types"
  | "provider-hook-types"
  | "persistence-types";

export const TYPE_CATEGORY_BY_NAME = {
  DockedPanelProps: "component-props",
  PanelGroupProps: "component-props",
  PanelProps: "component-props",
  PanelResizeHandleProps: "component-props",
  PanelSlotProps: "component-props",
  PanelSlots: "component-props",
  PeerPanelProps: "component-props",
  PanelCollapseBelowBehavior: "layout-types",
  PanelContainerResizeBehavior: "layout-types",
  PanelCursorBehavior: "layout-types",
  PanelGroupAnimation: "layout-types",
  PanelGroupCascade: "layout-types",
  PanelGroupOrientation: "layout-types",
  PanelKind: "layout-types",
  PanelSide: "layout-types",
  SizeSpec: "layout-types",
  PanelChangeDetails: "value-event-types",
  PanelGroupValue: "value-event-types",
  PanelGroupValueChangeDetails: "value-event-types",
  PanelResizeEndEvent: "value-event-types",
  PanelResizeStartEvent: "value-event-types",
  PanelValue: "value-event-types",
  PanelValueChangeReason: "value-event-types",
  PanelValueChangeTrigger: "value-event-types",
  PanelActionOptions: "action-types",
  PanelActionRejectionReason: "action-types",
  PanelActionResult: "action-types",
  PanelActions: "action-types",
  PanelApi: "action-types",
  PanelGroupApi: "action-types",
  PanelSizeActionDetails: "action-types",
  PanelActionDispatcher: "provider-hook-types",
  PanelControlConstraints: "provider-hook-types",
  PanelControls: "provider-hook-types",
  PanelGroupCommandResult: "provider-hook-types",
  PanelGroupState: "provider-hook-types",
  PanelLocator: "provider-hook-types",
  PanelLookupActionResult: "provider-hook-types",
  PanelProviderProps: "provider-hook-types",
  PanelGroupPersistenceOptions: "persistence-types",
  PanelPersistenceError: "persistence-types",
  PanelPersistenceStatus: "persistence-types",
  PanelStorage: "persistence-types",
} as const satisfies Record<string, TypeReferenceCategory>;

export type TypeName = keyof typeof TYPE_CATEGORY_BY_NAME;

export const TYPE_REFERENCE_COPY: Record<TypeReferenceCategory, string> = {
  "component-props":
    "Public prop unions for PanelGroup, Panel, PanelResizeHandle, and advanced panel slots.",
  "layout-types":
    "The vocabulary for axes, panel roles, logical sides, animation, cascades, collapse behavior, and size values.",
  "value-event-types":
    "The values and event metadata used to control a layout and explain how it changed.",
  "action-types":
    "Imperative panel and group APIs, their shared action methods, and the result unions returned by every command.",
  "provider-hook-types":
    "Provider addresses, reactive control snapshots, dispatchers, and lookup-aware command results.",
  "persistence-types":
    "Persistence configuration, storage adapters, restore status, and reported failures.",
};
