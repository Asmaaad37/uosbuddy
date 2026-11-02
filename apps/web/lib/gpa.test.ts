import { describe, expect, it } from "vitest";
import { cgpa, gpa, gradeFor } from "./gpa";

describe("gradeFor (UoS grading table)", () => {
  it("matches the table at its boundaries", () => {
    expect(gradeFor(100)).toEqual({ letter: "A", points: 4, passed: true });
    expect(gradeFor(80)).toEqual({ letter: "A", points: 4, passed: true });
    expect(gradeFor(79)).toEqual({ letter: "B", points: 3.94, passed: true });
    expect(gradeFor(65)).toEqual({ letter: "B", points: 3.0, passed: true });
    expect(gradeFor(64)).toEqual({ letter: "C", points: 2.92, passed: true });
    expect(gradeFor(50)).toEqual({ letter: "C", points: 2.0, passed: true });
    expect(gradeFor(49)).toEqual({ letter: "D", points: 1.9, passed: false });
    expect(gradeFor(40)).toEqual({ letter: "D", points: 1.0, passed: false });
    expect(gradeFor(39)).toEqual({ letter: "F", points: 0, passed: false });
  });

  it("reads rows from the middle of the table", () => {
    expect(gradeFor(72).points).toBe(3.47);
    expect(gradeFor(57).points).toBe(2.43);
    expect(gradeFor(45).points).toBe(1.5);
  });

  it("uses whole marks, as the table does", () => {
    expect(gradeFor(79.9).points).toBe(3.94);
  });
});

describe("gpa and cgpa", () => {
  it("weights grade points by credit hours", () => {
    // 4.00×3 + 3.00×3 + 2.00×2 = 25 over 8 credits = 3.125 → 3.13
    expect(
      gpa([
        { credits: 3, marks: 85 },
        { credits: 3, marks: 65 },
        { credits: 2, marks: 50 },
      ]),
    ).toEqual({ gpa: 3.13, credits: 8 });
  });

  it("ignores courses without marks", () => {
    expect(gpa([{ credits: 3, marks: null }])).toEqual({ gpa: null, credits: 0 });
  });

  it("combines semesters by credits, not by averaging GPAs", () => {
    // Sem 1: 4.00×3; Sem 2: 2.00×1 → 14/4 = 3.5 (averaging GPAs would give 3.0)
    expect(cgpa([[{ credits: 3, marks: 90 }], [{ credits: 1, marks: 50 }]]).gpa).toBe(3.5);
  });
});
