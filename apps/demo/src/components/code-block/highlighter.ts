import langBash from "@shikijs/langs/bash";
import langJs from "@shikijs/langs/javascript";
import langJsx from "@shikijs/langs/jsx";
import langTsx from "@shikijs/langs/tsx";
import langTs from "@shikijs/langs/typescript";
import themeDark from "@shikijs/themes/one-dark-pro";
import themeLight from "@shikijs/themes/one-light";
import { createHighlighterCoreSync, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

export type CodeBlockLang = "tsx" | "ts" | "jsx" | "js" | "bash";

let highlighter: HighlighterCore | undefined;

function getHighlighter(): HighlighterCore {
  highlighter ??= createHighlighterCoreSync({
    themes: [themeLight, themeDark],
    langs: [langJs, langJsx, langTs, langTsx, langBash],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter;
}

/** Highlight trusted local samples. Loaded via dynamic import so grammars stay
 * out of the initial route chunk. */
export function highlightCode(code: string, lang: CodeBlockLang) {
  return getHighlighter().codeToHtml(code, {
    lang,
    themes: { light: "one-light", dark: "one-dark-pro" },
    defaultColor: false,
  });
}
