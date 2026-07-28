import { warnDev } from "../shared/diagnostics.js";
import type {
  InternalPanelControls,
  PanelConfig,
  PanelControlConstraints,
  PanelControls,
  PanelGroupCommandResult,
  PanelGroupState,
  PanelGroupValue,
  PanelLocator,
} from "../types.js";
import { createKeyedStore, type KeyedStore } from "./keyed-store.js";
import { SIZE_EPSILON } from "./size.js";

/** Group-scoped imperative commands a mounted group registers alongside its
 * `groupId` publication, resolved by the `usePanelActions()` dispatcher. */
export type PanelGroupCommands = {
  getValue(): PanelGroupValue;
  setValue(value: PanelGroupValue): PanelGroupCommandResult;
  resetValue(): PanelGroupCommandResult;
};

/**
 * Provider-level registry of panel controls, held outside React state so
 * per-tick drag updates notify only subscribers of the panel that moved.
 *
 * Identity model: every mounted `<PanelGroup>` owns a private token; its
 * panels register under that token keyed by their group-local `panelId`.
 * A group that declares `groupId` publishes its token under that name,
 * which is the only way lookup crosses the group boundary. There is no
 * flat provider-wide id namespace and no mount-order fallback: a
 * `PanelLocator` either resolves exactly or not at all.
 */
export type PanelStore = {
  /** Exact-locator lookup. Undefined when the group is unpublished/unmounted
   * or the panel is unknown. */
  get(locator: PanelLocator): PanelControls | undefined;
  /** Cached immutable snapshot of one published group's panels, keyed by
   * `panelId`. Reference-stable between changes so it is safe as a
   * `useSyncExternalStore` snapshot; a stable empty record is returned for
   * unpublished groups. */
  getGroupSnapshot(groupId: string): Readonly<Record<string, PanelControls>>;
  /** Subscribe to one panel's controls; also fires when the `groupId`
   * publication itself changes so snapshots re-resolve. */
  subscribe(locator: PanelLocator, cb: () => void): () => void;
  /** Subscribe to any change within one published group. */
  subscribeGroup(groupId: string, cb: () => void): () => void;
  registerPanel(
    groupToken: object,
    panelId: string,
    owner: object,
    controls: PanelControls,
  ): void;
  unregisterPanel(groupToken: object, panelId: string, owner: object): void;
  /** Publish a mounted group's token under a public `groupId`. Duplicate
   * publication of one `groupId` by different groups is a development
   * error; the first publisher stays authoritative. */
  publishGroup(
    groupId: string,
    groupToken: object,
    owner: object,
    commands?: PanelGroupCommands,
  ): void;
  unpublishGroup(groupId: string, owner: object): void;
  /** Resolve the published group's imperative commands, if any. */
  getGroupCommands(groupId: string): PanelGroupCommands | undefined;
  /** Publish a mounted group's reactive layout snapshot under its token.
   * Equality-gated (SIZE_EPSILON on numerics) so idle re-renders are free and
   * the returned reference stays stable between material changes. */
  publishGroupState(groupToken: object, state: PanelGroupState): void;
  /** Resolve one published group's snapshot. Undefined when the group is
   * unpublished/unmounted or has not measured yet. Reference-stable between
   * changes, so it is safe as a `useSyncExternalStore` snapshot. */
  getGroupState(groupId: string): PanelGroupState | undefined;
  /** Subscribe to one published group's snapshot; also fires when the
   * `groupId` publication itself changes so the snapshot re-resolves. */
  subscribeGroupState(groupId: string, cb: () => void): () => void;
};

type GroupRegistry = {
  store: KeyedStore<string, PanelControls>;
  /** Owner instances per panelId — Strict Mode re-registers the same owner,
   * which must not count as a duplicate. */
  owners: Map<string, Map<object, PanelControls>>;
  /** panelIds already diagnosed as duplicates within this group. */
  warned: Set<string>;
  /** Cached `getGroupSnapshot` record; invalidated on any store change. */
  snapshot: Record<string, PanelControls> | null;
  /** Latest reactive layout snapshot the group published (see
   * `publishGroupState`). Reference-stable between material changes. */
  groupState: PanelGroupState | undefined;
  /** Subscribers to `groupState`, resolved through the groupId publication
   * layer so a group remount re-attaches them (R-01 family). */
  groupStateListeners: Set<() => void>;
};

const EMPTY_GROUP: Readonly<Record<string, PanelControls>> = Object.freeze(
  Object.create(null),
);

export function createPanelStore(): PanelStore {
  /** Weakly keyed by group token, and a registry lives exactly as long as
   * its token (owned by the mounted `<PanelGroup>`) — unmounted groups are
   * collected without bookkeeping. Never delete an entry while the token is
   * alive: subscribers attach to the registry's KeyedStore, so replacing it
   * on re-registration would orphan them silently (bug R-01). */
  const groups = new WeakMap<object, GroupRegistry>();
  /** groupId → publishing owners in registration order. The first owner's
   * token resolves; later publishers are a diagnosed development error. */
  const published = new Map<string, Map<object, object>>();
  /** Fires when a groupId→token mapping changes so locator subscriptions
   * re-resolve through the new mapping. */
  const publicationSubscribers = new Map<string, Set<() => void>>();
  const duplicateGroupWarnings = new Set<string>();
  // Weakly keyed by group token so an unmounted group's commands are
  // collectable without explicit cleanup bookkeeping.
  const groupCommands = new WeakMap<object, PanelGroupCommands>();

  function groupRegistry(groupToken: object): GroupRegistry {
    let registry = groups.get(groupToken);
    if (!registry) {
      registry = {
        store: createKeyedStore<string, PanelControls>(shallowEqualControls),
        owners: new Map(),
        warned: new Set(),
        snapshot: null,
        groupState: undefined,
        groupStateListeners: new Set(),
      };
      registry.store.subscribeAny(() => {
        const current = groups.get(groupToken);
        if (current) current.snapshot = null;
      });
      groups.set(groupToken, registry);
    }
    return registry;
  }

  function resolveToken(groupId: string): object | undefined {
    return published.get(groupId)?.values().next().value;
  }

  function notifyPublication(groupId: string): void {
    const subscribers = publicationSubscribers.get(groupId);
    if (!subscribers) return;
    for (const cb of [...subscribers]) cb();
  }

  function subscribePublication(groupId: string, cb: () => void): () => void {
    let subscribers = publicationSubscribers.get(groupId);
    if (!subscribers) {
      subscribers = new Set();
      publicationSubscribers.set(groupId, subscribers);
    }
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
      if (subscribers.size === 0) publicationSubscribers.delete(groupId);
    };
  }

  return {
    get({ groupId, panelId }) {
      const token = resolveToken(groupId);
      return token ? groups.get(token)?.store.get(panelId) : undefined;
    },
    getGroupSnapshot(groupId) {
      const token = resolveToken(groupId);
      const registry = token ? groups.get(token) : undefined;
      if (!registry) return EMPTY_GROUP;
      if (registry.snapshot === null) {
        // Null-prototype so unregistered panelIds such as `constructor`
        // cannot surface Object.prototype members as phantom panels.
        registry.snapshot = Object.assign(
          Object.create(null),
          Object.fromEntries(registry.store.getMap()),
        );
      }
      return registry.snapshot as Record<string, PanelControls>;
    },
    subscribe({ groupId, panelId }, cb) {
      let unsubscribePanel = subscribeThroughMapping();
      const unsubscribeMapping = subscribePublication(groupId, () => {
        unsubscribePanel();
        unsubscribePanel = subscribeThroughMapping();
        cb();
      });
      return () => {
        unsubscribeMapping();
        unsubscribePanel();
      };
      function subscribeThroughMapping(): () => void {
        const token = resolveToken(groupId);
        const registry = token ? groups.get(token) : undefined;
        return registry ? registry.store.subscribeKey(panelId, cb) : () => {};
      }
    },
    subscribeGroup(groupId, cb) {
      let unsubscribeGroup = subscribeThroughMapping();
      const unsubscribeMapping = subscribePublication(groupId, () => {
        unsubscribeGroup();
        unsubscribeGroup = subscribeThroughMapping();
        cb();
      });
      return () => {
        unsubscribeMapping();
        unsubscribeGroup();
      };
      function subscribeThroughMapping(): () => void {
        const token = resolveToken(groupId);
        const registry = token ? groups.get(token) : undefined;
        return registry ? registry.store.subscribeAny(cb) : () => {};
      }
    },
    registerPanel(groupToken, panelId, owner, controls) {
      const registry = groupRegistry(groupToken);
      let owners = registry.owners.get(panelId);
      if (!owners) {
        owners = new Map();
        registry.owners.set(panelId, owners);
      }
      const isNewOwner = !owners.has(owner);
      owners.set(owner, controls);
      if (isNewOwner && owners.size > 1 && !registry.warned.has(panelId)) {
        registry.warned.add(panelId);
        warnDev(
          `Duplicate panelId "${panelId}" within one <PanelGroup>. Each panel in a group must have a unique panelId; rename one of the duplicates.`,
        );
      }
      const active = owners.values().next().value;
      if (active) registry.store.set(panelId, active);
    },
    unregisterPanel(groupToken, panelId, owner) {
      const registry = groups.get(groupToken);
      if (!registry) return;
      const owners = registry.owners.get(panelId);
      if (!owners) return;
      owners.delete(owner);
      const next = owners.values().next().value;
      if (next) registry.store.set(panelId, next);
      else {
        registry.owners.delete(panelId);
        registry.store.delete(panelId);
        // The registry itself stays: it is weakly held by the group token,
        // and deleting it here would detach live subscribers (bug R-01).
      }
    },
    publishGroup(groupId, groupToken, owner, commands) {
      if (commands) groupCommands.set(groupToken, commands);
      let owners = published.get(groupId);
      if (!owners) {
        owners = new Map();
        published.set(groupId, owners);
      }
      const previousToken = resolveToken(groupId);
      const isNewOwner = !owners.has(owner);
      owners.set(owner, groupToken);
      if (
        isNewOwner &&
        owners.size > 1 &&
        !duplicateGroupWarnings.has(groupId)
      ) {
        duplicateGroupWarnings.add(groupId);
        warnDev(
          `Duplicate groupId "${groupId}" within one <PanelProvider>. Each published group must have a unique groupId; lookup resolves the first mounted group.`,
        );
      }
      if (resolveToken(groupId) !== previousToken) notifyPublication(groupId);
    },
    getGroupCommands(groupId) {
      const token = resolveToken(groupId);
      return token ? groupCommands.get(token) : undefined;
    },
    publishGroupState(groupToken, state) {
      // The token-keyed registry is created here if the group's state effect
      // runs before any panel registers; it is weakly held, so an unmounted
      // group is collected without cleanup.
      const registry = groupRegistry(groupToken);
      if (
        registry.groupState &&
        panelGroupStatesEqual(registry.groupState, state)
      ) {
        return;
      }
      registry.groupState = state;
      for (const cb of [...registry.groupStateListeners]) cb();
    },
    getGroupState(groupId) {
      const token = resolveToken(groupId);
      return token ? groups.get(token)?.groupState : undefined;
    },
    subscribeGroupState(groupId, cb) {
      let detach = attach();
      const unsubscribeMapping = subscribePublication(groupId, () => {
        detach();
        detach = attach();
        cb();
      });
      return () => {
        unsubscribeMapping();
        detach();
      };
      function attach(): () => void {
        const token = resolveToken(groupId);
        if (!token) return () => {};
        // Materialize the registry (weakly held, free to create early) so the
        // listener exists before an anonymous-only group's publishGroupState
        // fires — groups.get(token) would noop until that first publish (L1).
        const registry = groupRegistry(token);
        registry.groupStateListeners.add(cb);
        return () => registry.groupStateListeners.delete(cb);
      }
    },
    unpublishGroup(groupId, owner) {
      const owners = published.get(groupId);
      if (!owners) return;
      const previousToken = resolveToken(groupId);
      owners.delete(owner);
      if (owners.size === 0) published.delete(groupId);
      if (resolveToken(groupId) !== previousToken) notifyPublication(groupId);
    },
  };
}

// Exhaustive field lists for the comparators below. The Record types fail
// to compile when the control shapes gain a field that isn't listed here —
// without that, a forgotten field would silently stop propagating to
// usePanelControls consumers.
const PUBLIC_CONTROL_FIELDS: Record<
  Exclude<keyof PanelControls, "constraints">,
  true
> = {
  kind: true,
  side: true,
  orientation: true,
  size: true,
  renderedSize: true,
  collapsed: true,
  collapsible: true,
  disabled: true,
  isReady: true,
  setSize: true,
  maximize: true,
  setCollapsed: true,
  collapse: true,
  expand: true,
  toggle: true,
  reset: true,
};
const CONSTRAINT_FIELDS: Record<keyof PanelControlConstraints, true> = {
  minSize: true,
  maxSize: true,
  collapsedSize: true,
};
const PUBLIC_CONTROL_KEYS = Object.keys(PUBLIC_CONTROL_FIELDS) as Exclude<
  keyof PanelControls,
  "constraints"
>[];
const CONSTRAINT_KEYS = Object.keys(
  CONSTRAINT_FIELDS,
) as (keyof PanelControlConstraints)[];

const INTERNAL_CONTROL_FIELDS: Record<
  Exclude<keyof InternalPanelControls, "config">,
  true
> = {
  size: true,
  renderedSize: true,
  collapsed: true,
  controlledCollapsed: true,
  autoCollapsed: true,
  applyCollapsedState: true,
  notifyCollapsedProposal: true,
  isReady: true,
  setSize: true,
  maximize: true,
  setCollapsed: true,
  collapse: true,
  expand: true,
  toggle: true,
  reset: true,
};
const CONFIG_FIELDS: Record<keyof PanelConfig, true> = {
  panelId: true,
  kind: true,
  orientation: true,
  side: true,
  defaultSize: true,
  minSize: true,
  maxSize: true,
  containerResizeBehavior: true,
  collapsible: true,
  autoCollapsible: true,
  defaultCollapsed: true,
  collapsedSize: true,
  resizableWhenCollapsed: true,
  disabled: true,
  pinned: true,
  collapseBelow: true,
  collapseBelowHysteresis: true,
  collapseBelowBehavior: true,
};
const INTERNAL_CONTROL_KEYS = Object.keys(INTERNAL_CONTROL_FIELDS) as Exclude<
  keyof InternalPanelControls,
  "config"
>[];
const CONFIG_KEYS = Object.keys(CONFIG_FIELDS) as (keyof PanelConfig)[];

/** Panels rebuild a fresh public projection every render; this comparator
 *  lets the provider store skip the commit (and all notifications) when
 *  nothing material changed. */
function shallowEqualControls(a: PanelControls, b: PanelControls): boolean {
  if (a === b) return true;
  for (const k of PUBLIC_CONTROL_KEYS) {
    if (a[k] !== b[k]) return false;
  }
  if (a.constraints === b.constraints) return true;
  for (const k of CONSTRAINT_KEYS) {
    if (a.constraints[k] !== b.constraints[k]) return false;
  }
  return true;
}

/** Gate for `publishGroupState`: numeric fields within SIZE_EPSILON count as
 *  unchanged so idle re-renders and sub-pixel jitter notify nobody. */
function panelGroupStatesEqual(
  a: PanelGroupState,
  b: PanelGroupState,
): boolean {
  return (
    a.measured === b.measured &&
    Math.abs(a.containerSize - b.containerSize) <= SIZE_EPSILON &&
    Math.abs(a.overconstrainedBy - b.overconstrainedBy) <= SIZE_EPSILON &&
    Math.abs(a.unallocatedPx - b.unallocatedPx) <= SIZE_EPSILON
  );
}

/** Comparator for the group-internal controls store. */
export function shallowEqualInternalControls(
  a: InternalPanelControls,
  b: InternalPanelControls,
): boolean {
  if (a === b) return true;
  for (const k of INTERNAL_CONTROL_KEYS) {
    if (a[k] !== b[k]) return false;
  }
  if (a.config === b.config) return true;
  for (const k of CONFIG_KEYS) {
    if (a.config[k] !== b.config[k]) return false;
  }
  return true;
}
