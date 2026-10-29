import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding/shell";
import { InterestsForm } from "@/components/setup/interests-form";
import { getSession } from "@/lib/auth/session";
import { OPENING_MOVES, isEditing } from "@/lib/setup";

export const metadata: Metadata = { title: "Your interests" };

/** Screen 8: interests and Opening Move. */
export default async function InterestsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) redirect("/login?next=/setup/interests");
  if (profile.onboarding_step < 2) redirect("/setup");
  const editing = isEditing((await searchParams).edit, profile.onboarding_step);

  const [{ data: interests }, { data: mine }] = await Promise.all([
    supabase.from("interests").select("id, label, emoji, category").order("sort"),
    supabase.from("profile_interests").select("interest_id").eq("user_id", user.id),
  ]);
  const prompt = (OPENING_MOVES as readonly string[]).includes(profile.opening_move_prompt ?? "")
    ? (profile.opening_move_prompt as (typeof OPENING_MOVES)[number])
    : "";

  return (
    <OnboardingShell
      back={editing ? "/me" : "/setup/about"}
      step={editing ? undefined : 3}
      title="What are you into?"
      subtitle="Pick up to 10. We use them to suggest people you'll get along with."
    >
      <InterestsForm
        interests={interests ?? []}
        initial={{
          selected: (mine ?? []).map((m) => m.interest_id),
          prompt,
          answer: profile.opening_move ?? "",
        }}
        next={editing ? "/me" : undefined}
        submitLabel={editing ? "Save" : undefined}
      />
    </OnboardingShell>
  );
}
