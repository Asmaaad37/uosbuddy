import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@uosbuddy/shared";
import { publicEnv } from "@/lib/env";

/**
 * Cookie-free anon client for public, cacheable reads (catalogue, counters). Reading cookies
 * would make the page dynamic, so pages that only need public data use this instead.
 */
export function createPublicClient() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** The live university row, its domains and which sign-in providers are switched on. */
export async function getUniversity(slug = "uos") {
  try {
    const supabase = createPublicClient();
    // Fall back to defaults rather than hold the page if the database is slow or unreachable.
    const signal = AbortSignal.timeout(2500);
    const [{ data: uni }, { data: providers }] = await Promise.all([
      supabase
        .from("universities")
        .select(
          "id, name, short_name, roll_no_regex, registration_no_regex, university_domains(domain, mail_host), campuses(name, is_main)",
        )
        .eq("slug", slug)
        .abortSignal(signal)
        .maybeSingle(),
      supabase.from("auth_providers").select("mail_host, live").abortSignal(signal),
    ]);
    if (!uni) return null;
    const live = new Set((providers ?? []).filter((p) => p.live).map((p) => p.mail_host));
    return {
      ...uni,
      domains: uni.university_domains.map((d) => d.domain),
      googleLive: uni.university_domains.some(
        (d) => d.mail_host === "google" && live.has("google"),
      ),
    };
  } catch {
    return null;
  }
}
