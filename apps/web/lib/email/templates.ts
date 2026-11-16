/** Verification status emails (Phase 1 task 10). Pure: renders subject, text and HTML. */

export type StatusEmail =
  | { kind: "submitted" }
  | { kind: "approved" }
  | { kind: "needs_info"; reason: string }
  | { kind: "rejected"; reason: string };

export type Rendered = { subject: string; text: string; html: string };

const FOOTER =
  "UOSBuddy is a student-run project and is not an official University of Sargodha service.";

// The mark is the app's own PNG icon: most mail apps don't show SVG. Without a site URL
// (tests, local) the header is just the name.
const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
const HEADER = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr>${
  SITE
    ? `<td style="padding-right:10px"><img src="${SITE}/icons/192" width="32" height="32" alt="" style="display:block;border-radius:8px"></td>`
    : ""
}<td style="font-size:17px;font-weight:bold;color:#0b1220">UOSBuddy</td></tr></table>`;

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
<html lang="en"><body style="margin:0;padding:24px 12px;background:#f2f4f7;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td>
${HEADER}
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0b1220">Link your UoS email</h1>
<p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#0b1220">Enter this code in UOSBuddy. It expires in 10 minutes.</p>
<p style="margin:0 0 16px;font-size:32px;font-weight:bold;letter-spacing:8px;color:#0b1220">${escapeHtml(code)}</p>
<p style="margin:0;font-size:14px;line-height:1.5;color:#5a6475">If you didn't ask for it, ignore this email; nothing changes without the code.</p>
</td></tr></table>
<p style="max-width:480px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#5a6475">${FOOTER}</p>
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
    `<p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#0b1220">${s}</p>`;
  const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px 12px;background:#f2f4f7;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td>
${HEADER}
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0b1220">${escapeHtml(copy.heading)}</h1>
${p(escapeHtml(greeting))}
${copy.body.map((line) => p(escapeHtml(line))).join("\n")}
${
  copy.reason
    ? `<div style="margin:0 0 16px;padding:12px 14px;border-radius:10px;background:#e8f0fe;border:1px solid #c7d7fb">
<p style="margin:0 0 4px;font-size:14px;font-weight:bold;color:#0b1220">The reviewer said:</p>
<p style="margin:0;font-size:15px;line-height:1.5;color:#0b1220">${escapeHtml(copy.reason)}</p></div>`
    : ""
}
<p style="margin:20px 0 0"><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#2563eb;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none">${escapeHtml(copy.cta.label)}</a></p>
</td></tr></table>
<p style="max-width:480px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#5a6475">${FOOTER}</p>
</td></tr></table>
</body></html>`;

  return { subject: copy.subject, text, html };
}

/** The shared card layout: heading, paragraphs, one button, optional small print. */
function card(
  heading: string,
  lines: string[],
  cta: { label: string; url: string },
  small?: string,
) {
  const p = (s: string) =>
    `<p style="margin:0 0 12px;font-size:16px;line-height:1.5;color:#0b1220">${s}</p>`;
  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px 12px;background:#f2f4f7;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td>
${HEADER}
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0b1220">${escapeHtml(heading)}</h1>
${lines.map((l) => p(escapeHtml(l))).join("\n")}
<p style="margin:20px 0 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#2563eb;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none">${escapeHtml(cta.label)}</a></p>
${small ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#5a6475">${small}</p>` : ""}
</td></tr></table>
<p style="max-width:480px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#5a6475">${FOOTER}</p>
</td></tr></table>
</body></html>`;
}

export type DigestNumbers = {
  newBatchmates: number;
  openBackup: number;
  upcomingEvents: number;
  unread: number;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Phase 9 task 4: the weekly digest. Null when there's nothing worth an email. */
export function renderDigestEmail(
  n: DigestNumbers,
  {
    name,
    siteUrl,
    unsubscribeUrl,
  }: { name?: string | null; siteUrl: string; unsubscribeUrl: string },
): Rendered | null {
  const lines = [
    n.newBatchmates > 0 && `${plural(n.newBatchmates, "new batchmate", "new batchmates")} joined.`,
    n.openBackup > 0 &&
      `${plural(n.openBackup, "classmate needs", "classmates need")} backup right now.`,
    n.upcomingEvents > 0 &&
      `${plural(n.upcomingEvents, "event is", "events are")} coming up this week.`,
    n.unread > 0 && `You have ${plural(n.unread, "unread notification", "unread notifications")}.`,
  ].filter((l): l is string => !!l);
  if (!lines.length) return null;
  const first = name?.trim().split(/\s+/)[0];
  const greeting = first ? `Hi ${first}, here's your week at UoS:` : "Here's your week at UoS:";
  const url = new URL("/explore", siteUrl).toString();
  const subject = lines[0]!.replace(/\.$/, "");
  const text = [
    greeting,
    "",
    ...lines.map((l) => `• ${l}`),
    "",
    `Open UOSBuddy: ${url}`,
    "",
    `Don't want these weekly emails? ${unsubscribeUrl}`,
    "",
    FOOTER,
  ].join("\n");
  const html = card(
    "Your week at UoS",
    [greeting, ...lines],
    { label: "Open UOSBuddy", url },
    `Weekly digest. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#5a6475">Unsubscribe in one click</a>.`,
  );
  return { subject: `This week: ${subject}`, text, html };
}

/** Phase 9 task 6: a link to the student's data export (expires in 7 days). */
export function renderExportEmail(url: string): Rendered {
  const text = [
    "Hi,",
    "",
    "Your UOSBuddy data export is ready. This link works for 7 days:",
    url,
    "",
    "If you didn't ask for it, change your password; someone may have your login.",
    "",
    FOOTER,
  ].join("\n");
  const html = card(
    "Your data export is ready",
    ["Everything UOSBuddy holds about you, as one JSON file. The link works for 7 days."],
    { label: "Download my data", url },
    "If you didn't ask for it, change your password; someone may have your login.",
  );
  return { subject: "Your UOSBuddy data export", text, html };
}
