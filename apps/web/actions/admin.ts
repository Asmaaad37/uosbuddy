"use server";

import { after } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { sendStatusEmail } from "@/lib/email/send.server";
import type { ActionResult } from "./onboarding";

const decisionSchema = z
  .object({
    requestId: z.uuid(),
    decision: z.enum(["verified", "rejected", "needs_info"]),
    reason: z.string().trim().max(500, "Keep the reason under 500 characters").optional(),
  })
  .refine((d) => d.decision === "verified" || !!d.reason, {
    message: "Give the student a reason",
    path: ["reason"],
  });

/**
 * Approve, reject or ask for more (Phase 1 task 7). The database function checks the caller is
 * an admin, updates the request and profile, and writes audit_log; this action adds the email.
 */
export async function decideVerification(
  input: z.input<typeof decisionSchema>,
): Promise<ActionResult> {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the decision" };
  }
  const { requestId, decision, reason } = parsed.data;

  const { supabase, profile } = await getSession();
  if (profile?.role !== "admin") return { ok: false, error: "Only admins can review." };

  const { data: request } = await supabase
    .from("verification_requests")
    .select("user_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return { ok: false, error: "That request no longer exists." };

  const { error } = await supabase.rpc("decide_verification", {
    p_request: requestId,
    p_decision: decision,
    p_reason: reason,
  });
  if (error) {
    return {
      ok: false,
      error: ["22023", "P0001"].includes(error.code)
        ? error.message
        : "Couldn't save the decision.",
    };
  }

  after(() =>
    sendStatusEmail(
      request.user_id,
      decision === "verified" ? { kind: "approved" } : { kind: decision, reason: reason! },
    ),
  );
  return { ok: true, data: undefined };
}
