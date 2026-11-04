import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@uosbuddy/shared";
import { publicEnv } from "@/lib/env";
import { needsProfile, redirectFor } from "@/lib/auth/routing";

/**
 * Refreshes the auth session cookie on every request, then routes by verification state
 * (visitor → /, pending → /pending, …). Middleware is a UX redirect, never a security
 * boundary: RLS enforces access.
 */
const ACTIVE_COOKIE = "uob_active";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do not add logic between client creation and getClaims(): it refreshes the session.
  // getClaims verifies the token locally when the project signs with asymmetric keys (no
  // round trip to the auth server on every navigation) and falls back to getUser otherwise.
  const { data: auth } = await supabase.auth.getClaims();
  const user = auth?.claims?.sub ? { id: auth.claims.sub } : null;

  const path = request.nextUrl.pathname;
  if (!needsProfile(path)) return response;

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("verification_status, onboarding_step, role, banned_at, deleted_at")
      .eq("id", user.id)
      .maybeSingle();
    profile = data;

    // Phase 9: count the student as active today (DAU/WAU), once per day per browser.
    const today = new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);
    if (profile && request.cookies.get(ACTIVE_COOKIE)?.value !== today) {
      await supabase.rpc("touch_activity");
      response.cookies.set(ACTIVE_COOKIE, today, {
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        maxAge: 60 * 60 * 24,
      });
    }
  }

  const target = redirectFor(path, !!user, profile);
  if (!target) return response;

  // Carry refreshed session cookies over to the redirect.
  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
