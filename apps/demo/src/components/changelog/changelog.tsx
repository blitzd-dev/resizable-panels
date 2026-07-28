import {
  ArrowLeft,
  GitCompare,
  Plus,
  RefreshCw,
  ShieldAlert,
  Tag,
  Trash2,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { CodeBlock } from "@/components/code-block";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ChangelogChangeKind =
  | "added"
  | "changed"
  | "deprecated"
  | "removed"
  | "fixed"
  | "security";

export type ChangelogReleaseData = {
  version: string;
  date?: string;
  title: string;
  summary: ReactNode;
  id: string;
  href: string;
  latest?: boolean;
  yanked?: boolean;
  releaseUrl?: string;
  compareUrl?: string;
  children: ReactNode;
};

const kindStyles: Record<
  ChangelogChangeKind,
  { label: string; className: string; Icon: typeof Plus }
> = {
  added: {
    label: "Added",
    className: "bg-primary/10 text-primary",
    Icon: Plus,
  },
  changed: {
    label: "Changed",
    className:
      "bg-sky-500/10 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300",
    Icon: RefreshCw,
  },
  deprecated: {
    label: "Deprecated",
    className:
      "bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
    Icon: TriangleAlert,
  },
  removed: {
    label: "Removed",
    className:
      "bg-red-500/10 text-red-700 dark:bg-red-400/10 dark:text-red-300",
    Icon: Trash2,
  },
  fixed: {
    label: "Fixed",
    className:
      "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
    Icon: Wrench,
  },
  security: {
    label: "Security",
    className:
      "bg-rose-500/10 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300",
    Icon: ShieldAlert,
  },
};

const releaseDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

function formatReleaseDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return Number.isNaN(parsedDate.getTime())
    ? date
    : releaseDateFormatter.format(parsedDate);
}

function ChangelogReleaseLinks({
  releaseUrl,
  compareUrl,
}: {
  releaseUrl?: string;
  compareUrl?: string;
}) {
  if (!releaseUrl && !compareUrl) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1">
      {releaseUrl && (
        <a
          href={releaseUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(
            buttonVariants({ variant: "ghost", size: "xs" }),
            "-ml-2",
          )}
        >
          <Tag className="size-3.5" />
          GitHub release
        </a>
      )}
      {compareUrl && (
        <a
          href={compareUrl}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "ghost", size: "xs" })}
        >
          <GitCompare className="size-3.5" />
          Compare changes
        </a>
      )}
    </div>
  );
}

function ChangelogBody({ children }: { children: ReactNode }) {
  return (
    <div className="prose prose-sm mt-8 min-w-0 max-w-none prose-headings:font-mono prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-foreground prose-a:decoration-border prose-a:underline-offset-4 prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-normal prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-primary/40 prose-blockquote:text-muted-foreground prose-hr:border-border dark:prose-invert">
      {children}
    </div>
  );
}

export function ChangelogTimeline({ children }: { children: ReactNode }) {
  return (
    <div className="mt-12 min-w-0 space-y-12 md:space-y-16">{children}</div>
  );
}

export function ChangelogRelease({
  version,
  date,
  title,
  summary,
  id,
  href,
  latest,
  yanked,
  releaseUrl,
  compareUrl,
  children,
}: ChangelogReleaseData) {
  return (
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 border-b border-border pb-12 last:border-b-0 last:pb-0 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-12 md:pb-16">
      <aside className="min-w-0 rounded-md bg-muted/60 px-3 py-2 md:sticky md:top-6 md:z-10 md:self-start md:rounded-none md:bg-transparent md:px-0 md:py-0 md:pt-1">
        <div className="flex items-baseline justify-between gap-3 md:block">
          <Link
            to={href}
            className="font-mono text-base font-semibold text-foreground hover:text-primary md:text-sm"
          >
            {version}
          </Link>
          {date && (
            <time
              dateTime={date}
              className="text-sm font-medium text-foreground/70 md:mt-2 md:block md:text-xs md:font-normal md:text-muted-foreground"
            >
              {formatReleaseDate(date)}
            </time>
          )}
        </div>
      </aside>

      <article className="relative min-w-0">
        <div
          aria-hidden="true"
          className="absolute top-1 -left-[3.38rem] hidden size-2 rounded-full border-2 border-background bg-border md:block"
        />
        <div
          aria-hidden="true"
          className="absolute top-3 -bottom-16 -left-[3.2rem] hidden w-px bg-border md:block"
        />

        <div className="flex flex-wrap items-center gap-3">
          <h2
            id={id}
            className="scroll-mt-6 text-xl font-semibold tracking-tight sm:text-2xl"
          >
            <Link
              to={href}
              className="hover:underline hover:underline-offset-4"
            >
              {title}
            </Link>
          </h2>
          {latest && <Badge variant="default">Latest</Badge>}
          {yanked && (
            <Badge variant="outline" className="text-destructive">
              Yanked
            </Badge>
          )}
        </div>
        <div className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {summary}
        </div>

        <ChangelogReleaseLinks
          releaseUrl={releaseUrl}
          compareUrl={compareUrl}
        />

        <ChangelogBody>{children}</ChangelogBody>
      </article>
    </section>
  );
}

export function ChangelogReleaseDetail({
  version,
  date,
  title,
  summary,
  id,
  latest,
  yanked,
  releaseUrl,
  compareUrl,
  children,
}: Omit<ChangelogReleaseData, "href">) {
  return (
    <article className="mx-auto min-w-0 max-w-3xl">
      <header className="border-b border-border pb-10 sm:pb-12">
        <Link
          to="/changelog"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All releases
        </Link>

        <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-mono text-sm font-semibold text-primary">
            Version {version}
          </span>
          {date && (
            <>
              <span
                aria-hidden="true"
                className="size-1 rounded-full bg-border"
              />
              <time dateTime={date} className="text-sm text-muted-foreground">
                {formatReleaseDate(date)}
              </time>
            </>
          )}
          {latest && <Badge variant="default">Latest</Badge>}
          {yanked && (
            <Badge variant="outline" className="text-destructive">
              Yanked
            </Badge>
          )}
        </div>

        <h1
          id={id}
          className="mt-5 scroll-mt-6 font-mono text-4xl font-semibold tracking-tight text-balance sm:text-5xl"
        >
          {title}
        </h1>
        <div className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          {summary}
        </div>

        <ChangelogReleaseLinks
          releaseUrl={releaseUrl}
          compareUrl={compareUrl}
        />
      </header>

      <ChangelogBody>{children}</ChangelogBody>
    </article>
  );
}

export function ChangelogChanges({
  kind,
  children,
}: {
  kind: ChangelogChangeKind;
  children: ReactNode;
}) {
  const style = kindStyles[kind];

  return (
    <section className="not-prose my-8">
      <div className="flex items-center gap-3">
        <Badge
          variant="secondary"
          className={cn("gap-1.5 border-0", style.className)}
        >
          <style.Icon className="size-3" />
          {style.label}
        </Badge>
        <div aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      <ul className="mt-4 list-disc space-y-5 pl-5 marker:text-muted-foreground/60">
        {children}
      </ul>
    </section>
  );
}

export function ChangelogChange({
  title,
  breaking = false,
  children,
}: {
  title: string;
  breaking?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="pl-1">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {breaking && (
          <Badge
            variant="outline"
            className="border-destructive/30 text-destructive"
          >
            Breaking
          </Badge>
        )}
      </div>
      <div className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </li>
  );
}

export function ChangelogSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10 space-y-4 text-sm leading-relaxed text-muted-foreground">
      {title && (
        <h3 className="font-mono text-sm font-semibold text-foreground">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

export function ChangelogCode({
  children,
  lang = "tsx",
  caption,
}: {
  children: string;
  lang?: "tsx" | "ts" | "jsx" | "js" | "bash";
  caption?: string;
}) {
  return (
    <figure className="not-prose my-6 min-w-0 max-w-full space-y-2">
      <CodeBlock code={children} lang={lang} />
      {caption && (
        <figcaption className="text-xs text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

type ChangelogMediaProps = {
  src: string;
  caption?: string;
  className?: string;
} & (
  | {
      type?: "image";
      alt: string;
    }
  | {
      type: "video";
      label: string;
      poster?: string;
      captions: {
        src: string;
        srcLang: string;
        label: string;
      };
    }
);

export function ChangelogMedia(props: ChangelogMediaProps) {
  const { src, caption, className } = props;

  return (
    <figure
      className={cn(
        "not-prose my-6 w-full min-w-0 max-w-full space-y-2",
        className,
      )}
    >
      <Card className="gap-0 overflow-hidden py-0">
        {props.type === "video" ? (
          <video
            controls
            playsInline
            preload="metadata"
            poster={props.poster}
            aria-label={props.label}
            className="block h-auto w-full"
          >
            <source src={src} />
            <track
              kind="captions"
              src={props.captions.src}
              srcLang={props.captions.srcLang}
              label={props.captions.label}
              default
            />
          </video>
        ) : (
          <img
            src={src}
            alt={props.alt}
            loading="lazy"
            className="block h-auto w-full"
          />
        )}
      </Card>
      {caption && (
        <figcaption className="text-xs text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export function ChangelogGallery({
  children,
  columns = 2,
  label = "Release media",
}: {
  children: ReactNode;
  columns?: 2 | 3;
  label?: string;
}) {
  const mediaCount = Children.toArray(children).filter(isValidElement).length;
  const balanceThreeColumnRemainder = columns === 3 && mediaCount % 3 === 2;

  return (
    <section aria-label={label} className="not-prose my-6">
      <div
        className={cn(
          "grid gap-3 [&>figure]:my-0 [&>figure]:max-w-none",
          columns === 2
            ? "sm:grid-cols-2"
            : "sm:grid-cols-6 sm:[&>figure]:col-span-2",
          balanceThreeColumnRemainder &&
            "sm:[&>figure:nth-last-child(2)]:col-span-3 sm:[&>figure:last-child]:col-span-3",
        )}
      >
        {children}
      </div>
    </section>
  );
}

type ComparisonImage = {
  src: string;
  alt: string;
  label: string;
};

const comparisonRatios = {
  "1/1": "aspect-square",
  "3/2": "aspect-3/2",
  "4/3": "aspect-4/3",
  "16/9": "aspect-video",
};

export function ChangelogComparison({
  before,
  after,
  caption,
  aspectRatio = "4/3",
  fit = "cover",
}: {
  before: ComparisonImage;
  after: ComparisonImage;
  caption?: string;
  aspectRatio?: keyof typeof comparisonRatios;
  fit?: "cover" | "contain";
}) {
  const imageClassName = cn(
    "block size-full",
    fit === "cover" ? "object-cover" : "object-contain",
  );

  return (
    <figure className="not-prose my-6 space-y-2">
      <Card className="grid gap-0 overflow-hidden py-0 sm:grid-cols-2">
        {[before, after].map((image, index) => (
          <div
            key={image.label}
            className={cn(
              index === 1 && "border-t border-border sm:border-t-0 sm:border-l",
            )}
          >
            <div
              className={cn(
                "relative overflow-hidden bg-muted",
                comparisonRatios[aspectRatio],
              )}
            >
              <img
                src={image.src}
                alt={image.alt}
                loading="lazy"
                className={imageClassName}
              />
              <Badge
                variant="secondary"
                className="absolute top-2 left-2 shadow-sm"
              >
                {image.label}
              </Badge>
            </div>
          </div>
        ))}
      </Card>
      {caption && (
        <figcaption className="text-xs text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export function ChangelogCallout({ children }: { children: ReactNode }) {
  return (
    <Card className="not-prose my-6 border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-foreground">
      {children}
    </Card>
  );
}

export function ChangelogLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const external = href.startsWith("http");
  const className =
    "font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-primary";

  if (!external) {
    return (
      <Link to={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  );
}

export function ChangelogInlineCode({
  children,
  className,
  ...props
}: ComponentProps<"code">) {
  return (
    <code
      className={cn(
        "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </code>
  );
}
