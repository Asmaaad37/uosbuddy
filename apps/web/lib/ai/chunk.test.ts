import { describe, expect, it } from "vitest";
import { chunkPages } from "./chunk";

const words = (n: number, prefix = "w") =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(" ");

describe("chunkPages", () => {
  it("keeps a short page as one excerpt", () => {
    expect(chunkPages(["Merge sort  splits\nthe array."])).toEqual([
      { page: 1, content: "Merge sort splits the array." },
    ]);
  });

  it("overlaps long pages by 50 words and never drops the tail", () => {
    const chunks = chunkPages([words(800)]);
    expect(chunks.map((c) => c.content.split(" ").length)).toEqual([350, 350, 200]);
    expect(chunks[1]!.content.startsWith("w300 ")).toBe(true);
    expect(chunks.at(-1)!.content.endsWith("w799")).toBe(true);
  });

  it("numbers pages and skips empty ones", () => {
    const chunks = chunkPages(["one", "   ", "three"]);
    expect(chunks).toEqual([
      { page: 1, content: "one" },
      { page: 3, content: "three" },
    ]);
  });
});
