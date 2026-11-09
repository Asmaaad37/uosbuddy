import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { WomenOnlyRequest } from "@/components/rides/women-only-request";
import { PrivacyForm } from "@/components/setup/privacy-form";
import { getSession } from "@/lib/auth/session";
import { PRIVACY_PRESETS } from "@/lib/setup";

export const metadata: Metadata = { title: "Privacy" };

/** Phase 2 task 6: Settings → Privacy, the same presets and details as setup screen 9. */
export default async function PrivacySettingsPage() {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login?next=/me/privacy");

  const [{ data: privacy }, { data: womenOnly }] = await Promise.all([
    supabase
      .from("privacy_settings")
      .select(
        "profile_visibility, photo_visibility, allow_dms_from, show_hometown, show_in_directory, share_free_time",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("women_only_access").select("status").eq("user_id", user.id).maybeSingle(),
  ]);

  return (
    <AppShell back="/me">
      <div className="grid gap-2">
        <h1 className="text-large-title">Privacy</h1>
        <p className="text-sec">
          Only verified UoS students can ever see you. Your roll number and email stay private.
        </p>
      </div>
      <PrivacyForm
        initial={privacy ?? PRIVACY_PRESETS.open.settings}
        submitLabel="Save"
        onSavedHref="/me"
      />
      <WomenOnlyRequest status={womenOnly?.status ?? null} />
    </AppShell>
  );
}
