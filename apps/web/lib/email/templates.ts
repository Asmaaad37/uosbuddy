/** Verification status emails (Phase 1 task 10). Pure: renders subject, text and HTML. */

export type StatusEmail =
  | { kind: "submitted" }
  | { kind: "approved" }
  | { kind: "needs_info"; reason: string }
  | { kind: "rejected"; reason: string };

export type Rendered = { subject: string; text: string; html: string };

const FOOTER =
  "UOSBuddy is a student-run project and is not an official University of Sargodha service.";

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type Copy = {
  subject: string;
  heading: string;
  body: string[];
  reason?: string;
  cta: { label: string; path: string };
};

function copyFor(email: StatusEmail): Copy {
  switch (email.kind) {
    case "submitted":
      return {
        subject: "We got your proof",
        heading: "Thanks, you're in the queue",
        body: [
          "A reviewer will check your proof, usually within 12 hours.",
          "We'll email you as soon as there's a decision.",
        ],
        cta: { label: "Check your status", path: "/pending" },
      };
    case "approved":
      return {
        subject: "You're verified on UOSBuddy",
        heading: "You're in!",
        body: [
          "We've confirmed you're a University of Sargodha student.",
          "Set up your profile to see who else from your batch is here.",
        ],
        cta: { label: "Set up your profile", path: "/setup" },
      };
    case "needs_info":
      return {
        subject: "We need a bit more to verify you",
        heading: "Almost there",
        body: ["The reviewer couldn't confirm everything from your proof yet."],
        reason: email.reason,
        cta: { label: "Update your submission", path: "/start/freshman/proof" },
      };
    case "rejected":
      return {
        subject: "We couldn't verify you yet",
        heading: "We couldn't verify you",
        body: ["You can try again with a clearer photo or a different document."],
        reason: email.reason,
        cta: { label: "Try again", path: "/start/freshman/proof" },
      };
  }
}

/** The 6-digit code that links a UoS email to an existing account (Phase 2 task 8). */
export function renderLinkCodeEmail(code: string): Rendered {
  const subject = `${code} is your UOSBuddy code`;
  const text = [
    "Hi,",
    "",
    `Your code to link this email to UOSBuddy is ${code}. It expires in 10 minutes.`,
    "",
    "If you didn't ask for it, ignore this email; nothing changes without the code.",
    "",
    "— UOSBuddy",
    "",
    FOOTER,
  ].join("\n");
  const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px 12px;background:#f2ece1;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td>
<p style="margin:0 0 20px;font-size:13px;font-weight:bold;letter-spacing:2px;color:#0034d3">UOSBUDDY</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0b0838">Link your UoS email</h1>
<p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#0b0838">Enter this code in UOSBuddy. It expires in 10 minutes.</p>
<p style="margin:0 0 16px;font-size:32px;font-weight:bold;letter-spacing:8px;color:#0b0838">${escapeHtml(code)}</p>
<p style="margin:0;font-size:14px;line-height:1.5;color:#4a4766">If you didn't ask for it, ignore this email; nothing changes without the code.</p>
</td></tr></table>
<p style="max-width:480px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#4a4766">${FOOTER}</p>
</td></tr></table>
</body></html>`;
  return { subject, text, html };
}

export function renderStatusEmail(
  email: StatusEmail,
  { name, siteUrl }: { name?: string | null; siteUrl: string },
): Rendered {
  const copy = copyFor(email);
  const first = name?.trim().split(/\s+/)[0];
  const greeting = first ? `Hi ${first},` : "Hi,";
  const url = new URL(copy.cta.path, siteUrl).toString();

  const text = [
    greeting,
    "",
    ...copy.body,
    ...(copy.reason ? ["", `The reviewer said: ${copy.reason}`] : []),
    "",
    `${copy.cta.label}: ${url}`,
    "",
    "— UOSBuddy",
    "",
    FOOTER,
  ].join("\n");

  const p = (s: string) =>
    `<p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#0b0838">${s}</p>`;
  const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px 12px;background:#f2ece1;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td>
<p style="margin:0 0 20px;font-size:13px;font-weight:bold;letter-spacing:2px;color:#0034d3">UOSBUDDY</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0b0838">${escapeHtml(copy.heading)}</h1>
${p(escapeHtml(greeting))}
${copy.body.map((line) => p(escapeHtml(line))).join("\n")}
${
  copy.reason
    ? `<div style="margin:0 0 16px;padding:12px 14px;border-radius:10px;background:#fbf3e2;border:1px solid #ecd29b">
<p style="margin:0 0 4px;font-size:14px;font-weight:bold;color:#0b0838">The reviewer said:</p>
<p style="margin:0;font-size:15px;line-height:1.5;color:#0b0838">${escapeHtml(copy.reason)}</p></div>`
    : ""
}
<p style="margin:20px 0 0"><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#0b0838;color:#f2ece1;font-size:16px;font-weight:bold;text-decoration:none">${escapeHtml(copy.cta.label)}</a></p>
</td></tr></table>
<p style="max-width:480px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#4a4766">${FOOTER}</p>
</td></tr></table>
</body></html>`;

  return { subject: copy.subject, text, html };
}
