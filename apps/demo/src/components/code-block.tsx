import { Check, Copy } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import type { CodeBlockLang } from "@/components/code-block/highlighter";
import { Button } from "@/components/ui/button";
import { useCopyFeedback } from "@/lib/use-copy-feedback";

export type { CodeBlockLang };

/**
 * Shiki code block shared by the docs and demo pages. The highlighter chunk
 * (grammars + themes) loads on first mount so it stays out of the critical
 * path. Both themes are baked into CSS variables in one pass, so toggling
 * `.dark` restyles instantly (see the `.code-block` rules in index.css).
 */
export function CodeBlock({
  code,
  lang = "tsx",
  lineNumbers = true,
}: {
  code: string;
  lang?: CodeBlockLang;
  lineNumbers?: boolean;
}) {
  const source = code.trim();
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("@/components/code-block/highlighter").then(
      ({ highlightCode }) => {
        if (!cancelled) setHtml(highlightCode(source, lang));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, lang]);

  const gutterDigits = String(source.split("\n").length).length;

  return (
    <div
      className="code-block group relative min-w-0 max-w-full"
      data-line-numbers={lineNumbers || undefined}
      data-code-language={lang}
      style={{ "--code-gutter": `${gutterDigits}ch` } as CSSProperties}
    >
      <CopyButton text={source} />
      {html ? (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki output rendered from local, trusted code samples — the code text itself is escaped by Shiki.
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="overflow-x-auto p-4 font-mono text-[0.8125rem] leading-relaxed">
          <code>{source}</code>
        </pre>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const { copied, copy } = useCopyFeedback(text);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Copy code"
      className="absolute top-1.5 right-1.5 bg-card text-muted-foreground hover:text-foreground"
      onClick={copy}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}
