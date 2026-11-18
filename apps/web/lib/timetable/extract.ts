import { getDocumentProxy } from "unpdf";
import type { PageWords, Word } from "./parser";

// Helvetica advance widths (per 1000 em) for printable ASCII, from the standard AFM metrics.
// Timetables use a sans-serif face; the run's real width is shared out in these proportions.
// prettier-ignore
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // space-/
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, // 0-?
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, // @-O
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, // P-_
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, // `-o
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, // p-~
];
// Lato Regular advance widths (per 1000 em), measured from the department's timetable PDFs,
// which are set in Lato. Characters it doesn't cover fall back to Helvetica.
// prettier-ignore
const LATO: Record<string, number> = { " ": 193, "#": 580, "&": 703, "(": 300, ")": 300, "-": 347, ".": 212, "/": 373, "0": 580, "1": 580, "2": 580, "3": 580, "4": 580, "5": 580, "6": 580, "7": 580, "8": 580, "9": 580, ":": 252, "<": 580, "A": 680, "B": 647, "C": 685, "D": 753, "E": 581, "F": 566, "G": 734, "H": 756, "I": 307, "J": 444, "K": 681, "L": 514, "M": 920, "N": 756, "O": 798, "P": 611, "Q": 798, "R": 644, "S": 530, "T": 590, "U": 730, "W": 1019, "Y": 629, "Z": 624, "a": 507, "b": 559, "c": 467, "d": 559, "e": 524, "f": 337, "g": 511, "h": 556, "i": 256, "j": 254, "k": 524, "l": 256, "m": 821, "n": 556, "o": 556, "p": 552, "q": 559, "r": 403, "s": 434, "t": 373, "u": 556, "v": 512, "w": 766, "x": 504, "y": 512, "z": 462, "…": 727 };
const glyphWidth = (ch: string) => {
  const lato = LATO[ch];
  if (lato !== undefined) return lato;
  const code = ch.codePointAt(0) ?? 0;
  if (code >= 32 && code <= 126) return HELVETICA[code - 32]!;
  return ch === "…" ? 1000 : 556;
};

type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
};

/**
 * Positioned words from a PDF, measured the way pdfplumber measures them (the parser's
 * thresholds were tuned on pdfplumber): `top` is the distance from the top of the page to the
 * top of the glyph box, baseline + size × (1 + descent). pdf.js gives text runs, not words, so
 * each run is split on whitespace and its width shared out by glyph width.
 */
export async function extractWords(pdf: Uint8Array): Promise<PageWords[]> {
  const doc = await getDocumentProxy(pdf);
  const pages: PageWords[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const { width, height } = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const styles = content.styles as Record<string, { descent?: number }>;
      const words: Word[] = [];
      for (const raw of content.items) {
        const item = raw as TextItem;
        if (!item.str || !item.str.trim()) continue;
        const [, , c = 0, d = 0, x = 0, y = 0] = item.transform;
        const size = item.height || Math.hypot(c, d);
        const descent = styles[item.fontName]?.descent ?? -0.2;
        const top = height - (y + size * (1 + descent));
        const chars = [...item.str];
        const offsets = [0];
        for (const ch of chars) offsets.push(offsets[offsets.length - 1]! + glyphWidth(ch));
        const scale = item.width / offsets[chars.length]!;
        let index = 0;
        for (const part of item.str.split(/(\s+)/)) {
          const length = [...part].length;
          if (part && !/^\s+$/.test(part)) {
            words.push({
              text: part,
              x0: x + offsets[index]! * scale,
              x1: x + offsets[index + length]! * scale,
              top,
              bottom: top + size,
            });
          }
          index += length;
        }
      }
      pages.push({ width, height, words });
      page.cleanup();
    }
  } finally {
    await doc.cleanup();
  }
  return pages;
}
