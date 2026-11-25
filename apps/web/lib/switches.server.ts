import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Launch fix 3: the kill switches an admin can flip in /admin/flags. */
export type Switch = "chat" | "ai_buddy" | "timetable_alerts" | "signups";

/**
 * Whether a switch is on. A missing row counts as on, and so does a failed read: a database
 * hiccup must never switch a feature off. The database enforces chat, sign-ups and alerts itself.
 */
export async function switchOn(supabase: SupabaseClient, key: Switch): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("feature_flags")
      .select("enabled")
      .eq("key", key)
      .maybeSingle();
    if (error) return true;
    return data?.enabled ?? true;
  } catch {
    return true;
  }
}
