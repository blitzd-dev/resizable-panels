import type { MDXComponents } from "mdx/types";
import {
  type ComponentProps,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ChangelogCallout,
  ChangelogChange,
  ChangelogChanges,
  ChangelogCode,
  ChangelogComparison,
  ChangelogGallery,
  ChangelogInlineCode,
  ChangelogLink,
  ChangelogMedia,
  ChangelogSection,
} from "@/components/changelog/changelog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const supportedCodeLanguages = new Set(["tsx", "ts", "jsx", "js", "bash"]);

type CodeElement = ReactElement<
  ComponentProps<"code"> & { className?: string }
>;

function MdxPre({ children, ...props }: ComponentProps<"pre">) {
  if (isValidElement(children)) {
    const code = children as CodeElement;
    const language = code.props.className?.replace("language-", "");
    const source = code.props.children;

    if (
      language &&
      supportedCodeLanguages.has(language) &&
      typeof source === "string"
    ) {
      return (
        <ChangelogCode lang={language as "tsx" | "ts" | "jsx" | "js" | "bash"}>
          {source}
        </ChangelogCode>
      );
    }
  }

  return <pre {...props}>{children}</pre>;
}

function MdxLink({ href = "", children }: ComponentProps<"a">) {
  return <ChangelogLink href={href}>{children}</ChangelogLink>;
}

function MdxTable({ children, ...props }: ComponentProps<"table">) {
  return (
    <div className="not-prose my-6 max-w-full overflow-hidden rounded-lg border border-border">
      <Table className="min-w-[32rem]" {...props}>
        {children}
      </Table>
    </div>
  );
}

function MdxTableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <TableHead
      className={cn("h-auto bg-muted/60 px-3 py-2.5", className)}
      {...props}
    />
  );
}

function MdxTableCell({ className, ...props }: ComponentProps<"td">) {
  return (
    <TableCell
      className={cn("px-3 py-2.5 whitespace-normal", className)}
      {...props}
    />
  );
}

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textContent(node.props.children);
  }
  return "";
}

function headingId(children: ReactNode) {
  return textContent(children)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function MdxH2({ children, id, ...props }: ComponentProps<"h2">) {
  const resolvedId = id ?? headingId(children);
  return (
    <h2 id={resolvedId} className="scroll-mt-6" {...props}>
      <a href={`#${resolvedId}`} className="no-underline">
        {children}
      </a>
    </h2>
  );
}

function MdxH3({ children, id, ...props }: ComponentProps<"h3">) {
  const resolvedId = id ?? headingId(children);
  return (
    <h3 id={resolvedId} className="scroll-mt-6" {...props}>
      <a href={`#${resolvedId}`} className="no-underline">
        {children}
      </a>
    </h3>
  );
}

/** Components available by name inside every changelog MDX entry. */
export const changelogMdxComponents: MDXComponents = {
  a: MdxLink,
  code: ChangelogInlineCode,
  h2: MdxH2,
  h3: MdxH3,
  pre: MdxPre,
  table: MdxTable,
  tbody: TableBody,
  td: MdxTableCell,
  tfoot: TableFooter,
  th: MdxTableHead,
  thead: TableHeader,
  tr: TableRow,
  caption: TableCaption,
  Callout: ChangelogCallout,
  Change: ChangelogChange,
  Changes: ChangelogChanges,
  Code: ChangelogCode,
  Comparison: ChangelogComparison,
  Gallery: ChangelogGallery,
  Media: ChangelogMedia,
  Section: ChangelogSection,
};
