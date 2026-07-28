import { type ReactNode, useContext } from "react";
import { createPortal } from "react-dom";
import { DemoControlsSlotContext } from "@/components/demo-controls-context";

/**
 * Marks helper controls (toggle buttons, mode switches) so the Example
 * chrome can portal them into the chrome row above the frame. The controls
 * stay in the example's source file, so the displayed code still teaches
 * the wiring. Outside that chrome (e.g. a bare render in tests), fall back
 * to rendering in place so the controls are never lost.
 */
export function DemoControls({ children }: { children: ReactNode }) {
  const slot = useContext(DemoControlsSlotContext);
  if (!slot) return <>{children}</>;
  return createPortal(children, slot);
}
