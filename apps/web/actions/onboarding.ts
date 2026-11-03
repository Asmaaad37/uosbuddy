"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { sendStatusEmail } from "@/lib/email/send.server";
import { z } from "zod";
import { precheckVerification } from "@/lib/ai/precheck.server";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, verifyTurnstile, withinLimit } from "@/lib/abuse.server";
import {
  DOC_TYPES,
  emailSchema,
  fullNameSchema,
  normaliseStudentId,
  whatsappSchema,
} from "@/lib/validation/onboarding";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const fail = (error: string) => ({ ok: false, error }) as const;
const TOO_MANY = "Too many attempts. Wait a while and try again.";

/** "Not from UoS? Request your university" (Section 7, screen 2). */
export async function joinWaitlist(input: {
  name: string;
  email: string;
  captchaToken?: string;
}): Promise<ActionResult> {
  const parsed = z.object({ name: fullNameSchema, email: emailSchema }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form");

  // The only form anyone can submit without an account: captcha plus a per-IP limit.
  const ip = await clientIp();
  if (!(await verifyTurnstile(input.captchaToken, ip))) {
    return fail("The security check failed. Refresh the page and try again.");
  }
  if (!(await withinLimit("waitlist", ip))) return fail(TOO_MANY);

  const supabase = await createClient();
  const { error } = await supabase.from("university_requests").insert(parsed.data);
  return error ? fail("Couldn't save that. Try again in a minute.") : { ok: true, data: undefined };
}

/**
 * A short-lived signed URL for one proof document, in the user's own folder (§3.3 B step 2).
 * Signed server-side, so the bucket never needs a client-readable policy.
 */
export async function createProofUpload(
  mimeType: string,
): Promise<ActionResult<{ path: string; token: string }>> {
  const { user, profile } = await getSession();
  if (!user || !profile) return fail("Your session expired. Log in again.");
  if (profile.verification_status === "verified") return fail("You're already verified.");
  if (!(await withinLimit("proofUpload", user.id))) return fail(TOO_MANY);

  const ext = DOC_TYPES[mimeType];
  if (!ext) return fail("Upload a JPG, PNG, WebP or PDF.");

  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await createAdminClient()
    .storage.from("verification-docs")
    .createSignedUploadUrl(path);
  if (error || !data) return fail("Couldn't start the upload. Try again.");
  return { ok: true, data: { path: data.path, token: data.token } };
}

const proofSchema = z.object({
  fullName: fullNameSchema,
  studentId: z
    .string()
    .transform(normaliseStudentId)
    .pipe(z.string().min(5, "Enter your roll number")),
  whatsapp: whatsappSchema,
  docPath: z.string().min(1, "Upload your proof document"),
});

/** Files the request; the database function re-validates everything (§3.3 B step 3). */
export async function submitProof(input: z.input<typeof proofSchema>): Promise<ActionResult> {
  const parsed = proofSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form");
  const { fullName, studentId, whatsapp, docPath } = parsed.data;

  const { supabase, user } = await getSession();
  if (!user) return fail("Your session expired. Log in again.");
  if (!(await withinLimit("proofSubmit", user.id))) return fail(TOO_MANY);

  const { error } = await supabase.rpc("submit_verification", {
    p_full_name: fullName,
    p_roll_no: studentId,
    p_doc_path: docPath,
    p_whatsapp: whatsapp || undefined,
  });
  // 22023/P0001 carry messages written for students; anything else stays generic.
  if (error)
    return fail(
      ["22023", "P0001"].includes(error.code) ? error.message : "Couldn't submit. Try again.",
    );

  // After the response, so a slow mail server never delays the student.
  after(() => sendStatusEmail(user.id, { kind: "submitted" }));
  // Phase 7: the AI pre-check sorts the admin queue; it never decides.
  after(() => precheckVerification(user.id));
  return { ok: true, data: undefined };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
