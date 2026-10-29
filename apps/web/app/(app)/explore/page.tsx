import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, UserRound } from "lucide-react";
import { ProfileStamps } from "@/components/profile/profile-card";
import { Button } from "@/components/ui/button";
import { OnboardingShell } from "@/components/onboarding/shell";
import { getSession } from "@/lib/auth/session";
import { signOut } from "@/actions/onboarding";

export const metadata: Metadata = { title: "Explore" };

// Phase 3 replaces this with "Find your batch" (Section 7, screen 10).
export default async function ExplorePage() {
  const { supabase, user, profile } = await getSession();
  const isAdmin = profile?.role === "admin";
  const { data: pii } = await supabase
    .from("private_profile")
    .select("uni_email")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  // RLS lets only admins count other students' requests.
  const { count: waiting } = isAdmin
    ? await supabase
        .from("verification_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
    : { count: null };

  return (
    <OnboardingShell
      title={`You're all set${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}!`}
      subtitle="Finding your batch opens soon. You'll see who else from your department and section is here."
    >
      <ProfileStamps hasUniEmail={!!pii?.uni_email} isMentor={profile?.is_mentor} />
      <Button asChild block>
        <Link href="/me">
          <UserRound />
          My profile
        </Link>
      </Button>
      {isAdmin && (
        <Button asChild block variant="secondary">
          <Link href="/admin/verifications?from=/explore">
            <ShieldCheck />
            Verification queue
            {waiting ? (
              <span className="rounded-pill bg-brand px-2 py-0.5 text-xs text-brand-ink">
                {waiting} waiting
              </span>
            ) : null}
          </Link>
        </Button>
      )}
      <form action={signOut} className="mt-auto">
        <Button type="submit" block variant="ghost">
          Log out
        </Button>
      </form>
    </OnboardingShell>
  );
}
