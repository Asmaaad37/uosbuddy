"use server";

import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
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
  // RLS would hide their row from you, so this needs the service role. Only this browser
  // holds its unguessable endpoint, and the push then stops going to the previous student.
  await createAdminClient().from("push_subscriptions").delete().eq("endpoint", endpoint);
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
  digest: z.boolean(),
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

/** "Notify me" for a feature that isn't live yet: join (true) or leave (false) its list. */
export async function setWaitlist(feature: "aibuddy", on: boolean): Promise<ActionResult<boolean>> {
  if (feature !== "aibuddy") return { ok: false, error: "Unknown feature" };
  const { supabase, user } = await getSession();
  if (!user) return { ok: false, error: "Your session expired. Log in again." };
  const { data, error } = await supabase.rpc("set_waitlist", { p_feature: feature, p_on: on });
  if (error) return { ok: false, error: "Couldn't save that. Try again." };
  return { ok: true, data: !!data };
}

/** Admins: tell everyone waiting for a feature that it's live. Returns how many were told. */
export async function announceFeature(feature: "aibuddy"): Promise<ActionResult<number>> {
  if (feature !== "aibuddy") return { ok: false, error: "Unknown feature" };
  const { supabase, user } = await getSession();
  if (!user) return { ok: false, error: "Your session expired. Log in again." };
  const { data, error } = await supabase.rpc("announce_feature", { p_feature: feature });
  if (error)
    return {
      ok: false,
      error: error.code === "42501" ? "Admins only" : "Couldn't send. Try again.",
    };
  return { ok: true, data: data ?? 0 };
}

/**
 * Admins (Launch check): a notification to yourself. It goes the real way, through the
 * database trigger and /api/push, so a push arriving proves the whole chain works.
 */
export async function sendTestNotification(): Promise<ActionResult> {
  const { supabase, user } = await getSession();
  if (!user) return { ok: false, error: "Your session expired. Log in again." };
  const { error } = await supabase.rpc("send_test_notification");
  if (error)
    return {
      ok: false,
      error: error.code === "42501" ? "Admins only" : "Couldn't send. Try again.",
    };
  return { ok: true, data: undefined };
}
