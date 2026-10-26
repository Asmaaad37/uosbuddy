import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderStatusEmail, type StatusEmail } from "./templates";

let transport: Transporter | undefined;

/** Email is off until SMTP is configured; the app works the same without it. */
export function emailEnabled() {
  return !!(serverEnv.SMTP_HOST && serverEnv.SMTP_USER && serverEnv.SMTP_PASSWORD);
}

function getTransport() {
  transport ??= nodemailer.createTransport({
    host: serverEnv.SMTP_HOST,
    port: serverEnv.SMTP_PORT,
    secure: serverEnv.SMTP_PORT === 465,
    auth: { user: serverEnv.SMTP_USER, pass: serverEnv.SMTP_PASSWORD },
  });
  return transport;
}

/**
 * Sends one status email to a user. Never throws: a failed email must not undo a submission
 * or a review decision, so failures are logged (and reach Sentry when it's configured).
 */
export async function sendStatusEmail(userId: string, email: StatusEmail): Promise<boolean> {
  if (!emailEnabled()) {
    console.info(`[email] SMTP not configured; skipped "${email.kind}" email`);
    return false;
  }

  try {
    const db = createAdminClient();
    const [{ data: pii }, { data: profile }] = await Promise.all([
      db
        .from("private_profile")
        .select("personal_email, uni_email")
        .eq("user_id", userId)
        .maybeSingle(),
      db.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    ]);
    const to = pii?.personal_email ?? pii?.uni_email;
    if (!to) return false;

    const message = renderStatusEmail(email, {
      name: profile?.full_name,
      siteUrl: serverEnv.NEXT_PUBLIC_SITE_URL,
    });
    await getTransport().sendMail({
      from: serverEnv.EMAIL_FROM ?? `UOSBuddy <${serverEnv.SMTP_USER}>`,
      to,
      ...message,
    });
    return true;
  } catch (error) {
    console.error(`[email] failed to send "${email.kind}" email`, error);
    return false;
  }
}
