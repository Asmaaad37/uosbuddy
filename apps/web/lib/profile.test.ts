import { describe, expect, it } from "vitest";
import { completeness, studiesLine, type CompletenessInput } from "./profile";

const empty: CompletenessInput = {
  avatar_url: null,
  bio: null,
  hometown_city: null,
  section: null,
  opening_move: null,
  interestCount: 0,
  hasUniEmail: false,
};

const full: CompletenessInput = {
  avatar_url: "https://example.com/a.webp",
  bio: "CS fresher",
  hometown_city: "Sargodha",
  section: "A",
  opening_move: "Chai at the main gate",
  interestCount: 5,
  hasUniEmail: true,
};

describe("completeness", () => {
  it("is 0% with every nudge for an empty profile", () => {
    const result = completeness(empty);
    expect(result.percent).toBe(0);
    expect(result.nudges.map((n) => n.key)).toEqual([
      "photo",
      "bio",
      "hometown",
      "section",
      "interests",
      "opening_move",
      "uni_email",
    ]);
  });

  it("is 100% with no nudges for a full profile", () => {
    expect(completeness(full)).toEqual({ percent: 100, nudges: [] });
  });

  it("ignores whitespace-only answers and too few interests", () => {
    const result = completeness({ ...full, bio: "   ", interestCount: 2 });
    expect(result.nudges.map((n) => n.key)).toEqual(["bio", "interests"]);
    expect(result.percent).toBe(71);
  });

  it("links each nudge to the screen that fixes it", () => {
    const { nudges } = completeness({ ...full, avatar_url: null, hasUniEmail: false });
    expect(nudges).toEqual([
      expect.objectContaining({ key: "photo", href: "/setup/about?edit=1" }),
      expect.objectContaining({ key: "uni_email", href: "/me/email" }),
    ]);
  });
});

describe("studiesLine", () => {
  it("joins what's known and skips what isn't", () => {
    expect(studiesLine({ batch_year: 2024, semester: 3, section: "B", shift: "morning" })).toBe(
      "Batch 2024 · Semester 3 · Section B · Morning",
    );
    expect(studiesLine({ batch_year: 2025, semester: null, section: null, shift: "evening" })).toBe(
      "Batch 2025 · Evening",
    );
  });
});
