import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@uosbuddy/shared";
import { serverEnv } from "@/lib/env.server";

/**
 * Service-role client: bypasses RLS. Use only in server actions and route handlers that
 * have already checked authorization (e.g. `is_admin()`), and write `audit_log` for admin actions.
 */
export function createAdminClient() {
  const key = serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createClient<Database>(serverEnv.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
