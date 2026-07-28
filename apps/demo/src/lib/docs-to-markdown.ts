import { SITE_URL } from "./site";

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ");
}

function block(value: string) {
  const trimmed = value.trim();
  return trimmed ? `\n\n${trimmed}\n\n` : "";
}

function inlineChildren(element: Element, baseUrl: string) {
  return Array.from(element.childNodes)
    .map((node) => renderNode(node, baseUrl))
    .join("");
}

function tableCell(cell: HTMLTableCellElement, baseUrl: string) {
  return inlineChildren(cell, baseUrl).trim().replace(/\|/g, "\\|");
}

function isElement(node: Node): node is Element {
  // Prefer nodeType over `instanceof` so JSDOM nodes work in Node prerender.
  return node.nodeType === 1;
}

function renderList(element: Element, ordered: boolean, baseUrl: string) {
  const items = Array.from(element.children).filter(
    (child): child is HTMLLIElement => child.tagName === "LI",
  );
  const lines = items.map((item, index) => {
    const content = Array.from(item.childNodes)
      .filter(
        (child) => !(isElement(child) && ["UL", "OL"].includes(child.tagName)),
      )
      .map((child) => renderNode(child, baseUrl))
      .join("")
      .trim();
    return `${ordered ? `${index + 1}.` : "-"} ${content}`;
  });
  return block(lines.join("\n"));
}

function renderTable(table: HTMLTableElement, baseUrl: string) {
  const rows = Array.from(table.rows);
  if (rows.length === 0) return "";

  const values = rows.map((row) =>
    Array.from(row.cells).map((cell) => tableCell(cell, baseUrl)),
  );
  const [header, ...body] = values;
  if (!header || header.length === 0) return "";

  const formatRow = (cells: string[]) => `| ${cells.join(" | ")} |`;
  return block(
    [
      formatRow(header),
      formatRow(header.map(() => "---")),
      ...body.map(formatRow),
    ].join("\n"),
  );
}

/** Absolute URL for markdown links — always the public site, never localhost. */
function absoluteHref(href: string, baseUrl: string) {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return "";
  }
}

function renderAlert(element: Element, baseUrl: string) {
  const title = element.querySelector('[data-slot="alert-title"]');
  const description = element.querySelector('[data-slot="alert-description"]');
  const parts: string[] = [];
  if (title) {
    const text = inlineChildren(title, baseUrl).trim();
    if (text) parts.push(`**${text}**`);
  }
  if (description) {
    const text = Array.from(description.childNodes)
      .map((node) => renderNode(node, baseUrl))
      .join("")
      .trim();
    if (text) parts.push(text);
  }
  return block(parts.join("\n\n"));
}

function renderFigcaption(element: Element, baseUrl: string) {
  // Title + caption are sibling lines; keep them as separate paragraphs so
  // they do not smash together the way adjacent inline spans would.
  const parts = Array.from(element.children)
    .map((child) => inlineChildren(child, baseUrl).trim())
    .filter(Boolean);
  return block(parts.join("\n\n"));
}

function renderNode(node: Node, baseUrl: string): string {
  if (node.nodeType === 3) {
    return collapseWhitespace(node.textContent ?? "");
  }
  if (!isElement(node)) return "";
  if (
    node.hasAttribute("data-markdown-exclude") ||
    node.matches("button, svg")
  ) {
    return "";
  }

  if (
    node.getAttribute("role") === "alert" ||
    node.getAttribute("data-slot") === "alert"
  ) {
    return renderAlert(node, baseUrl);
  }

  switch (node.tagName) {
    case "H1":
    case "H2":
    case "H3":
    case "H4":
    case "H5":
    case "H6": {
      const level = Number(node.tagName.slice(1));
      return block(`${"#".repeat(level)} ${inlineChildren(node, baseUrl)}`);
    }
    case "P":
      return block(inlineChildren(node, baseUrl));
    case "FIGCAPTION":
      return renderFigcaption(node, baseUrl);
    case "PRE": {
      const code = node.textContent?.trim() ?? "";
      const language = node.closest<HTMLElement>("[data-code-language]")
        ?.dataset.codeLanguage;
      return block(`\`\`\`${language ?? ""}\n${code}\n\`\`\``);
    }
    case "CODE": {
      const value = node.textContent ?? "";
      const delimiter = value.includes("`") ? "``" : "`";
      return `${delimiter}${value}${delimiter}`;
    }
    case "A": {
      const href = node.getAttribute("href");
      const destination = href ? absoluteHref(href, baseUrl) : "";
      const label = collapseWhitespace(node.textContent ?? "").trim();
      return destination ? `[${label}](${destination})` : label;
    }
    case "STRONG":
    case "B":
      return `**${inlineChildren(node, baseUrl)}**`;
    case "EM":
    case "I":
      return `*${inlineChildren(node, baseUrl)}*`;
    case "BR":
      return "\n";
    case "UL":
      return renderList(node, false, baseUrl);
    case "OL":
      return renderList(node, true, baseUrl);
    case "TABLE":
      return renderTable(node as HTMLTableElement, baseUrl);
    case "HR":
      return block("---");
    default:
      return inlineChildren(node, baseUrl);
  }
}

export type DocsToMarkdownOptions = {
  /** Intro lede shown under the page H1 on the HTML docs. */
  description?: string;
  /**
   * Public URL of this docs page. Used as the base for relative and hash
   * links so every markdown link is an absolute `https://…` URL.
   */
  pageUrl?: string;
};

/** Convert the semantic content of a rendered docs page into portable Markdown. */
export function docsToMarkdown(
  title: string,
  content: Element,
  options: DocsToMarkdownOptions = {},
) {
  const baseUrl = options.pageUrl ?? SITE_URL;
  const lede = options.description?.trim()
    ? `\n\n${options.description.trim()}\n`
    : "\n";
  const body = Array.from(content.childNodes)
    .map((node) => renderNode(node, baseUrl))
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return `# ${title}${lede}\n${body}\n`;
}
