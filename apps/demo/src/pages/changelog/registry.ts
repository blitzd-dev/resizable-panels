import type { MDXProps } from "mdx/types";
import type { ComponentType } from "react";
import { generatedChangelogMetadata } from "./generated-metadata";
import {
  type ChangelogReleaseMeta,
  changelogReleaseId,
  isChangelogReleaseMeta,
  validateChangelogCollection,
} from "./schema";

type ChangelogReleaseModule = {
  default: ComponentType<MDXProps>;
};

export type ChangelogReleaseEntry = {
  source: string;
  id: string;
  meta: ChangelogReleaseMeta;
  Content: ComponentType<MDXProps>;
};

const contentModules = import.meta.glob<ChangelogReleaseModule>(
  "./entries/*.mdx",
  { eager: true },
);

function buildRegistry(): ChangelogReleaseEntry[] {
  const metadataEntries = generatedChangelogMetadata.map(({ source, meta }) => {
    if (!isChangelogReleaseMeta(meta)) {
      throw new Error(`Invalid changelog metadata in ${source}`);
    }
    return { source, meta: meta as ChangelogReleaseMeta };
  });

  validateChangelogCollection(metadataEntries);

  return metadataEntries
    .sort(({ source: left }, { source: right }) => right.localeCompare(left))
    .filter(({ meta }) => !meta.draft)
    .map(({ source, meta }) => {
      const contentModule = contentModules[source];
      if (!contentModule) {
        throw new Error(`Missing changelog content loader for ${source}`);
      }

      return {
        source,
        id: changelogReleaseId(meta.slug),
        meta,
        Content: contentModule.default,
      };
    });
}

/** Metadata and bodies are eager so the index renders at its final size. */
export const changelogReleases = buildRegistry();

export function changelogReleaseBySlug(slug: string) {
  return changelogReleases.find((release) => release.meta.slug === slug);
}
