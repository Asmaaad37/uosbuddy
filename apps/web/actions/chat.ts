"use server";

import { z } from "zod";
import type { Database } from "@uosbuddy/shared";
import { withinLimit } from "@/lib/abuse.server";
import { getSession } from "@/lib/auth/session";
import type { ActionResult } from "./onboarding";

export type Message = Database["public"]["Tables"]["messages"]["Row"];

const fail = (error: string) => ({ ok: false, error }) as const;
const id = z.uuid();
const PAGE = 30;

function friendly(error: { code?: string; message: string } | null, fallback: string) {
  if (error && ["42501", "22023", "P0002"].includes(error.code ?? "")) return error.message;
  return fallback;
}

async function session() {
  const s = await getSession();
  return s.user ? { supabase: s.supabase, user: s.user } : null;
}

/** Opens (or finds) a DM and returns its id. */
export async function startDm(target: string): Promise<ActionResult<string>> {
  if (!id.safeParse(target).success) return fail("Student not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data, error } = await s.supabase.rpc("start_dm", { p_target: target });
  if (error || !data) return fail(friendly(error, "Couldn't open the chat. Try again."));
  return { ok: true, data };
}

const sendSchema = z
  .object({
    conversationId: z.uuid(),
    body: z.string().trim().max(4000, "Messages are up to 4,000 characters").optional(),
    attachmentPath: z.string().max(200).optional(),
    replyTo: z.uuid().optional(),
  })
  .refine((m) => m.body || m.attachmentPath, "Write a message");

/** Phase 4 task 3: send a message (rate-limited per student). */
export async function sendMessage(
  input: z.input<typeof sendSchema>,
): Promise<ActionResult<Message>> {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Write a message");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  if (!(await withinLimit("message", s.user.id))) {
    return fail("You're sending messages very fast. Wait a moment.");
  }
  const { conversationId, body, attachmentPath, replyTo } = parsed.data;
  const { data, error } = await s.supabase.rpc("send_message", {
    p_conversation: conversationId,
    p_body: body || undefined,
    p_attachment_path: attachmentPath,
    p_reply_to: replyTo,
  });
  if (error || !data) return fail(friendly(error, "Couldn't send. Try again."));
  return { ok: true, data: data as Message };
}

/** Older messages, newest first, before the given one (infinite scroll back in time). */
export async function loadOlder(
  conversationId: string,
  before: { createdAt: string; id: string },
): Promise<ActionResult<Message[]>> {
  if (!id.safeParse(conversationId).success || !id.safeParse(before.id).success) {
    return fail("Chat not found");
  }
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data, error } = await s.supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .or(
      `created_at.lt."${before.createdAt}",and(created_at.eq."${before.createdAt}",id.lt.${before.id})`,
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE);
  if (error) return fail("Couldn't load older messages.");
  return { ok: true, data: data ?? [] };
}

/** The newest page, for catching up after (re)connecting. */
export async function loadLatest(conversationId: string): Promise<ActionResult<Message[]>> {
  if (!id.safeParse(conversationId).success) return fail("Chat not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data, error } = await s.supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE);
  if (error) return fail("Couldn't load messages.");
  return { ok: true, data: data ?? [] };
}

export async function markRead(conversationId: string): Promise<void> {
  if (!id.safeParse(conversationId).success) return;
  const s = await session();
  if (!s) return;
  await s.supabase.rpc("mark_read", { p_conversation: conversationId });
}

export async function deleteMessage(messageId: string): Promise<ActionResult> {
  if (!id.safeParse(messageId).success) return fail("Message not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("delete_message", { p_message: messageId });
  if (error) return fail("Couldn't delete. Try again.");
  return { ok: true, data: undefined };
}

/** Accept or decline a message request (declining deletes the chat). */
export async function answerMessageRequest(
  conversationId: string,
  accept: boolean,
): Promise<ActionResult> {
  if (!id.safeParse(conversationId).success) return fail("Chat not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("answer_message_request", {
    p_conversation: conversationId,
    p_accept: accept,
  });
  if (error) return fail(friendly(error, "Couldn't answer. Try again."));
  return { ok: true, data: undefined };
}

export async function setMuted(conversationId: string, muted: boolean): Promise<ActionResult> {
  if (!id.safeParse(conversationId).success) return fail("Chat not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase
    .from("conversation_members")
    .update({ muted })
    .eq("conversation_id", conversationId)
    .eq("user_id", s.user.id);
  if (error) return fail("Couldn't update. Try again.");
  return { ok: true, data: undefined };
}
