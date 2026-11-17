"use server";

import { z } from "zod";
import type { Database } from "@uosbuddy/shared";
import type { ActionResult } from "./onboarding";
import { fail, friendly, session } from "@/lib/action-helpers.server";

export type Message = Database["public"]["Tables"]["messages"]["Row"];

const id = z.uuid();
const PAGE = 30;

/** Opens (or finds) a DM and returns its id. */
export async function startDm(target: string): Promise<ActionResult<string>> {
  if (!id.safeParse(target).success) return fail("Student not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data, error } = await s.supabase.rpc("start_dm", { p_target: target });
  if (error || !data) return fail(friendly(error, "Couldn't open the chat. Try again."));
  return { ok: true, data };
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

/** Phase 4 task 4: join your batch or section chat (created the first time someone joins). */
export async function joinBatchChat(scope: "batch" | "section"): Promise<ActionResult<string>> {
  if (scope !== "batch" && scope !== "section") return fail("Choose a chat");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data, error } = await s.supabase.rpc("join_batch_chat", { p_scope: scope });
  if (error || !data) return fail(friendly(error, "Couldn't join. Try again."));
  return { ok: true, data };
}

const groupSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the group a name")
    .max(60, "Keep the name under 60 characters"),
  emoji: z.string().trim().max(8).optional(),
  members: z
    .array(z.uuid())
    .min(1, "Pick at least one person")
    .max(49, "Groups hold up to 50 people"),
});

/** Phase 4 task 5: a custom group from your connections. */
export async function createGroup(
  input: z.input<typeof groupSchema>,
): Promise<ActionResult<string>> {
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { title, emoji, members } = parsed.data;
  const { data, error } = await s.supabase.rpc("create_group", {
    p_title: title,
    p_emoji: emoji ?? "",
    p_members: members,
  });
  if (error || !data) return fail(friendly(error, "Couldn't create the group. Try again."));
  return { ok: true, data };
}

export async function leaveConversation(conversationId: string): Promise<ActionResult> {
  if (!id.safeParse(conversationId).success) return fail("Chat not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("leave_conversation", { p_conversation: conversationId });
  if (error) return fail(friendly(error, "Couldn't leave. Try again."));
  return { ok: true, data: undefined };
}

const renameSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the group a name")
    .max(60, "Keep the name under 60 characters"),
  emoji: z.string().trim().max(8, "Pick one emoji").default(""),
});

/** C4: rename a group (its owner or admins). */
export async function renameGroup(
  conversationId: string,
  input: z.input<typeof renameSchema>,
): Promise<ActionResult> {
  if (!id.safeParse(conversationId).success) return fail("Chat not found");
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the name");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("rename_group", {
    p_conversation: conversationId,
    p_title: parsed.data.title,
    p_emoji: parsed.data.emoji,
  });
  if (error) return fail(friendly(error, "Couldn't rename the group. Try again."));
  return { ok: true, data: undefined };
}

/** C4: add connections to a group (its owner or admins). */
export async function addGroupMembers(
  conversationId: string,
  members: string[],
): Promise<ActionResult> {
  if (!id.safeParse(conversationId).success) return fail("Chat not found");
  const parsed = z.array(id).min(1, "Pick at least one person").max(49).safeParse(members);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Pick who to add");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("add_group_members", {
    p_conversation: conversationId,
    p_members: parsed.data,
  });
  if (error) return fail(friendly(error, "Couldn't add them. Try again."));
  return { ok: true, data: undefined };
}

/** C4: remove someone from a group (its owner, or an admin removing a member). */
export async function removeGroupMember(
  conversationId: string,
  member: string,
): Promise<ActionResult> {
  if (!id.safeParse(conversationId).success || !id.safeParse(member).success) {
    return fail("Member not found");
  }
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("remove_group_member", {
    p_conversation: conversationId,
    p_user: member,
  });
  if (error) return fail(friendly(error, "Couldn't remove them. Try again."));
  return { ok: true, data: undefined };
}

/** Delete a one-to-one chat from your list (only yours; it returns with a new message). */
export async function hideConversation(conversationId: string): Promise<ActionResult> {
  if (!id.safeParse(conversationId).success) return fail("Chat not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("hide_conversation", { p_conversation: conversationId });
  if (error) return fail("Couldn't delete. Try again.");
  return { ok: true, data: undefined };
}
