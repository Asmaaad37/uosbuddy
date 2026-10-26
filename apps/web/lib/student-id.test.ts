import { describe, expect, it } from "vitest";
import { describeStudentId } from "./student-id";

describe("describeStudentId", () => {
  it("reads roll numbers", () => {
    expect(describeStudentId("BSCS51F22S037")).toEqual([
      "BSCS",
      "Fall 2022",
      "Self-support",
      "Code 51",
      "#037",
    ]);
    expect(describeStudentId("BSIT51S25R002")?.slice(0, 3)).toEqual([
      "BSIT",
      "Spring 2025",
      "Regular",
    ]);
  });

  it("reads registration numbers", () => {
    expect(describeStudentId("22F-US-CSC-401")).toEqual(["Fall 2022", "CSC", "#401"]);
  });

  it("returns null for anything else", () => {
    expect(describeStudentId("12345")).toBeNull();
  });
});
