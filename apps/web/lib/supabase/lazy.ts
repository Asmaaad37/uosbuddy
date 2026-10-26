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
