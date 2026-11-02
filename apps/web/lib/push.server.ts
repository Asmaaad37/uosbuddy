import "server-only";
import webpush from "web-push";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushPayload = { title: string; body?: string; url: string; tag?: string };

let configured = false;

/** Push is off until the VAPID keys are set (`npx web-push generate-vapid-keys`). */
export function pushEnabled() {
  return !!(publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY && serverEnv.VAPID_PRIVATE_KEY);
}

function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    serverEnv.VAPID_SUBJECT ??
      `mailto:${publicEnv.NEXT_PUBLIC_SUPPORT_EMAIL ?? "admin@example.com"}`,
    publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    serverEnv.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

/**
 * Sends one payload to every browser each user subscribed. Subscriptions the push service
 * says are gone (404/410) are deleted. Returns how many pushes were accepted.
 */
export async function pushTo(userIds: string[], payload: PushPayload): Promise<number> {
  if (!pushEnabled() || userIds.length === 0) return 0;
  configure();
  const db = createAdminClient();
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60, urgency: "high" },
        );
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.id);
        else console.error("[push] send failed", status ?? error);
      }
    }),
  );
  if (gone.length) await db.from("push_subscriptions").delete().in("id", gone);
  return sent;
}
