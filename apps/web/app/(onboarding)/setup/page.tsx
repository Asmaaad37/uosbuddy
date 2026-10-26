import type { Metadata } from "next";
import { Stamp } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OnboardingShell } from "@/components/onboarding/shell";
import { getSession } from "@/lib/auth/session";
import { signOut } from "@/actions/onboarding";

export const metadata: Metadata = { title: "Set up your profile" };

// Phase 2 replaces this with the multi-step setup (Section 7, screens 6–9).
export default async function SetupPage() {
  const { profile } = await getSession();
  const byEmail = profile?.verification_method === "uni_email";

  return (
    <OnboardingShell
      title={`You're in${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}!`}
      subtitle="Profile setup opens soon. Then you'll see who else from your batch is here."
    >
      <Stamp tone={byEmail ? "email" : "verified"} className="self-start">
        {byEmail ? "UoS email" : "Verified"}
      </Stamp>
      <form action={signOut} className="mt-auto">
        <Button type="submit" block variant="ghost">
          Log out
        </Button>
      </form>
    </OnboardingShell>
  );
}
