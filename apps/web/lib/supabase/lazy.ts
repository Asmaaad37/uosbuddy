import type { createClient } from "./client";

let client: Promise<ReturnType<typeof createClient>> | undefined;

/**
 * The browser client, downloaded on first use (a submit or a realtime subscription) rather
 * than with the page, keeping sign-up pages under the 200 KB first-load budget (§2.2).
 */
export function browserClient() {
  client ??= import("./client").then((m) => m.createClient());
  return client;
}

/**
 * The browser client with realtime authenticated as the signed-in user. Subscribing before the
 * session loads connects as `anon`, and RLS then hides every row change from the channel.
 */
export async function realtimeClient() {
  const supabase = await browserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) await supabase.realtime.setAuth(session.access_token);
  return supabase;
}
