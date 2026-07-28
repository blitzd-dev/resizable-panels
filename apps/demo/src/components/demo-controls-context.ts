import { createContext } from "react";

/**
 * Slot contract between a docs example and the Example chrome that frames
 * it. See `DemoControls` for the portal side.
 */
export const DemoControlsSlotContext = createContext<HTMLDivElement | null>(
  null,
);
