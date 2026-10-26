import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { homePath } from "@/lib/auth/routing";

/**
 * Google OAuth return (§3.3 A). The `hd` hint is only a hint; the database trigger is the
 * real domain check. A brand-new Google-only account that the trigger did not verify is not a
 * UoS account: remove it, so that address stays free for the fresher path.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
  if (!code) return to("/login?error=oauth");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return to("/login?error=oauth");

  const user = data.user;
  const { data: profile } = await supabase
    .from("profiles")
    .select("verification_status, onboarding_step, role")
    .eq("id", user.id)
    .maybeSingle();

  const googleOnly = user.identities?.length === 1 && user.identities[0]?.provider === "google";
  if (googleOnly && profile?.verification_status === "unverified") {
    await supabase.auth.signOut();
    try {
      await createAdminClient().auth.admin.deleteUser(user.id);
    } catch {
      // Without the service-role key the empty account stays; it is unverified and harmless.
    }
    return to("/start/uni-email?error=not_uni");
  }

  return to(homePath(profile));
}
