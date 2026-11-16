import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  MentorList,
  MentorRequests,
  MentorSwitch,
  MyMentorships,
} from "@/components/mentors/mentors";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mentors" };

/** Phase 6 task 8: find a senior mentor in your department, or become one. */
export default async function MentorsPage() {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) redirect("/login?next=/mentors");
  const [{ data: mentors }, { data: requests }, { data: mentorships }] = await Promise.all([
    supabase.rpc("find_mentors"),
    profile.is_mentor ? supabase.rpc("mentor_requests") : Promise.resolve({ data: [] }),
    supabase.rpc("my_mentorships"),
  ]);

  return (
    <AppShell bell back="/me">
      <div className="grid gap-1">
        <h1 className="text-large-title">Mentors</h1>
        <p className="text-sec">Seniors in your department who are happy to help.</p>
      </div>
      <MentorSwitch on={profile.is_mentor} eligible={(profile.semester ?? 0) >= 3} />
      <MentorRequests requests={requests ?? []} />
      <MyMentorships mentorships={mentorships ?? []} />
      <MentorList mentors={mentors ?? []} />
    </AppShell>
  );
}
