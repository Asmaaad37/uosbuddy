import { describe, expect, it } from "vitest";
import { nameMatch, score, type Extraction } from "./precheck";

const doc: Extraction = {
  name: "MUHAMMAD ALI RAZA",
  roll_no: "BSCS 51 F23",
  university: "University of Sargodha",
  session: "2023-2027",
  department: "Computer Science",
  document_type: "Fee challan",
  readable: true,
  looks_edited: false,
};
const now = new Date("2026-11-03T00:00:00Z");

describe("verification pre-check", () => {
  it("matches names regardless of order, case and 'M.' for Muhammad", () => {
    expect(nameMatch("Ali Raza", "M. Ali Raza")).toBe(1);
    expect(nameMatch("raza ali", "MUHAMMAD ALI RAZA")).toBe(1);
    expect(nameMatch("Ayesha Khan", "Ali Raza")).toBe(0);
    expect(nameMatch(null, "Ali")).toBe(0);
  });

  it("scores a clean match high with no flags", () => {
    const p = score(doc, { name: "Muhammad Ali Raza", rollNo: "bscs51f23" }, null, now);
    expect(p).toMatchObject({ roll_match: true, uni_match: true, flags: [], confidence: 1 });
  });

  it("flags mismatches, edits and reused roll numbers, and lowers confidence", () => {
    const p = score(
      { ...doc, university: "Punjab University", looks_edited: true },
      { name: "Sara Ahmed", rollNo: "BSCS-51-F24" },
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      now,
    );
    expect(p.flags).toEqual([
      "name_mismatch",
      "roll_mismatch",
      "not_uos",
      "possible_edit",
      "duplicate_roll",
    ]);
    expect(p.confidence).toBe(0);
  });

  it("halves confidence for an unreadable document", () => {
    const p = score({ ...doc, readable: false }, { name: "Ali Raza", rollNo: "BSCS51F23" }, null);
    expect(p.flags).toEqual(["unreadable"]);
    expect(p.confidence).toBe(0.5);
  });
});
