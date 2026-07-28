/** Main axis along which a panel group lays out its children. */
export type PanelGroupOrientation = "horizontal" | "vertical";

/** Logical edge of a group. `start` and `end` follow the group's `dir`. */
export type PanelSide = "start" | "end";

/** Discriminator on `PanelConfig`. Docked panels anchor to a group edge;
 * peer panels share space proportionally with adjacent peers. Both kinds can
 * be collapsible and participate in explicit resize boundaries. */
export type PanelKind = "docked" | "peer";

/** How an expanded panel responds when its parent group's size changes. */
export type PanelContainerResizeBehavior = "fixed" | "proportional";

/** How a panel closes when a pointer resize crosses `collapseBelow`. */
export type PanelCollapseBelowBehavior = "animated" | "instant";

/** How resize cursors are applied during pointer interactions. */
export type PanelCursorBehavior = "global" | "handle" | "none";

/**
 * Group-level animation control for `<PanelGroup animation>`.
 *
 * - `false` — disables every library-owned panel transition and the
 *   collapse-threshold spring for that group.
 * - `{ durationMs?, easing? }` — partial overrides of the default
 *   300ms / `cubic-bezier(0.4, 0, 0.2, 1)` panel transition.
 *
 * Applies to the group's own panels only; nested groups are governed by
 * their own `animation` prop (no inheritance).
 */
export type PanelGroupAnimation =
  | false
  | {
      /** Panel transition duration in milliseconds. Must be a finite number
       * greater than zero; invalid values fall back to 300 with a dev
       * warning. */
      durationMs?: number;
      /** CSS easing keyword or function for panel transitions. Must be a
       * non-empty string; invalid values fall back to
       * `"cubic-bezier(0.4, 0, 0.2, 1)"` with a dev warning. */
      easing?: string;
    };

/**
 * Mid-drag cascade reversal semantics for `<PanelGroup cascade>` (R-25).
 *
 * - `"reversible"` (default) — a held pointer drag is one transaction
 *   computed from the session-start snapshot, so reversing direction
 *   exactly retraces the cascade: space taken from a far panel returns to
 *   it before the boundary-adjacent panel regrows.
 * - `"latching"` — cascade pushes are one-way within a held drag: reversing
 *   direction rebases the session at the directional extreme, so panels
 *   regrow starting from the boundary-adjacent panel and far panels keep
 *   their pushed size until released space reaches them.
 *
 * Across sessions the two modes are identical — sizes commit on release,
 * and a new drag always starts from the committed state.
 */
export type PanelGroupCascade = "reversible" | "latching";

/** Exact address of one panel for provider-level lookup: the group's
 * published `groupId` plus the panel's group-local `panelId`. Lookup never
 * falls back across groups — mount order can never decide a target. */
export type PanelLocator = {
  groupId: string;
  panelId: string;
};

/** Reactive snapshot of one published group's layout condition, read through
 * `usePanelGroupState(groupId)`. Locator-keyed and provider-level, so a parent
 * that renders the group can respond to its size (swap a panel for a sheet,
 * switch to tabs) without threading refs. */
export type PanelGroupState = {
  /** Group content-box size along its main axis, px. */
  containerSize: number;
  /** True once the group has a confirmed measurement (false during SSR and
   * the pre-measurement first paint). */
  measured: boolean;
  /** Px by which Σ floors exceeds the container (0 when everything fits).
   * Floors: `collapsedSize` when collapsed, `minSize` when expanded; gutters
   * included. */
  overconstrainedBy: number;
  /** Px the group could not allocate without exceeding maxima (the allocator's
   * `unallocated`), for symmetry with `overconstrainedBy`. */
  unallocatedPx: number;
};

/** What operation produced a value change. Orthogonal to the input device
 * that triggered it (`PanelValueChangeTrigger`). */
export type PanelValueChangeReason =
  | "resize"
  | "collapse"
  | "expand"
  | "set-value"
  | "reset"
  | "container-resize"
  | "restore"
  | "children";

/** What input produced a value change: a pointer gesture, a keyboard action,
 * an imperative API call, or a system cause (container resize, persistence
 * restoration, membership changes). */
export type PanelValueChangeTrigger = "pointer" | "keyboard" | "api" | "system";

/**
 * Accepted size value for panel sizes and collapse thresholds.
 *
 * - `number` — pixels.
 * - `string` — a strict CSS-compatible subset: a single dimension with a
 *   required unit (`px`, `%`, `em`, `rem`, `vw`, `vh`), the literal `"0"`,
 *   or a `calc()` expression combining dimensions with `+` and `-`
 *   (whitespace required around operators, parentheses allowed).
 *   Percentages resolve against the parent group's size along its axis.
 *
 * Everything accepted is also valid CSS with identical meaning. Bare
 * numeric strings (`"240"` — pass `240` or `"240px"`), arithmetic outside
 * `calc()`, `*` and `/`, and CSS functions such as `var()` or `clamp()`
 * are rejected: the layout allocator needs deterministic, synchronous
 * pixel resolution across SSR, imperative actions, and browsers.
 */
export type SizeSpec = number | string;

/** One panel's semantic state inside a group value: the preferred expanded
 * size in resolved pixels, plus collapsed state for collapsible panels. */
export type PanelValue = Readonly<{
  /** Preferred expanded size in resolved pixels. */
  size: number;
  collapsed?: boolean;
}>;

/** The controlled/uncontrolled state of a group: panel values keyed by
 * group-local `panelId`. Anonymous panels never appear. Key order carries no
 * meaning — React children own visual order. */
export type PanelGroupValue = Readonly<Record<string, PanelValue>>;

/**
 * Storage adapter for layout persistence. Mirrors the surface of
 * Web Storage so localStorage / sessionStorage drop in directly, and
 * custom adapters (cookies, server, jotai-persist, etc.) can satisfy
 * the same shape.
 */
export type PanelStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
};

/**
 * Failure reported through `persistence.onError`.
 *
 * - `read` — storage acquisition or `getItem` threw or rejected.
 * - `deserialize` — the stored value was invalid JSON or an invalid,
 *   incompatible, or orientation-mismatched layout document.
 * - `write` — `setItem` threw or rejected.
 *
 * Read and deserialization failures keep the declarative fallback and are
 * reported once per restore attempt; storage is not overwritten until a
 * later explicit mutation is accepted. Write failures are recoverable —
 * later accepted changes retry.
 */
export type PanelPersistenceError = {
  operation: "read" | "deserialize" | "write";
  key: string;
  error: unknown;
};

/** Restore lifecycle reported through `persistence.onStatusChange`:
 * `restoring` when the mount-time read begins, `ready` exactly once after
 * the restore succeeded, found nothing, or failed. */
export type PanelPersistenceStatus =
  | { state: "restoring"; key: string }
  | { state: "ready"; key: string };

/**
 * Grouped persistence configuration for `<PanelGroup persistence>`.
 * Mutually exclusive with controlled `value` — a controlled parent already
 * owns storage and restoration. For uncontrolled groups the precedence is:
 * a valid restored value after mount, then `defaultValue` as the SSR and
 * first-paint fallback, then declarative child defaults.
 */
export type PanelGroupPersistenceOptions = {
  /** Storage key the group's value is saved under and restored from. */
  key: string;
  /** Storage adapter. Defaults to `localStorage`; SSR-safe (no storage
   * access happens during server render). */
  storage?: PanelStorage;
  /** Reports read, deserialization, and write failures. */
  onError?: (error: PanelPersistenceError) => void;
  /** Reports restore lifecycle transitions. */
  onStatusChange?: (status: PanelPersistenceStatus) => void;
};

/** INTERNAL: per-panel preferred size and optional collapsible state.
 * Structurally identical to the public `PanelValue`; kept as the internal
 * mutable working shape. */
export type PanelLayoutState = { collapsed?: boolean; size: number };
/** INTERNAL: panel state keyed by group-local `panelId`. */
export type PanelLayoutMap = Record<string, PanelLayoutState>;

/** INTERNAL: a group's live topology snapshot — semantic panel values plus
 * runtime child order. Never exported: consumers see `PanelGroupValue`;
 * persistence uses the versioned document in layout-state.ts. */
export type PanelGroupLayout = {
  orientation: PanelGroupOrientation;
  /** Group-local `panelId`s in committed DOM order. */
  order: string[];
  /** Preferred sizes and collapsible state. Rendered sizes are derived. */
  panels: PanelLayoutMap;
};

/** Metadata delivered with every `onValueChange`. */
export type PanelGroupValueChangeDetails = {
  /** The immediately prior emitted value; the first change of a pointer
   * transaction uses the transaction's start value as its baseline. */
  previousValue: PanelGroupValue;
  reason: PanelValueChangeReason;
  trigger: PanelValueChangeTrigger;
  /** The declared `handleId` of the handle that produced the change, when a
   * handle was involved and declares one. */
  handleId?: string;
};

/** Start of a pointer resize transaction. The lifecycle brackets actual
 * movement: this fires when the first pointer move crosses the click-vs-drag
 * threshold — a press-and-release without movement emits nothing. Keyboard
 * actions are atomic value changes and emit no lifecycle. */
export type PanelResizeStartEvent = {
  handleId?: string;
  /** Group value at transaction start. */
  value: PanelGroupValue;
};

/** End of a pointer resize transaction — fires exactly once per session that
 * started (i.e. that fired `PanelResizeStartEvent`); a click without
 * movement starts no session and emits nothing. */
export type PanelResizeEndEvent = {
  handleId?: string;
  /** Group value at transaction start (the operation baseline). */
  initialValue: PanelGroupValue;
  /** Final group value when the session ended. */
  value: PanelGroupValue;
  /** True when the session ended via cancel, lost capture, or an exception
   * path rather than a normal pointer release. */
  canceled: boolean;
};

/** Metadata delivered with the per-panel `onSizeChange`/`onCollapsedChange`
 * callbacks. */
export type PanelChangeDetails = {
  reason: PanelValueChangeReason;
  trigger: PanelValueChangeTrigger;
};

export type PanelConfig = {
  /** Group-local stable identity: keys layout snapshots, persistence, and
   * provider lookup (together with the group's `groupId`). */
  panelId?: string;
  kind: PanelKind;
  orientation: PanelGroupOrientation;
  /** Present iff `kind === "docked"`. */
  side?: PanelSide;
  defaultSize: number;
  minSize: number;
  maxSize: number;
  containerResizeBehavior: PanelContainerResizeBehavior;
  collapsible: boolean;
  /** Resolved `collapsible="auto"` mode (R-37): the panel folds to its rail
   * when its declared minimum stops fitting the container. Implies
   * `collapsible`; the public `collapsible` projection stays boolean. */
  autoCollapsible: boolean;
  defaultCollapsed: boolean;
  collapsedSize: number;
  /** Allow a visible collapsed rail to be expanded by resizing its adjacent
   * handle. Ignored when `collapsedSize` is zero. */
  resizableWhenCollapsed: boolean;
  /** Prevents this panel from being resized directly or through cascades. */
  disabled?: boolean;
  /** When true, this panel is excluded from sibling drag cascades — other
   *  panels' resize handles can never shrink it. The user can still resize
   *  this panel directly via its own handle. Defaults to false. Docked-only. */
  pinned?: boolean;
  /** Pointer-gesture threshold below which a collapsible panel collapses.
   * Rendered geometry remains clamped to minSize until it is crossed. */
  collapseBelow?: number;
  /** Additional neutral distance when reversing a live collapse. Reopening
   * always requires reaching at least minSize. */
  collapseBelowHysteresis: number;
  /** Animation behavior when `collapseBelow` is crossed. */
  collapseBelowBehavior: PanelCollapseBelowBehavior;
};

/** Options accepted by every imperative panel action. */
export type PanelActionOptions = Readonly<{
  /** `"none"` applies the change without the size transition. */
  transition?: "default" | "none";
}>;

/** Why an action was rejected outright (no state was touched). */
export type PanelActionRejectionReason =
  | "disabled"
  | "not-collapsible"
  | "invalid-size";

/**
 * Synchronous outcome of an imperative panel action, reporting the actual
 * accepted value — never the raw request.
 *
 * `applied` describes command resolution, not rendering: in uncontrolled
 * mode the change will render (and persist, if configured); in controlled
 * mode it means the change was emitted as a proposal through
 * `onValueChange`, which the parent may still decline. It must never be
 * read as "the panel is now this size."
 */
export type PanelActionResult<
  TValue,
  TDetails extends object = Record<never, never>,
> =
  | ({ applied: true; value: TValue } & TDetails)
  | ({ applied: false; reason: "unchanged"; value: TValue } & TDetails)
  | { applied: false; reason: PanelActionRejectionReason };

/** Dispatcher variant: adds `not-found` for unresolved locators. */
export type PanelLookupActionResult<
  TValue,
  TDetails extends object = Record<never, never>,
> =
  | PanelActionResult<TValue, TDetails>
  | { applied: false; reason: "not-found" };

/** Extra details on size-producing actions. */
export type PanelSizeActionDetails = {
  /** True when bounds or group allocation prevented the full request,
   * independent of whether any change occurred. */
  constrained: boolean;
};

export type PanelActions = {
  setSize: (
    size: SizeSpec,
    options?: PanelActionOptions,
  ) => PanelActionResult<number, PanelSizeActionDetails>;
  /** Expand the panel and resize its preferred size to its resolved
   * maximum. Always reports the resulting numeric preferred size. */
  maximize: (
    options?: PanelActionOptions,
  ) => PanelActionResult<number, PanelSizeActionDetails>;
  setCollapsed: (
    collapsed: boolean,
    options?: PanelActionOptions,
  ) => PanelActionResult<boolean>;
  collapse: (options?: PanelActionOptions) => PanelActionResult<true>;
  expand: (options?: PanelActionOptions) => PanelActionResult<false>;
  toggle: (options?: PanelActionOptions) => PanelActionResult<boolean>;
  /** Restore the panel's declarative defaults (`defaultSize` re-resolved
   * against the current context, and `defaultCollapsed`), re-running peer
   * allocation. Reports the reconciled outcome. */
  reset: (options?: PanelActionOptions) => PanelActionResult<PanelValue>;
};

/** INTERNAL: the full resolved controls the group machinery works with.
 * Public consumers receive the projected `PanelControls` instead. */
export type InternalPanelControls = PanelActions & {
  config: PanelConfig;
  /** User's preferred / stored size. For docked, this is what the user
   *  dragged to. For peer, this is the auto-distributed/seam-driven basis. */
  size: number;
  /** Actually displayed basis after collapsed and over-constraint state. */
  renderedSize: number;
  /** Locally committed collapsed state — the presentation truth every
   * geometry consumer (allocation, handle capacity, rendered sizes) reads.
   * For a panel with a controlled `collapsed` prop (R-33) this may diverge
   * from the prop only while a live resize gesture presents a threshold
   * crossing; the effective (authoritative) state is
   * `controlledCollapsed ?? collapsed`. */
  collapsed: boolean;
  /** The controlled `collapsed` prop when provided on a collapsible panel
   * (R-33); `undefined` means the panel owns its collapsed state. When set,
   * `setCollapsed`/`collapse`/`expand`/`toggle` emit proposals instead of
   * applying, and reported layouts pin this panel's collapsed bit to this
   * value. */
  controlledCollapsed: boolean | undefined;
  /** Group-computed responsive fold bit (R-37). Never written to the store and
   * never part of geometry input (the group ORs it into allocation itself);
   * carried here only so `PanelControls` readouts report the effective state:
   * `controlledCollapsed ?? (collapsed || autoCollapsed)`. */
  autoCollapsed: boolean;
  /** Raw local collapsed commit, bypassing controlled-proposal routing. For
   * an uncontrolled panel this IS `setCollapsed`. The group's resize
   * machinery uses it to present threshold crossings live on a controlled
   * panel and to re-commit the prop state at session end (the declined-
   * proposal snap-back). Never emits proposals or change callbacks. */
  applyCollapsedState: (
    next: boolean,
    options?: PanelActionOptions,
  ) => PanelActionResult<boolean>;
  /** Emit one controlled-collapse proposal through `onCollapsedChange`
   * (no-op unless `controlledCollapsed` is set). Details derive from the
   * group's live change attribution; resize-attributed calls report the
   * direction (`collapse`/`expand`) with the session's trigger. */
  notifyCollapsedProposal: (next: boolean) => void;
  /** Measurement-dependent constraints are authoritative. */
  isReady: boolean;
};

/** Live bound facts a control UI needs, in resolved pixels. */
export type PanelControlConstraints = {
  minSize: number;
  maxSize: number;
  collapsedSize: number;
};

/**
 * One panel's live state and bound actions, as subscribed through
 * `usePanelControls`/`usePanelRegistry`. Exposes stable control facts, not
 * the library's broad resolved sizing policy.
 */
export type PanelControls = PanelActions & {
  orientation: PanelGroupOrientation;
  /** Preferred size in resolved pixels. */
  size: number;
  /** Currently rendered size in resolved pixels. */
  renderedSize: number;
  collapsed: boolean;
  collapsible: boolean;
  disabled: boolean;
  /** True once measurement-dependent constraints are authoritative. Does
   * not imply immutability — constraints re-resolve as context changes. */
  isReady: boolean;
  constraints: PanelControlConstraints;
} & ({ kind: "docked"; side: PanelSide } | { kind: "peer"; side?: never });

/** Locator-keyed action dispatch returned by `usePanelActions()`. Methods
 * resolve their target at call time with no reactive subscription; an
 * unknown or unpublished locator reports `not-found`. */
export type PanelActionDispatcher = {
  setSize(
    target: PanelLocator,
    size: SizeSpec,
    options?: PanelActionOptions,
  ): PanelLookupActionResult<number, PanelSizeActionDetails>;
  maximize(
    target: PanelLocator,
    options?: PanelActionOptions,
  ): PanelLookupActionResult<number, PanelSizeActionDetails>;
  setCollapsed(
    target: PanelLocator,
    collapsed: boolean,
    options?: PanelActionOptions,
  ): PanelLookupActionResult<boolean>;
  collapse(
    target: PanelLocator,
    options?: PanelActionOptions,
  ): PanelLookupActionResult<true>;
  expand(
    target: PanelLocator,
    options?: PanelActionOptions,
  ): PanelLookupActionResult<false>;
  toggle(
    target: PanelLocator,
    options?: PanelActionOptions,
  ): PanelLookupActionResult<boolean>;
  reset(
    target: PanelLocator,
    options?: PanelActionOptions,
  ): PanelLookupActionResult<PanelValue>;

  // Group-scoped commands: mirror the group's imperative API without an
  // apiRef. `not-found` reports an unpublished or unmounted groupId.
  getGroupValue(groupId: string): PanelGroupValue | undefined;
  setGroupValue(
    groupId: string,
    value: PanelGroupValue,
  ): PanelGroupCommandResult;
  resetGroupValue(groupId: string): PanelGroupCommandResult;
};

/** Result of a group-scoped dispatcher command. Group commands cannot be
 * rejected for panel-level reasons (unknown keys are ignored and sizes are
 * reconciled), so the only failure is an unresolved `groupId`. In controlled
 * mode `applied: true` means the change was emitted as a proposal; the
 * parent may still decline it. */
export type PanelGroupCommandResult =
  | { applied: true; value: PanelGroupValue }
  | { applied: false; reason: "unchanged"; value: PanelGroupValue }
  | { applied: false; reason: "not-found" };
