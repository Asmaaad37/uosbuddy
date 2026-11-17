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
import { ScreenHeader } from "@/components/ui/screen-header";
import { BellSlot } from "@/components/notifications/bell-slot";

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
    <AppShell>
      <ScreenHeader
        title="Mentors"
        back="/me"
        subtitle={<>Seniors in your department who are happy to help.</>}
        actions={
          <span className="lg:hidden">
            <BellSlot />
          </span>
        }
      />
      <MentorSwitch on={profile.is_mentor} eligible={(profile.semester ?? 0) >= 3} />
      <MentorRequests requests={requests ?? []} />
      <MyMentorships mentorships={mentorships ?? []} />
      <MentorList mentors={mentors ?? []} />
    </AppShell>
  );
}
