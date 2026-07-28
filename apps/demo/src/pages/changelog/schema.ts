export type ChangelogReleaseMeta = {
  slug: string;
  version: string;
  date?: string;
  title: string;
  summary: string;
  latest?: boolean;
  draft?: boolean;
  yanked?: boolean;
  releaseUrl?: string;
  compareUrl?: string;
};

export type ChangelogMetaEntry = {
  source: string;
  meta: ChangelogReleaseMeta;
};

const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const datedSlug = /^\d{4}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const githubReleaseUrl =
  /^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/tag\/[^/]+$/;
const githubCompareUrl =
  /^https:\/\/github\.com\/[^/]+\/[^/]+\/compare\/[^/]+$/;

export function isChangelogReleaseMeta(
  value: unknown,
): value is ChangelogReleaseMeta {
  if (!value || typeof value !== "object") return false;
  const meta = value as Partial<ChangelogReleaseMeta>;
  return (
    typeof meta.slug === "string" &&
    typeof meta.version === "string" &&
    typeof meta.title === "string" &&
    typeof meta.summary === "string" &&
    (meta.date === undefined || /^\d{4}-\d{2}-\d{2}$/.test(meta.date)) &&
    (meta.latest === undefined || typeof meta.latest === "boolean") &&
    (meta.draft === undefined || typeof meta.draft === "boolean") &&
    (meta.yanked === undefined || typeof meta.yanked === "boolean") &&
    (meta.releaseUrl === undefined || typeof meta.releaseUrl === "string") &&
    (meta.compareUrl === undefined || typeof meta.compareUrl === "string")
  );
}

export function changelogReleaseId(slug: string) {
  return `release-${slug.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function validateChangelogRelease(
  meta: ChangelogReleaseMeta,
  source: string,
) {
  const unreleased = meta.version === "Unreleased";

  if (unreleased ? meta.slug !== "unreleased" : !datedSlug.test(meta.slug)) {
    throw new Error(`Invalid changelog slug: ${source}`);
  }
  if (unreleased && meta.date) {
    throw new Error(
      `Unreleased changelog entry must not have a date: ${source}`,
    );
  }
  if (!unreleased && !semver.test(meta.version)) {
    throw new Error(`Changelog version must use SemVer: ${source}`);
  }
  if (!unreleased && !meta.date) {
    throw new Error(
      `Published changelog entry must have an ISO date: ${source}`,
    );
  }
  if (unreleased && meta.latest) {
    throw new Error(
      `Unreleased cannot be marked as the latest release: ${source}`,
    );
  }
  if (meta.yanked && meta.latest) {
    throw new Error(`A yanked release cannot be marked latest: ${source}`);
  }
  if (meta.releaseUrl && !githubReleaseUrl.test(meta.releaseUrl)) {
    throw new Error(`Invalid GitHub release URL: ${source}`);
  }
  if (meta.compareUrl && !githubCompareUrl.test(meta.compareUrl)) {
    throw new Error(`Invalid GitHub compare URL: ${source}`);
  }
}

export function validateChangelogCollection(entries: ChangelogMetaEntry[]) {
  const versions = new Set<string>();
  const slugs = new Set<string>();

  for (const { source, meta } of entries) {
    validateChangelogRelease(meta, source);
    if (versions.has(meta.version)) {
      throw new Error(`Duplicate changelog version: ${meta.version}`);
    }
    if (slugs.has(meta.slug)) {
      throw new Error(`Duplicate changelog slug: ${meta.slug}`);
    }
    versions.add(meta.version);
    slugs.add(meta.slug);
  }

  const publishedEntries = entries.filter(({ meta }) => !meta.draft);
  const latestCount = publishedEntries.filter(({ meta }) => meta.latest).length;
  const unreleasedCount = publishedEntries.filter(
    ({ meta }) => meta.version === "Unreleased",
  ).length;

  if (latestCount > 1) {
    throw new Error("Only one published changelog entry can be marked latest");
  }
  if (unreleasedCount > 1) {
    throw new Error("The changelog can contain at most one Unreleased entry");
  }
}
