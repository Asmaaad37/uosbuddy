import "server-only";
import { getSession } from "@/lib/auth/session";

/** A failed action result. */
export const fail = (error: string) => ({ ok: false, error }) as const;

/**
 * The database explains its own refusals in plain words (not allowed, bad input, not found,
 * too many); anything else gets the caller's generic line.
 */
export function friendly(error: { code?: string; message: string } | null, fallback: string) {
  if (error && ["42501", "22023", "P0002", "54000"].includes(error.code ?? "")) {
    return error.message;
  }
  return fallback;
}

/** The signed-in student's client, user and profile, or null when signed out. */
export async function session() {
  const s = await getSession();
  return s.user ? { supabase: s.supabase, user: s.user, profile: s.profile } : null;
}
