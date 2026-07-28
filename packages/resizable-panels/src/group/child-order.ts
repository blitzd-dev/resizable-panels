import type { ChildEntry } from "./group-context.js";

export function sameEntry(a: ChildEntry, b: ChildEntry): boolean {
  return a.kind === b.kind && a.token === b.token;
}

export function duplicatePanelId(
  entries: readonly ChildEntry[],
): string | null {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!entry.panelId) continue;
    if (seen.has(entry.panelId)) return entry.panelId;
    seen.add(entry.panelId);
  }
  return null;
}

export function sortChildrenByDomOrder(entries: ChildEntry[]): ChildEntry[] {
  return [...entries].sort((a, b) => {
    const aElement = a.getElement();
    const bElement = b.getElement();
    if (!aElement || !bElement || aElement === bElement) return 0;
    const position = aElement.compareDocumentPosition(bElement);
    if (position & 4) return -1; // DOCUMENT_POSITION_FOLLOWING
    if (position & 2) return 1; // DOCUMENT_POSITION_PRECEDING
    return 0;
  });
}

export function sameChildOrder(a: ChildEntry[], b: ChildEntry[]): boolean {
  return a.length === b.length && a.every((entry, index) => entry === b[index]);
}
