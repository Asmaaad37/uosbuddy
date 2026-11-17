import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookOpen, FileSearch } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AddCourse } from "@/components/courses/add-course";
import { NewTermCourses } from "@/components/courses/new-term";
import { termLabel } from "@/lib/academics";
import { getSession } from "@/lib/auth/session";
import { EmptyState } from "@/components/ui/empty-state";
import { GroupedList, Row } from "@/components/ui/grouped-list";
import { ScreenHeader } from "@/components/ui/screen-header";
import { BellSlot } from "@/components/notifications/bell-slot";

export const metadata: Metadata = { title: "My courses" };

/** Phase 6 task 2: your courses this term, and adding more. */
export default async function CoursesPage() {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) redirect("/login?next=/courses");
  const [{ data: courses }, { data: departments }, { data: term }, { data: lastTerm }] =
    await Promise.all([
      supabase.rpc("my_courses"),
      supabase
        .from("departments")
        .select("id, short_code, name")
        .eq("university_id", profile.university_id ?? "")
        .order("short_code"),
      supabase.rpc("current_term"),
      supabase.rpc("last_term_courses"),
    ]);
  // Offer last term's courses until the student starts this term's list with something new.
  const mine = new Set((courses ?? []).map((c) => c.id));
  const last = new Set((lastTerm ?? []).map((c) => c.id));
  const offer = (lastTerm ?? []).filter((c) => !mine.has(c.id));
  const showNewTerm = offer.length > 0 && (courses ?? []).every((c) => last.has(c.id));

  return (
    <AppShell>
      <ScreenHeader
        title="My courses"
        back="/explore"
        subtitle={<>{termLabel(term)}. Notes, past papers, study groups and a chat for each.</>}
        actions={
          <span className="lg:hidden">
            <BellSlot />
          </span>
        }
      />
      {showNewTerm && <NewTermCourses courses={offer} />}
      <AddCourse departments={departments ?? []} myDepartment={profile.department_id} />
      {courses?.length ? (
        <GroupedList header="This term">
          {courses.map((c) => (
            <Row
              key={c.id}
              href={`/courses/${c.id}`}
              title={c.code}
              subtitle={`${c.title} · ${c.enrolled_count} taking it`}
            />
          ))}
        </GroupedList>
      ) : (
        <EmptyState icon={BookOpen}>
          Add the courses you&apos;re taking this term to find classmates, notes and past papers.
        </EmptyState>
      )}
      <GroupedList header="Across UoS">
        <Row
          href="/resources"
          icon={FileSearch}
          title="Resources"
          subtitle="Search notes and past papers from every course"
        />
      </GroupedList>
    </AppShell>
  );
}
