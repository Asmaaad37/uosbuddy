import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env.server";
import { describe } from "@/lib/notifications";
import { messagePushText } from "@/lib/push-text";
import { pushEnabled, pushTo } from "@/lib/push.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bearerMatches } from "@/lib/bearer.server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ kind: z.enum(["notification", "message"]), id: z.uuid() });

/**
 * Phase 5 task 6: called by the database (pg_net) for each new notification or chat
 * message, with `Authorization: Bearer $PUSH_WEBHOOK_SECRET`. Sends the Web Push.
 */
export async function POST(request: NextRequest) {
  const secret = serverEnv.PUSH_WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json({ error: "PUSH_WEBHOOK_SECRET is not set" }, { status: 503 });
  if (!bearerMatches(request, secret))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  if (!pushEnabled()) return NextResponse.json({ sent: 0, reason: "VAPID keys not set" });

  const db = createAdminClient();
  const { kind, id } = parsed.data;

  if (kind === "notification") {
    const { data: n } = await db
      .from("notifications")
      .select("user_id, type, entity_id, payload, actor_id")
      .eq("id", id)
      .maybeSingle();
    if (!n) return NextResponse.json({ sent: 0 });
    const [{ data: actor }, { data: pref }] = await Promise.all([
      n.actor_id
        ? db.from("profiles").select("full_name, handle").eq("id", n.actor_id).maybeSingle()
        : Promise.resolve({ data: null }),
      db.from("notification_prefs").select("previews").eq("user_id", n.user_id).maybeSingle(),
    ]);
    const text = describe({
      type: n.type,
      entity_id: n.entity_id,
      payload: n.payload,
      actor_name: actor?.full_name ?? null,
      actor_handle: actor?.handle ?? null,
    });
    const sent = await pushTo([n.user_id], {
      title: text.title,
      // A comment's or request's words stay off the lock screen when previews are off.
      body: pref?.previews === false ? undefined : text.body,
      url: text.href,
      tag: `${n.type}:${n.entity_id ?? id}`,
    });
    return NextResponse.json({ sent });
  }

  // A chat message: everyone else in the chat who hasn't muted it or turned message
  // pushes off, and isn't blocked from the sender.
  const { data: m } = await db
    .from("messages")
    .select("conversation_id, sender_id, body, attachment_path, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (!m || m.deleted_at) return NextResponse.json({ sent: 0 });
  const [{ data: conv }, { data: members }, { data: sender }] = await Promise.all([
    db.from("conversations").select("kind, title").eq("id", m.conversation_id).maybeSingle(),
    db
      .from("conversation_members")
      .select("user_id, muted, accepted_at")
      .eq("conversation_id", m.conversation_id)
      .neq("user_id", m.sender_id ?? ""),
    db
      .from("profiles")
      .select("full_name, handle")
      .eq("id", m.sender_id ?? "")
      .maybeSingle(),
  ]);
  const candidates = (members ?? []).filter((x) => !x.muted).map((x) => x.user_id);
  if (!candidates.length || !conv) return NextResponse.json({ sent: 0 });
  const [{ data: prefs }, { data: blocks }] = await Promise.all([
    db
      .from("notification_prefs")
      .select("user_id, messages, push, previews")
      .in("user_id", candidates),
    db
      .from("blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${m.sender_id},blocked_id.eq.${m.sender_id}`),
  ]);
  const off = new Set((prefs ?? []).filter((p) => !p.messages || !p.push).map((p) => p.user_id));
  const blocked = new Set((blocks ?? []).flatMap((b) => [b.blocker_id, b.blocked_id]));
  const recipients = candidates.filter((u) => !off.has(u) && !blocked.has(u));

  const who = sender?.full_name ?? sender?.handle ?? "Someone";
  const text = m.body ?? (m.attachment_path ? "📷 Photo" : "New message");
  const requests = new Set((members ?? []).filter((x) => !x.accepted_at).map((x) => x.user_id));
  const hidden = new Set((prefs ?? []).filter((p) => p.previews === false).map((p) => p.user_id));
  // Group recipients by what their lock screen should show, then send each group once.
  const groups = new Map<string, { title: string; body: string; to: string[] }>();
  for (const u of recipients) {
    const shown = messagePushText({
      dm: conv.kind === "dm",
      chatTitle: conv.title,
      sender: who,
      text,
      isRequest: requests.has(u),
      previews: !hidden.has(u),
    });
    const key = `${shown.title}\n${shown.body}`;
    groups.set(key, { ...shown, to: [...(groups.get(key)?.to ?? []), u] });
  }
  let sent = 0;
  for (const g of groups.values()) {
    sent += await pushTo(g.to, {
      title: g.title,
      body: g.body,
      url: `/chats/${m.conversation_id}`,
      tag: `chat:${m.conversation_id}`,
    });
  }
  return NextResponse.json({ sent });
}
