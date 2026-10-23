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

  // Do not add logic between client creation and getUser(): it revalidates the token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!needsProfile(path)) return response;

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("verification_status, onboarding_step, role")
      .eq("id", user.id)
      .maybeSingle();
    profile = data;
  }

  const target = redirectFor(path, !!user, profile);
  if (!target) return response;

  // Carry refreshed session cookies over to the redirect.
  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
