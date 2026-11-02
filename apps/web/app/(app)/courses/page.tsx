import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AddCourse } from "@/components/courses/add-course";
import { termLabel } from "@/lib/academics";
import { getSession } from "@/lib/auth/session";

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
        <h1 className="text-[28px] leading-tight font-bold">My courses</h1>
        <p className="text-ink-2">
          {termLabel(term)}. Notes, past papers, study groups and a chat for each.
        </p>
      </div>
      <AddCourse departments={departments ?? []} myDepartment={profile.department_id} />
      {courses?.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {courses.map((c) => (
            <li key={c.id}>
              <Link
                href={`/courses/${c.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
              >
                <span className="grid min-w-0 flex-1">
                  <span className="font-semibold">{c.code}</span>
                  <span className="truncate text-sm text-ink-2">
                    {c.title} · {c.enrolled_count} taking it
                  </span>
                </span>
                <ChevronRight className="size-4 text-ink-2" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-ink-2">
          Add the courses you&apos;re taking this term to find classmates, notes and past papers.
        </p>
      )}
    </AppShell>
  );
}
