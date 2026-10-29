import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding/shell";
import { AboutForm } from "@/components/setup/about-form";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "About you" };

/** Screen 7: photo, handle, bio, hometown, day scholar or hostelite. */
export default async function AboutPage() {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) redirect("/login?next=/setup/about");
  if (profile.onboarding_step < 1) redirect("/setup/academic");

  const { data: privacy } = await supabase
    .from("privacy_settings")
    .select("photo_visibility")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <OnboardingShell
      back="/setup/academic"
      step={2}
      title="About you"
      subtitle="A face and a few words make people far more likely to say hi."
    >
      <AboutForm
        userId={user.id}
        initial={{
          name: profile.full_name ?? "",
          handle: profile.handle ?? "",
          bio: profile.bio ?? "",
          hometown: profile.hometown_city ?? "",
          residence: profile.residence,
          avatarUrl: profile.avatar_url,
          photoVisibility: privacy?.photo_visibility ?? "batch",
        }}
      />
    </OnboardingShell>
  );
}
