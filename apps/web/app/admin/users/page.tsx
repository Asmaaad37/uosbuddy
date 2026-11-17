import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { UserRow, type AdminUser } from "@/components/admin/user-row";
import { homePath } from "@/lib/auth/routing";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "People", robots: { index: false } };

type Props = { searchParams: Promise<{ q?: string }> };

/** Phase 9 task 1: find a student by name, handle, email or roll number. */
export default async function AdminUsersPage({ searchParams }: Props) {
  const { supabase, profile } = await getSession();
  if (profile?.role !== "admin") notFound();
  const q = (await searchParams).q?.trim().slice(0, 80) ?? "";
  const [{ data: users }, { data: departments }, { data: scopes }] = await Promise.all([
    supabase.rpc("admin_search_users", { p_query: q || undefined }),
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("moderator_scopes").select("user_id, space"),
  ]);
  const spaces = [
    { value: "campus", label: "Campus feed" },
    ...(departments ?? []).map((d) => ({ value: `department:${d.id}`, label: d.name })),
  ];

  return (
    <AdminShell current="/admin/users" isAdmin back={homePath(profile)}>
      <div>
        <h1 className="text-[28px] font-bold">People</h1>
        <p className="text-sec">
          Warnings, bans and moderator roles are recorded in the audit log.
        </p>
      </div>
      <form action="/admin/users">
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="Search people"
          placeholder="Name, handle, email or roll number"
          className="h-11 w-full rounded-pill border border-sep bg-surface px-4 text-subhead focus-visible:border-accent focus-visible:outline-none"
        />
      </form>
      <ul className="divide-y divide-sep overflow-hidden rounded-card bg-surface shadow-card contrast-more:border contrast-more:border-label">
        {(users ?? []).map((u) => (
          <UserRow
            key={u.id}
            user={u as AdminUser}
            spaces={spaces}
            scopes={(scopes ?? []).filter((s) => s.user_id === u.id).map((s) => s.space)}
          />
        ))}
        {!users?.length && <li className="p-6 text-center text-sec">No one matches.</li>}
      </ul>
    </AdminShell>
  );
}
