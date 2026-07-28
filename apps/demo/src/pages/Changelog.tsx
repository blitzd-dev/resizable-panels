import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import {
  ChangelogRelease,
  ChangelogReleaseDetail,
  ChangelogTimeline,
} from "@/components/changelog/changelog";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { changelogMdxComponents } from "@/pages/changelog/mdx-components";
import {
  changelogReleaseBySlug,
  changelogReleases,
} from "@/pages/changelog/registry";

export default function Changelog() {
  const { slug } = useParams();
  const selectedRelease = slug ? changelogReleaseBySlug(slug) : undefined;

  if (slug && !selectedRelease) {
    return <ChangelogNotFound slug={slug} />;
  }

  if (selectedRelease) {
    const { id, meta, Content } = selectedRelease;

    return (
      <div className="min-h-full bg-background px-6 py-10 text-foreground sm:py-16">
        <ChangelogReleaseDetail
          version={meta.version}
          id={id}
          date={meta.date}
          title={meta.title}
          summary={<p>{meta.summary}</p>}
          latest={meta.latest}
          yanked={meta.yanked}
          releaseUrl={meta.releaseUrl}
          compareUrl={meta.compareUrl}
        >
          <Content components={changelogMdxComponents} />
        </ChangelogReleaseDetail>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-16">
        <header className="border-b border-border pb-10 sm:pb-12">
          <div className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-primary">
            Release notes
          </div>
          <div className="mt-4">
            <h1 className="font-mono text-4xl font-semibold tracking-tight sm:text-5xl">
              Changelog
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
              New primitives, refinements, and fixes for
              <span className="font-mono text-sm text-foreground">
                {" "}
                @blitzd/resizable-panels
              </span>
              .
            </p>
          </div>
        </header>

        {changelogReleases.length === 0 && (
          <p className="mt-10 max-w-xl text-sm leading-relaxed text-muted-foreground">
            No releases yet. Release notes will appear here with the first
            published version.
          </p>
        )}

        <ChangelogTimeline>
          {changelogReleases.map(({ source, id, meta, Content }) => (
            <ChangelogRelease
              key={source}
              version={meta.version}
              id={id}
              href={`/changelog/${meta.slug}`}
              date={meta.date}
              title={meta.title}
              summary={<p>{meta.summary}</p>}
              latest={meta.latest}
              yanked={meta.yanked}
              releaseUrl={meta.releaseUrl}
              compareUrl={meta.compareUrl}
            >
              <Content components={changelogMdxComponents} />
            </ChangelogRelease>
          ))}
        </ChangelogTimeline>
      </div>
    </div>
  );
}

function ChangelogNotFound({ slug }: { slug: string }) {
  return (
    <div className="min-h-full bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-2xl">
        <div className="font-mono text-xs font-medium uppercase tracking-[0.18em] text-primary">
          404 · Changelog
        </div>
        <h1 className="mt-3 font-mono text-3xl font-semibold tracking-tight sm:text-4xl">
          Release note not found
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          There is no published changelog entry for{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
            {slug}
          </code>
          . It may have moved, remained a draft, or never existed.
        </p>
        <Card className="mt-8 flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium">Browse published releases</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Return to the changelog index to find the current release notes.
            </p>
          </div>
          <Link
            to="/changelog"
            className={buttonVariants({ variant: "secondary" })}
          >
            <ArrowLeft className="size-4" />
            All releases
          </Link>
        </Card>
      </div>
    </div>
  );
}
