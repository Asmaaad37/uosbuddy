import { describe, expect, it } from "vitest";
import {
  PRIVACY_PRESETS,
  batchYearFromStudentId,
  batchYears,
  matchPreset,
  resumeStep,
} from "./setup";
import { handleProblem } from "./validation/handle";

describe("setup steps", () => {
  it("resumes at the first unfinished step", () => {
    expect(resumeStep(0)).toBe("academic");
    expect(resumeStep(2)).toBe("interests");
    expect(resumeStep(9)).toBe("privacy");
  });

  it("offers recent session years, newest first", () => {
    expect(batchYears(new Date("2026-10-29"))[0]).toBe(2026);
    const years = batchYears(new Date("2026-11-15"));
    expect(years[0]).toBe(2027);
    expect(years).toContain(2020);
  });

  it("reads the session year from a roll or registration number", () => {
    expect(batchYearFromStudentId("BSCS51F22S037")).toBe(2022);
    expect(batchYearFromStudentId("22F-US-CSC-401")).toBe(2022);
    expect(batchYearFromStudentId("nonsense")).toBeNull();
  });
});

describe("privacy presets", () => {
  it("recognises a preset and calls anything else custom", () => {
    expect(matchPreset(PRIVACY_PRESETS.batch.settings)).toBe("batch");
    expect(matchPreset({ ...PRIVACY_PRESETS.open.settings, show_hometown: false })).toBe("custom");
  });
});

describe("handles", () => {
  it("accepts ordinary handles", () => {
    expect(handleProblem("ali_raza")).toBeNull();
    expect(handleProblem("Hamza07")).toBeNull();
    // Substring matching must not catch real names.
    expect(handleProblem("nazia_khan")).toBeNull();
    expect(handleProblem("grape_juice")).toBeNull();
  });

  it("explains what's wrong", () => {
    expect(handleProblem("ab")).toMatch(/at least 3/);
    expect(handleProblem("ali raza")).toMatch(/letters, numbers/);
    expect(handleProblem("Admin")).toMatch(/reserved/);
    expect(handleProblem("uos_buddy")).toMatch(/reserved/);
    expect(handleProblem("xchutiyax")).toMatch(/different/);
  });
});
