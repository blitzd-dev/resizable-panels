import { createContext, useContext, useState } from "react";

type SidebarSlot = {
  el: HTMLDivElement | null;
  setEl: (el: HTMLDivElement | null) => void;
};

export const SidebarSlotContext = createContext<SidebarSlot>({
  el: null,
  setEl: () => {},
});

export function useSidebarSlot() {
  return useContext(SidebarSlotContext);
}

export function useSidebarSlotProvider(): SidebarSlot {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  return { el, setEl };
}
