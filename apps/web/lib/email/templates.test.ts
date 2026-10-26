import { describe, expect, it } from "vitest";
import { escapeHtml, renderStatusEmail } from "./templates";

const site = { siteUrl: "https://uosbuddy.example" };

describe("status emails", () => {
  it("greets by first name and links to the right page", () => {
    const email = renderStatusEmail({ kind: "approved" }, { ...site, name: "Bilal Ahmed" });
    expect(email.subject).toBe("You're verified on UOSBuddy");
    expect(email.text).toContain("Hi Bilal,");
    expect(email.text).toContain("https://uosbuddy.example/setup");
    expect(email.html).toContain('href="https://uosbuddy.example/setup"');
  });

  it("includes the reviewer's reason when more is needed", () => {
    const email = renderStatusEmail(
      { kind: "needs_info", reason: "The roll number is cut off." },
      site,
    );
    expect(email.text).toContain("The reviewer said: The roll number is cut off.");
    expect(email.text).toContain("Hi,");
    expect(email.html).toContain("/start/freshman/proof");
  });

  it("escapes anything a person typed", () => {
    const email = renderStatusEmail(
      { kind: "rejected", reason: '<script>alert("x")</script>' },
      { ...site, name: "<b>Sana</b>" },
    );
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>Sana");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("escapes all HTML special characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });
});
