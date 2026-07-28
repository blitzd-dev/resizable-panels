import { useCallback, useState } from "react";
import type { FloatingPanelMenuPersistence } from "./floating-panel-menu";

/**
 * State backing the floating menu's persistence section. Both the switch and
 * remount button re-key the subtree holding the group, while PanelProvider
 * stays mounted so the menu's dragged position survives.
 */
export function useDemoPersistence(storageKey: string, defaultOn = true) {
  const [enabled, setEnabled] = useState(defaultOn);
  const [mountKey, setMountKey] = useState(0);

  const onRemount = useCallback(() => setMountKey((k) => k + 1), []);
  const onToggle = useCallback((on: boolean) => {
    setEnabled(on);
    setMountKey((k) => k + 1);
  }, []);

  return {
    persistenceKey: enabled ? storageKey : undefined,
    groupKey: mountKey,
    persistence: {
      enabled,
      onToggle,
      onRemount,
    } satisfies FloatingPanelMenuPersistence,
  };
}
