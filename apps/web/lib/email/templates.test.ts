import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  renderDigestEmail,
  renderExportEmail,
  renderLinkCodeEmail,
  renderStatusEmail,
} from "./templates";

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

describe("link code email", () => {
  it("puts the code in the subject, text and HTML", () => {
    const email = renderLinkCodeEmail("042917");
    expect(email.subject).toBe("042917 is your UOSBuddy code");
    expect(email.text).toContain("042917");
    expect(email.text).toContain("expires in 10 minutes");
    expect(email.html).toContain("042917");
  });
});

describe("digest and export emails", () => {
  const site = "https://uosbuddy.example";
  it("skips the digest when nothing happened", () => {
    expect(
      renderDigestEmail(
        { newBatchmates: 0, openBackup: 0, upcomingEvents: 0, unread: 0 },
        { siteUrl: site, unsubscribeUrl: `${site}/u` },
      ),
    ).toBeNull();
  });

  it("lists what's new, escapes HTML and links to unsubscribe", () => {
    const mail = renderDigestEmail(
      { newBatchmates: 3, openBackup: 1, upcomingEvents: 0, unread: 2 },
      {
        name: "<b>Ali</b> Raza",
        siteUrl: site,
        unsubscribeUrl: `${site}/api/digest/unsubscribe?u=1&t=x`,
      },
    )!;
    expect(mail.subject).toBe("This week: 3 new batchmates joined");
    expect(mail.text).toContain("• 1 classmate needs backup right now.");
    expect(mail.text).not.toContain("events");
    expect(mail.html).toContain("&lt;b&gt;Ali&lt;/b&gt;");
    expect(mail.html).toContain("/api/digest/unsubscribe?u=1&amp;t=x");
  });

  it("sends the export link", () => {
    expect(renderExportEmail("https://x.example/file").text).toContain("https://x.example/file");
  });
});
