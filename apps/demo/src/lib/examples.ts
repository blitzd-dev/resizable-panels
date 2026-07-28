import {
  Columns3,
  Columns4,
  Gauge,
  LayoutDashboard,
  type LucideIcon,
  PanelLeft,
} from "lucide-react";

export type Example = {
  slug: string;
  title: string;
  description: string;
  Icon: LucideIcon;
};

export const EXAMPLES: Example[] = [
  {
    slug: "shadcn-sidebar",
    title: "shadcn/ui · resizable sidebar",
    description:
      "Official shadcn sidebar-07 (Base UI) with team switcher, collapsible nav, and project menus — driven by Panel resize and icon-rail collapse.",
    Icon: PanelLeft,
  },
  {
    slug: "three-panel",
    title: "3 Panel",
    description:
      "Resizable left & right panels with a flexible middle. Each side panel demotes to a sheet when the container — not the viewport — is too narrow, its state surviving the swap.",
    Icon: Columns3,
  },
  {
    slug: "four-panel",
    title: "4 Panel · IDE",
    description:
      "IDE layout: explorer · (editor splits / terminal) · inspector. Open files as peer panels in the center group; closing one hands its space back.",
    Icon: LayoutDashboard,
  },
  {
    slug: "four-vertical",
    title: "4 Vertical · email-app",
    description:
      "Four columns side-by-side: nav · list · main · inspector. Nav & inspector demote to sheets when the container narrows; the list stays inline.",
    Icon: Columns4,
  },
  {
    slug: "stress",
    title: "Stress test · nested grid",
    description:
      "Rows that collapse up/down, cells that collapse left/right, and a row of 2×2 sub-panel groups — all driven by an auto-toggler that randomly opens and closes them. Live FPS, JS-heap, and open-count monitors; push the rate and batch sliders to find the layout engine's ceiling.",
    Icon: Gauge,
  },
];
