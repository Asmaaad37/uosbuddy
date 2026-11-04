import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  CourseRow,
  DepartmentForm,
  ProgramForm,
  type Dept,
  type Prog,
} from "@/components/admin/catalogue-forms";
import { homePath } from "@/lib/auth/routing";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Catalogue", robots: { index: false } };

type Props = { searchParams: Promise<{ course?: string }> };

/** Phase 9 task 1: departments, programs and student-added courses. */
export default async function CataloguePage({ searchParams }: Props) {
  const { supabase, profile } = await getSession();
  if (profile?.role !== "admin") notFound();
  const q = (await searchParams).course?.trim().slice(0, 60) ?? "";
  const [{ data: departments }, { data: programs }, { data: courses }] = await Promise.all([
    supabase.from("departments").select("id, name, short_code, faculty, aliases").order("name"),
    supabase
      .from("programs")
      .select("id, department_id, name, level, duration_semesters")
      .order("name"),
    q
      ? supabase
          .from("courses")
          .select("id, code, title, department:departments(short_code)")
          .or(`code.ilike.%${q.replace(/[,()%]/g, "")}%,title.ilike.%${q.replace(/[,()%]/g, "")}%`)
          .order("code")
          .limit(30)
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <AdminShell current="/admin/catalogue" isAdmin back={homePath(profile)}>
      <div>
        <h1 className="text-[28px] font-bold">Catalogue</h1>
        <p className="text-ink-2">Edits are recorded in the audit log.</p>
      </div>

      <section aria-labelledby="courses" className="grid gap-2">
        <h2 id="courses" className="text-lg font-bold">
          Courses
        </h2>
        <form action="/admin/catalogue">
          <input
            type="search"
            name="course"
            defaultValue={q}
            aria-label="Find a course"
            placeholder="Find a course by code or title"
            className="h-11 w-full rounded-pill border border-line bg-surface px-4 text-[15px] focus-visible:border-brand focus-visible:outline-none"
          />
        </form>
        {q && (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {(courses ?? []).map((c) => (
              <CourseRow
                key={c.id}
                course={{
                  id: c.id,
                  code: c.code,
                  title: c.title,
                  department: c.department?.short_code ?? "",
                }}
              />
            ))}
            {!courses?.length && <li className="p-4 text-center text-ink-2">No courses match.</li>}
          </ul>
        )}
      </section>

      <section aria-labelledby="departments" className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id="departments" className="text-lg font-bold">
            Departments and programs
          </h2>
          <DepartmentForm />
        </div>
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {(departments ?? []).map((d) => (
            <li key={d.id} className="grid gap-2 p-3">
              <details>
                <summary className="flex cursor-pointer list-none items-center gap-2">
                  <span className="w-14 shrink-0 font-mono text-sm font-semibold">
                    {d.short_code}
                  </span>
                  <span className="flex-1 font-semibold">{d.name}</span>
                  <span className="text-xs text-ink-2">
                    {(programs ?? []).filter((p) => p.department_id === d.id).length} programs
                  </span>
                </summary>
                <div className="mt-3 grid gap-2 pl-16">
                  <DepartmentForm dept={d as Dept} />
                  <ul className="grid gap-1.5 text-sm">
                    {(programs ?? [])
                      .filter((p) => p.department_id === d.id)
                      .map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center gap-2">
                          <span className="flex-1">
                            {p.name}{" "}
                            <span className="text-ink-2">
                              · {p.level} · {p.duration_semesters} semesters
                            </span>
                          </span>
                          <ProgramForm department={d.id} program={p as Prog} />
                        </li>
                      ))}
                  </ul>
                  <ProgramForm department={d.id} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
