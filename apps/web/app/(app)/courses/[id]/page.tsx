import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CourseControls, StudyGroups } from "@/components/courses/course-controls";
import { Resources } from "@/components/courses/resources";
import { Avatar } from "@/components/ui/avatar";
import { getSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Course" };

const TABS = [
  { key: "files", label: "Files" },
  { key: "groups", label: "Study groups" },
  { key: "classmates", label: "Classmates" },
] as const;
type Tab = (typeof TABS)[number]["key"];

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> };

/** Phase 6 task 3: a course room — files, study groups, classmates and the course chat. */
export default async function CoursePage({ params, searchParams }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, user } = await getSession();
  if (!user) redirect(`/login?next=/courses/${id}`);
  const tabParam = (await searchParams).tab;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : "files";

  const { data: course } = await supabase.rpc("course_overview", { p_course: id }).maybeSingle();
  if (!course) notFound();

  const [{ data: resources }, { data: votes }, { data: groups }, { data: people }] =
    await Promise.all([
      tab === "files"
        ? supabase
            .from("resources")
            .select(
              "id, kind, title, file_path, mime_type, size_bytes, year, teacher_name, upvotes, uploader_id, status",
            )
            .eq("course_id", id)
            .in("status", ["published", "held"])
            .order("upvotes", { ascending: false })
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      tab === "files"
        ? supabase.from("resource_votes").select("resource_id").eq("user_id", user.id)
        : Promise.resolve({ data: [] }),
      tab === "groups"
        ? supabase.rpc("course_study_groups", { p_course: id })
        : Promise.resolve({ data: [] }),
      tab === "classmates"
        ? supabase.rpc("course_people", { p_course: id })
        : Promise.resolve({ data: [] }),
    ]);
  const voted = new Set((votes ?? []).map((v) => v.resource_id));

  return (
    <AppShell back="/courses">
      <div className="grid gap-1">
        <p className="text-sm font-semibold text-brand">
          {course.code} · {course.department_code}
        </p>
        <h1 className="text-[28px] leading-tight font-bold">{course.title}</h1>
        <p className="text-ink-2">
          {course.enrolled_count} {course.enrolled_count === 1 ? "student is" : "students are"}{" "}
          taking it this term
        </p>
      </div>
      <CourseControls course={id} enrolled={course.me_enrolled} chatId={course.chat_id} />

      <nav aria-label="Course sections" className="flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "files" ? `/courses/${id}` : `/courses/${id}?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "flex h-10 items-center rounded-pill border px-4 text-sm font-semibold",
              tab === t.key
                ? "border-ink bg-ink text-bg"
                : "border-line bg-surface hover:border-ink-2/50",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "files" && (
        <Resources
          course={id}
          enrolled={course.me_enrolled}
          initial={(resources ?? [])
            .filter((r) => r.status === "published" || r.uploader_id === user.id)
            .map((r) => ({ ...r, mine: r.uploader_id === user.id, voted: voted.has(r.id) }))}
        />
      )}
      {tab === "groups" && (
        <StudyGroups course={id} groups={groups ?? []} enrolled={course.me_enrolled} />
      )}
      {tab === "classmates" &&
        (people?.length ? (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {people.map((p) => {
              const name = p.full_name ?? p.handle ?? "Student";
              return (
                <li key={p.id}>
                  <Link
                    href={`/people/${p.handle}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2"
                  >
                    <Avatar name={name} src={p.avatar_url} size="sm" />
                    <span className="flex-1 truncate font-medium">{name}</span>
                    {p.section && <span className="text-sm text-ink-2">Sec {p.section}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-line p-6 text-center text-ink-2">
            Nobody else has added this course yet.
          </p>
        ))}
    </AppShell>
  );
}
