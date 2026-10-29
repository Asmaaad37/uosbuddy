import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Stamp } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OnboardingShell } from "@/components/onboarding/shell";
import { getSession } from "@/lib/auth/session";
import { signOut } from "@/actions/onboarding";

export const metadata: Metadata = { title: "Set up your profile" };

// Phase 2 replaces this with the multi-step setup (Section 7, screens 6–9).
export default async function SetupPage() {
  const { supabase, profile } = await getSession();
  const byEmail = profile?.verification_method === "uni_email";
  const isAdmin = profile?.role === "admin";

  // RLS lets only admins count other students' requests.
  const { count: waiting } = isAdmin
    ? await supabase
        .from("verification_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
    : { count: null };

  return (
    <OnboardingShell
      title={`You're in${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}!`}
      subtitle="Profile setup opens soon. Then you'll see who else from your batch is here."
    >
      <Stamp tone={byEmail ? "email" : "verified"} className="self-start">
        {byEmail ? "UoS email" : "Verified"}
      </Stamp>
      {isAdmin && (
        <Button asChild block variant="secondary">
          <Link href="/admin/verifications">
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
