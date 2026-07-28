import type { ComponentType } from "react";
import { AccessibilityDoc } from "./content/accessibility";
import { BuildingLayoutsDoc } from "./content/building-layouts";
import { CollapsingDoc } from "./content/collapsing";
import { ControlledStateDoc } from "./content/controlled-state";
import { ImperativeAndActionsDoc } from "./content/imperative-and-actions";
import { InstallationDoc } from "./content/installation";
import { IntroductionDoc } from "./content/introduction";
import { MentalModelDoc } from "./content/mental-model";
import { PanelDoc } from "./content/panel";
import { PanelGroupDoc } from "./content/panel-group";
import { PanelResizeHandleDoc } from "./content/panel-resize-handle";
import { PersistenceDoc } from "./content/persistence";
import { ProviderAndHooksDoc } from "./content/provider-and-hooks";
import { ReadingStateDoc } from "./content/reading-state";
import { ResponsiveDoc } from "./content/responsive";
import { SizingDoc } from "./content/sizing";
import { StylingAndSlotPropsDoc } from "./content/styling-and-slot-props";
import {
  ActionTypesDoc,
  ComponentPropsTypesDoc,
  LayoutTypesDoc,
  PersistenceTypesDoc,
  ProviderHookTypesDoc,
  ValueEventTypesDoc,
} from "./content/types";
import {
  DOC_GROUP_META,
  DOCS_HOME,
  type DocGroupMeta,
  type DocPageMeta,
  groupMetaForPage,
  redirectForDocSlug,
} from "./doc-meta";

export type DocPage = DocPageMeta & {
  Body: ComponentType;
};

export type DocGroup = Omit<DocGroupMeta, "pages"> & {
  pages: [DocPage, ...DocPage[]];
};

export { DOCS_HOME, redirectForDocSlug };

const BODIES: Record<string, ComponentType> = {
  introduction: IntroductionDoc,
  installation: InstallationDoc,
  "mental-model": MentalModelDoc,
  "building-layouts": BuildingLayoutsDoc,
  sizing: SizingDoc,
  collapsing: CollapsingDoc,
  "controlled-state": ControlledStateDoc,
  persistence: PersistenceDoc,
  "imperative-and-actions": ImperativeAndActionsDoc,
  "reading-state": ReadingStateDoc,
  "styling-and-slot-props": StylingAndSlotPropsDoc,
  responsive: ResponsiveDoc,
  accessibility: AccessibilityDoc,
  "panel-group": PanelGroupDoc,
  panel: PanelDoc,
  "panel-resize-handle": PanelResizeHandleDoc,
  "provider-and-hooks": ProviderAndHooksDoc,
  "component-props": ComponentPropsTypesDoc,
  "layout-types": LayoutTypesDoc,
  "value-event-types": ValueEventTypesDoc,
  "action-types": ActionTypesDoc,
  "provider-hook-types": ProviderHookTypesDoc,
  "persistence-types": PersistenceTypesDoc,
};

function withBody(page: DocPageMeta): DocPage {
  const Body = BODIES[page.slug];
  if (!Body) {
    throw new Error(`Missing docs body for slug "${page.slug}"`);
  }
  return { ...page, Body };
}

export const DOC_GROUPS: DocGroup[] = DOC_GROUP_META.map((group) => {
  const pages = group.pages.map(withBody) as [DocPage, ...DocPage[]];
  return { ...group, pages };
});

export const DOC_PAGES: DocPage[] = DOC_GROUPS.flatMap((group) => group.pages);

export function groupForPage(slug: string): DocGroup | undefined {
  const meta = groupMetaForPage(slug);
  if (!meta) return undefined;
  return DOC_GROUPS.find((group) => group.slug === meta.slug);
}
