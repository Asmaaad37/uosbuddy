import { describe, expect, it } from "vitest";
import {
  emailDomain,
  isStudentId,
  normaliseStudentId,
  passwordStrength,
  whatsappSchema,
} from "./onboarding";

// The live formats from supabase/seed/uos-catalogue.json.
const uos = {
  roll: "^[A-Z]{2,8}\\d{2}[FS]\\d{2}[A-Z]\\d{3}$",
  registration: "^\\d{2}[FS]-US-[A-Z]{2,5}-\\d{1,5}$",
};

describe("student ids", () => {
  it("accepts UoS roll and registration numbers in any case or spacing", () => {
    expect(isStudentId("BSCS51F22S037", uos)).toBe(true);
    expect(isStudentId(" bsit51s25r002 ", uos)).toBe(true);
    expect(isStudentId("22F-US-CSC-401", uos)).toBe(true);
    expect(normaliseStudentId("bscs 51f22 s037")).toBe("BSCS51F22S037");
  });

  it("rejects anything else", () => {
    expect(isStudentId("12345", uos)).toBe(false);
    expect(isStudentId("BSCS51F22S03", uos)).toBe(false);
    expect(isStudentId("BSCS51F22S037", { roll: null, registration: null })).toBe(false);
  });
});

describe("whatsapp", () => {
  it("normalises spacing and allows it to be empty", () => {
    expect(whatsappSchema.parse("+92 300 123-4567")).toBe("+923001234567");
    expect(whatsappSchema.parse("")).toBe("");
    expect(whatsappSchema.safeParse("12").success).toBe(false);
  });
});

describe("helpers", () => {
  it("extracts the email domain", () => {
    expect(emailDomain("Ali@UOS.edu.pk ")).toBe("uos.edu.pk");
  });

  it("scores password strength", () => {
    expect(passwordStrength("short")).toBe(0);
    expect(passwordStrength("abcdefgh")).toBe(1);
    expect(passwordStrength("Abcdefgh1!xyz")).toBe(4);
  });
});
