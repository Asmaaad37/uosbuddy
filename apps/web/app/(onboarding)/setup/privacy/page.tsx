import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding/shell";
import { PrivacyForm } from "@/components/setup/privacy-form";
import { getSession } from "@/lib/auth/session";
import { PRIVACY_PRESETS } from "@/lib/setup";

export const metadata: Metadata = { title: "Your privacy" };

/** Screen 9: privacy presets, with details. Finishing sends the student to /explore. */
export default async function PrivacyPage() {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) redirect("/login?next=/setup/privacy");
  if (profile.onboarding_step < 3) redirect("/setup");

  const { data: privacy } = await supabase
    .from("privacy_settings")
    .select(
      "profile_visibility, photo_visibility, allow_dms_from, show_hometown, show_in_directory",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <OnboardingShell
      back="/setup/interests"
      step={4}
      title="Who sees what"
      subtitle="Only verified UoS students can ever see you. Your roll number and email stay private."
    >
      <PrivacyForm
        initial={privacy ?? PRIVACY_PRESETS.open.settings}
        submitLabel="Finish"
        onSavedHref="/explore?welcome=1"
      />
    </OnboardingShell>
  );
}
