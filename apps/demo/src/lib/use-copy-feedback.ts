import { useRef, useState } from "react";

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Fall through for local HTTP previews and browsers that deny clipboard
    // permissions despite a user-initiated click.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard access unavailable");
}

/**
 * Copy `text` to the clipboard and flip `copied` on for 1.5s. Repeat copies
 * restart the timer. A legacy fallback supports local HTTP previews; failures
 * (such as a denied browser permission) are skipped silently.
 */
export function useCopyFeedback(text: string | (() => string)) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number>(undefined);

  const copy = async () => {
    try {
      const value = typeof text === "function" ? text() : text;
      if (!value) return;
      await writeClipboard(value);
      setCopied(true);
      window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — skip silently.
    }
  };

  return { copied, copy };
}
