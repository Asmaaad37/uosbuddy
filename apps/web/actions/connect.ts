"use server";

import { z } from "zod";
import { withinLimit } from "@/lib/abuse.server";
import type { ActionResult } from "./onboarding";
import { fail, friendly, session } from "@/lib/action-helpers.server";

export type ConnectionState = "none" | "outgoing" | "incoming" | "connected";

const id = z.uuid();

/** Phase 4 task 2: ask to connect, optionally answering their Opening Move. */
export async function requestConnection(
  target: string,
  note?: string,
): Promise<ActionResult<ConnectionState>> {
  if (!id.safeParse(target).success) return fail("Student not found");
  if (note && note.length > 300) return fail("Keep your note under 300 characters");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data, error } = await s.supabase.rpc("request_connection", {
    p_target: target,
    p_message: note?.trim() || undefined,
  });
  if (error) return fail(friendly(error, "Couldn't send the request. Try again."));
  return { ok: true, data: data as ConnectionState };
}

export async function respondConnection(
  requester: string,
  accept: boolean,
): Promise<ActionResult<ConnectionState>> {
  if (!id.safeParse(requester).success) return fail("Request not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data, error } = await s.supabase.rpc("respond_connection", {
    p_requester: requester,
    p_accept: accept,
  });
  if (error) return fail(friendly(error, "Couldn't answer the request. Try again."));
  return { ok: true, data: data as ConnectionState };
}

/** Withdraw a request or disconnect. */
export async function removeConnection(other: string): Promise<ActionResult> {
  if (!id.safeParse(other).success) return fail("Student not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("remove_connection", { p_other: other });
  if (error) return fail("Couldn't update. Try again.");
  return { ok: true, data: undefined };
}

export async function blockUser(target: string): Promise<ActionResult> {
  if (!id.safeParse(target).success) return fail("Student not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("block_user", { p_target: target });
  if (error) return fail(friendly(error, "Couldn't block. Try again."));
  return { ok: true, data: undefined };
}

export async function unblockUser(target: string): Promise<ActionResult> {
  if (!id.safeParse(target).success) return fail("Student not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("unblock_user", { p_target: target });
  if (error) return fail("Couldn't unblock. Try again.");
  return { ok: true, data: undefined };
}

const reportSchema = z.object({
  targetType: z.enum([
    "profile",
    "message",
    "conversation",
    "post",
    "comment",
    "resource",
    "listing",
    "ride",
    "event",
  ]),
  targetId: z.uuid(),
  reason: z.enum(["spam", "harassment", "fake", "inappropriate", "self_harm", "other"]),
  details: z.string().trim().max(1000).optional(),
});

/** Phase 4 task 6: report a profile, message or chat to the moderators. */
export async function report(input: z.input<typeof reportSchema>): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return fail("Choose a reason");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  if (!(await withinLimit("report", s.user.id))) return fail("Too many reports today.");
  const { targetType, targetId, reason, details } = parsed.data;
  const { error } = await s.supabase.rpc("report", {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: reason,
    p_details: details || undefined,
  });
  if (error) return fail(friendly(error, "Couldn't send the report. Try again."));
  return { ok: true, data: undefined };
}
