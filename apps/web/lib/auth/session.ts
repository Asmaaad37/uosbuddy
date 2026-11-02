import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user and their profile, for Server Components, actions and route handlers.
 * Cached per request, so a page and its shell (e.g. the notification bell) share one lookup.
 */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null } as const;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return { supabase, user, profile } as const;
});
