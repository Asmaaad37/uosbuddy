import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * A profile as the signed-in student may see it. Reads only `profiles_public`, which
 * applies the owner's privacy settings, so a hidden profile comes back `null` exactly
 * like a missing one.
 */
export async function getProfileCard(supabase: Supabase, by: { handle: string } | { id: string }) {
  const query = supabase.from("profiles_public").select("*");
  const { data: profile } = await (
    "handle" in by ? query.eq("handle", by.handle) : query.eq("id", by.id)
  ).maybeSingle();
  if (!profile?.id) return null;

  const [{ data: department }, { data: program }, { data: interests }] = await Promise.all([
    profile.department_id
      ? supabase.from("departments").select("name").eq("id", profile.department_id).maybeSingle()
      : { data: null },
    profile.program_id
      ? supabase.from("programs").select("name").eq("id", profile.program_id).maybeSingle()
      : { data: null },
    supabase
      .from("profile_interests")
      .select("interests(id, label, emoji, sort)")
      .eq("user_id", profile.id),
  ]);

  return {
    ...profile,
    id: profile.id,
    departmentName: department?.name ?? null,
    programName: program?.name ?? null,
    interests: (interests ?? [])
      .flatMap((row) => (row.interests ? [row.interests] : []))
      .sort((a, b) => a.sort - b.sort),
  };
}

export type ProfileCardData = NonNullable<Awaited<ReturnType<typeof getProfileCard>>>;
