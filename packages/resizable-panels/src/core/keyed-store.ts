/**
 * Minimal external store over a keyed map, designed for
 * `useSyncExternalStore`. Values that change on every drag tick (panel
 * controls, peer sizes, docked effective sizes) live here instead of React
 * state so a change notifies only the components subscribed to the affected
 * key — instead of recreating a context value and re-rendering every
 * consumer in the tree.
 */
export type KeyedStore<K, V> = {
  get(key: K): V | undefined;
  /** The live backing map. Read-only by contract — iterate or copy, never
   *  mutate. Reference identity is NOT stable across changes; use
   *  `version()` to detect them. */
  getMap(): ReadonlyMap<K, V>;
  size(): number;
  /** Monotonic counter, bumped on every committed change. Usable as a
   *  `useSyncExternalStore` snapshot to react to any change cheaply. */
  version(): number;
  /** Set one key. No-op (no notification) when the store's equality says
   *  the value is unchanged. */
  set(key: K, value: V): void;
  delete(key: K): void;
  /** Replace the full contents with `next`, notifying only keys whose
   *  value was added, removed, or changed under the store's equality.
   *  No-op when nothing differs. */
  replaceAll(next: Map<K, V>): void;
  subscribeKey(key: K, cb: () => void): () => void;
  subscribeAny(cb: () => void): () => void;
};

export function createKeyedStore<K, V>(
  equals: (a: V, b: V) => boolean = Object.is,
): KeyedStore<K, V> {
  const map = new Map<K, V>();
  const keyListeners = new Map<K, Set<() => void>>();
  const anyListeners = new Set<() => void>();
  let version = 0;

  // Copy listener sets before invoking: a callback may subscribe/unsubscribe
  // (e.g. React re-subscribing on re-render) without corrupting iteration.
  const notify = (keys: Iterable<K>) => {
    version++;
    for (const k of keys) {
      const set = keyListeners.get(k);
      if (set) for (const cb of [...set]) cb();
    }
    for (const cb of [...anyListeners]) cb();
  };

  return {
    get: (k) => map.get(k),
    getMap: () => map,
    size: () => map.size,
    version: () => version,
    set(k, v) {
      if (map.has(k) && equals(map.get(k) as V, v)) return;
      map.set(k, v);
      notify([k]);
    },
    delete(k) {
      if (!map.delete(k)) return;
      notify([k]);
    },
    replaceAll(next) {
      const changed: K[] = [];
      for (const [k, v] of next) {
        if (!map.has(k) || !equals(map.get(k) as V, v)) changed.push(k);
      }
      for (const k of map.keys()) {
        if (!next.has(k)) changed.push(k);
      }
      if (changed.length === 0) return;
      map.clear();
      for (const [k, v] of next) map.set(k, v);
      notify(changed);
    },
    subscribeKey(k, cb) {
      let set = keyListeners.get(k);
      if (!set) {
        set = new Set();
        keyListeners.set(k, set);
      }
      set.add(cb);
      return () => {
        set.delete(cb);
        if (set.size === 0) keyListeners.delete(k);
      };
    },
    subscribeAny(cb) {
      anyListeners.add(cb);
      return () => {
        anyListeners.delete(cb);
      };
    },
  };
}
