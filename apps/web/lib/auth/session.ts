import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user and their profile, for Server Components, actions and route handlers.
 * Cached per request, so a page and its shell (e.g. the notification bell) share one lookup.
 *
 * The session is checked with getClaims, which verifies the token's signature locally (the
 * project signs with ES256 keys), instead of asking the Auth server on every request. The
 * middleware does the same. Bans and deletions are still enforced: the profile below and
 * the database's own checks (is_verified) read them on every request.
 */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { supabase, user: null, profile: null } as const;
  const user = {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
  };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return { supabase, user, profile } as const;
});
