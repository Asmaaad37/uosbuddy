"use server";

import { createHash, randomInt } from "node:crypto";
import { z } from "zod";
import { withinLimit } from "@/lib/abuse.server";
import { getSession } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/send.server";
import { renderLinkCodeEmail } from "@/lib/email/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "./onboarding";
import { fail } from "@/lib/action-helpers.server";

/** Only the hash reaches the database, salted with the user id so codes aren't reusable. */
const hashCode = (userId: string, code: string) =>
  createHash("sha256").update(`${userId}:${code}`).digest("hex");

const START_ERRORS: Record<string, string> = {
  not_verified: "You need to be verified first.",
  already_linked: "You've already linked a UoS email.",
  wrong_domain: "That's not a UoS email. It should end in @uos.edu.pk.",
  taken: "That email is already linked to another account.",
};

const CONFIRM_ERRORS: Record<string, string> = {
  no_claim: "Ask for a new code first.",
  expired: "That code has expired. Ask for a new one.",
  too_many: "Too many wrong tries. Ask for a new code.",
  wrong: "That code isn't right. Check the email and try again.",
  taken: "That email was just linked to another account.",
};

const emailSchema = z.email("Enter your UoS email").max(254);

/** Phase 2 task 8, step 1: email a 6-digit code to the UoS address. */
export async function startLinkEmail(email: string): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(email.trim());
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Enter your UoS email");
  const { user } = await getSession();
  if (!user) return fail("Your session expired. Log in again.");
  if (!(await withinLimit("linkEmailCode", user.id))) {
    return fail("Too many codes requested. Try again in an hour.");
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { data: status, error } = await createAdminClient().rpc("start_uni_email_claim", {
    p_user: user.id,
    p_email: parsed.data,
    p_code_hash: hashCode(user.id, code),
  });
  if (error) return fail("Couldn't send a code. Try again.");
  if (status !== "ok") return fail(START_ERRORS[status] ?? "Couldn't send a code. Try again.");

  const sent = await sendEmail(parsed.data, renderLinkCodeEmail(code));
  return sent ? { ok: true, data: undefined } : fail("Couldn't send the email. Try again later.");
}

/** Step 2: check the code; on success the UoS email is on file and the stamp shows. */
export async function confirmLinkEmail(code: string): Promise<ActionResult> {
  const digits = code.replace(/\D/g, "");
  if (digits.length !== 6) return fail("Enter the 6-digit code from the email.");
  const { user } = await getSession();
  if (!user) return fail("Your session expired. Log in again.");
  if (!(await withinLimit("linkEmailConfirm", user.id))) {
    return fail("Too many tries. Try again in an hour.");
  }

  const { data: status, error } = await createAdminClient().rpc("confirm_uni_email_claim", {
    p_user: user.id,
    p_code_hash: hashCode(user.id, digits),
  });
  if (error) return fail("Couldn't check the code. Try again.");
  if (status !== "ok") return fail(CONFIRM_ERRORS[status] ?? "Couldn't check the code.");
  return { ok: true, data: undefined };
}
