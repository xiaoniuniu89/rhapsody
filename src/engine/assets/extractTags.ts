const NOISE_TOKENS = new Set([
  "webp",
  "png",
  "jpg",
  "jpeg",
  "mp3",
  "ogg",
  "wav",
  "flac",
  "assets",
  "modules",
  "worlds",
  "rhapsody",
  "svg",
  "icons",
]);

/**
 * Extracts descriptive tags from a name and/or file path.
 * Used for both indexing and query tokenization.
 */
export function extractTags(
  ...inputs: (string | null | undefined)[]
): string[] {
  const tags = new Set<string>();

  for (const input of inputs) {
    if (!input) continue;

    const tokens = input
      .toLowerCase()
      .split(/[\/\s\-_.]/)
      .map((t) => t.trim())
      .filter((t) => {
        // Drop empty
        if (!t) return false;
        // Drop noise
        if (NOISE_TOKENS.has(t)) return false;
        // Drop numeric-only
        if (/^\d+$/.test(t)) return false;
        // Drop single-char
        if (t.length <= 1) return false;
        return true;
      });

    for (const token of tokens) {
      tags.add(token);
    }
  }

  return Array.from(tags);
}
