"use server";

import { z } from "zod";
import { CATEGORIES } from "@/lib/backup";
import type { ActionResult } from "./onboarding";
import { fail, friendly, session } from "@/lib/action-helpers.server";

const id = z.uuid();

const askSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Say what you need in a few words")
    .max(100, "Keep the title under 100 characters"),
  details: z.string().trim().max(1000, "Keep the details under 1,000 characters").optional(),
  category: z.enum(CATEGORIES, { message: "Pick a category" }),
  urgency: z.number().int().min(1).max(3),
  hours: z.number().int().min(1).max(72),
  course: z.uuid().optional(),
});

/** Phase 5 task 4: ask your classmates for backup. They're notified straight away. */
export async function createBackup(
  input: z.input<typeof askSchema>,
): Promise<ActionResult<string>> {
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { title, details, category, urgency, hours, course } = parsed.data;
  const { data, error } = await s.supabase.rpc("create_backup", {
    p_title: title,
    p_details: details ?? "",
    p_category: category,
    p_urgency: urgency,
    p_hours: hours,
    p_course: course,
  });
  if (error || !data) return fail(friendly(error, "Couldn't send your request. Try again."));
  return { ok: true, data };
}

/** Offer to help: returns the temporary chat with the requester. */
export async function claimBackup(request: string): Promise<ActionResult<string>> {
  if (!id.safeParse(request).success) return fail("Request not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data, error } = await s.supabase.rpc("claim_backup", { p_request: request });
  if (error || !data) return fail(friendly(error, "Couldn't claim it. Try again."));
  return { ok: true, data };
}

async function lifecycle(
  fn: "unclaim_backup" | "resolve_backup" | "cancel_backup",
  request: string,
): Promise<ActionResult> {
  if (!id.safeParse(request).success) return fail("Request not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc(fn, { p_request: request });
  if (error) return fail(friendly(error, "Couldn't update the request. Try again."));
  return { ok: true, data: undefined };
}

export async function unclaimBackup(request: string) {
  return lifecycle("unclaim_backup", request);
}
export async function resolveBackup(request: string) {
  return lifecycle("resolve_backup", request);
}
export async function cancelBackup(request: string) {
  return lifecycle("cancel_backup", request);
}
