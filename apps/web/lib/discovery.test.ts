import { describe, expect, it } from "vitest";
import { cardLine, diversify, type Suggestion } from "./discovery";

const s = (id: string, ...reasons: string[]): Suggestion => ({
  person: { id } as Suggestion["person"],
  score: 0,
  reasons,
});
const ids = (list: Suggestion[]) => list.map((x) => x.person.id);

describe("diversify", () => {
  it("caps any one top reason at 40% and keeps the order otherwise", () => {
    const list = [
      s("a", "Same section"),
      s("b", "Same section"),
      s("c", "Same section"),
      s("d", "Same section"),
      s("e", "Both into Cricket"),
      s("f", "Both into Chess"),
      s("g", "Also from Lahore"),
      s("h", "Same batch"),
      s("i", "Same batch"),
      s("j", "Same department"),
    ];
    const result = diversify(list, 5);
    expect(ids(result)).toEqual(["a", "b", "e", "f", "g"]);
  });

  it("groups reasons that differ only by the interest or city", () => {
    const list = [
      s("a", "Both into Cricket"),
      s("b", "Both into Chess"),
      s("c", "Both into Coding"),
      s("d", "Same batch"),
    ];
    expect(ids(diversify(list, 4))).toEqual(["a", "d", "b", "c"]);
  });

  it("fills up with deferred people rather than returning fewer", () => {
    const list = [s("a", "Same section"), s("b", "Same section"), s("c", "Same section")];
    expect(ids(diversify(list, 3))).toEqual(["a", "b", "c"]);
  });
});

describe("cardLine", () => {
  it("reads like CS · 2024 · Sec B · Morning", () => {
    expect(
      cardLine({ department_code: "CS", batch_year: 2024, section: "B", shift: "morning" }),
    ).toBe("CS · 2024 · Sec B · Morning");
    expect(cardLine({ department_code: "IT", batch_year: 2025, section: null, shift: null })).toBe(
      "IT · 2025",
    );
  });
});
