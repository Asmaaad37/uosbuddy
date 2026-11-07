import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookOpen, FileSearch } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AddCourse } from "@/components/courses/add-course";
import { termLabel } from "@/lib/academics";
import { getSession } from "@/lib/auth/session";
import { EmptyState } from "@/components/ui/empty-state";
import { GroupedList, Row } from "@/components/ui/grouped-list";

export const metadata: Metadata = { title: "My courses" };

/** Phase 6 task 2: your courses this term, and adding more. */
export default async function CoursesPage() {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) redirect("/login?next=/courses");
  const [{ data: courses }, { data: departments }, { data: term }] = await Promise.all([
    supabase.rpc("my_courses"),
    supabase
      .from("departments")
      .select("id, short_code, name")
      .eq("university_id", profile.university_id ?? "")
      .order("short_code"),
    supabase.rpc("current_term"),
  ]);

  return (
    <AppShell bell back="/explore">
      <div className="grid gap-1">
        <h1 className="text-large-title">My courses</h1>
        <p className="text-sec">
          {termLabel(term)}. Notes, past papers, study groups and a chat for each.
        </p>
      </div>
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
