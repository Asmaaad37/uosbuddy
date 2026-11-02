/**
 * Splits page texts into overlapping excerpts for search (Phase 7 task 1). The embedding
 * model reads at most 512 tokens, so excerpts are about 350 words with 50 words of overlap,
 * and never cross a page, so every citation can name its page.
 */
export type Chunk = { page: number; content: string };

export function chunkPages(pages: string[], { size = 350, overlap = 50 } = {}): Chunk[] {
  const out: Chunk[] = [];
  pages.forEach((text, i) => {
    const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    if (!words.length) return;
    const step = Math.max(1, size - overlap);
    for (let start = 0; start < words.length; start += step) {
      out.push({ page: i + 1, content: words.slice(start, start + size).join(" ") });
      if (start + size >= words.length) break;
    }
  });
  return out;
}
