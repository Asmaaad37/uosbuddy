import { describe, expect, it } from "vitest";
import { inviteMessage, whatsappLink } from "./invite-text";

describe("invite your batch", () => {
  it("names the batch when there's one to name", () => {
    const text = inviteMessage({
      batchLabel: "CS 2024",
      count: 43,
      url: "https://x.example/i/AB12",
    });
    expect(text).toMatch(/^43 of CS 2024 are already on UOSBuddy/);
    expect(text).toContain("https://x.example/i/AB12");
    expect(inviteMessage({ batchLabel: null, count: 0, url: "u" })).toMatch(/^I'm on UOSBuddy/);
  });

  it("builds a WhatsApp share link", () => {
    expect(whatsappLink("Hi & bye")).toBe("https://wa.me/?text=Hi%20%26%20bye");
  });
});
