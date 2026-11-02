"use server";

import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import type { ActionResult } from "./onboarding";

const fail = (error: string) => ({ ok: false, error }) as const;

async function session() {
  const s = await getSession();
  return s.user ? { supabase: s.supabase, user: s.user } : null;
}

/** Everything read (or one notification). */
export async function markNotificationsRead(id?: string): Promise<void> {
  const s = await session();
  if (!s) return;
  await s.supabase.rpc("mark_notifications_read", { p_id: id });
}

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Phase 5 task 6: remember this browser for Web Push. */
export async function savePushSubscription(
  subscription: unknown,
  userAgent?: string,
): Promise<ActionResult> {
  const parsed = subscriptionSchema.safeParse(subscription);
  if (!parsed.success) return fail("This browser can't receive notifications.");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { endpoint, keys } = parsed.data;
  // One row per browser: if this endpoint was someone else's (shared phone), it moves to you.
  await s.supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  const { error } = await s.supabase.from("push_subscriptions").insert({
    user_id: s.user.id,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    user_agent: userAgent?.slice(0, 200),
  });
  if (error) return fail("Couldn't turn on notifications. Try again.");
  return { ok: true, data: undefined };
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const s = await session();
  if (!s) return;
  await s.supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

const prefsSchema = z.object({
  connections: z.boolean(),
  backup: z.boolean(),
  comments: z.boolean(),
  messages: z.boolean(),
  push: z.boolean(),
});
export type NotificationPrefs = z.infer<typeof prefsSchema>;

/** Settings → Notifications: which kinds you want (in the app and as pushes). */
export async function saveNotificationPrefs(input: NotificationPrefs): Promise<ActionResult> {
  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) return fail("Check your choices");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase
    .from("notification_prefs")
    .upsert({ user_id: s.user.id, ...parsed.data });
  if (error) return fail("Couldn't save. Try again.");
  return { ok: true, data: undefined };
}
