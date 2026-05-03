import type { IndexedChunk } from "./types";

/**
 * Chunks a JournalEntryPage's HTML content by heading (h1-h4).
 * Strips HTML tags but keeps the text.
 */
export function chunkPage(
  content: string,
  meta: {
    packId: string;
    entryUuid: string;
    entryName: string;
    pageId: string;
    pageName: string;
  },
): Partial<IndexedChunk>[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/html");
  const body = doc.body;

  const chunks: Partial<IndexedChunk>[] = [];
  let currentPath: string[] = [];
  let currentText = "";

  function flush(path: string[]) {
    const trimmed = currentText.trim();
    if (!trimmed) return;

    // Cap at ~1500 chars, split if needed
    const maxLength = 1500;
    for (let i = 0; i < trimmed.length; i += maxLength) {
      chunks.push({
        ...meta,
        headingPath: [...path],
        text: trimmed.slice(i, i + maxLength),
      });
    }
    currentText = "";
  }

  // Iterate through top-level nodes of the body
  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const match = el.tagName.match(/^H([1-4])$/);
      if (match) {
        // It's a heading
        flush(currentPath);
        const level = parseInt(match[1]);
        const headingText = el.innerText.trim();

        // Adjust path based on level
        currentPath = currentPath.slice(0, level - 1);
        currentPath[level - 1] = headingText;
      } else {
        // It's a regular element, append text
        currentText += " " + el.innerText;
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      currentText += " " + node.textContent;
    }
  }

  flush(currentPath);

  // If we have no chunks (empty page?), but page has a name, at least index the page name
  if (chunks.length === 0 && meta.pageName) {
    chunks.push({
      ...meta,
      headingPath: [],
      text: meta.pageName,
    });
  }

  return chunks;
}
