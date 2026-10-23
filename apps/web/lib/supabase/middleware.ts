import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@uosbuddy/shared";
import { publicEnv } from "@/lib/env";

/**
 * Refreshes the auth session cookie on every request. Routing by verification state
 * (visitor → /, pending → /pending, …) is added in Phase 1. Middleware is a UX redirect,
 * never a security boundary: RLS enforces access.
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
  await supabase.auth.getUser();

  return response;
}
