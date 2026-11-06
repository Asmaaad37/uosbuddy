import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDirectoryCounts, loadDirectory } from "@/actions/discovery";
import { AppShell } from "@/components/app-shell";
import { Directory } from "@/components/discovery/directory";
import { getSession } from "@/lib/auth/session";
import { SCOPES, type Scope } from "@/lib/discovery";

export const metadata: Metadata = { title: "Your batch" };

type Props = {
  searchParams: Promise<{ tab?: string; hometown?: string; interest?: string; q?: string }>;
};

/** Phase 3 task 3: the batch directory. */
export default async function BatchPage({ searchParams }: Props) {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) redirect("/login?next=/explore/batch");

  const hasSection = !!profile.section;
  const { tab, hometown: rawHometown, interest: rawInterest, q } = await searchParams;
  const query = q?.trim().slice(0, 60) || undefined;
  const interest = rawInterest && /^[0-9a-f-]{36}$/i.test(rawInterest) ? rawInterest : undefined;
  const hometown = rawHometown?.trim().slice(0, 60) || undefined;
  const requested = SCOPES.find((s) => s.key === tab)?.key;
  const scope: Scope =
    requested && (requested !== "section" || hasSection)
      ? requested
      : hasSection
        ? "section"
        : "batch";

  const [page, counts, { data: interests }] = await Promise.all([
    loadDirectory({ scope, hometown, interest, query }),
    getDirectoryCounts(),
    supabase.from("interests").select("id, label, emoji").order("sort"),
  ]);

  return (
    <AppShell back="/explore">
      <div className="grid gap-1">
        <h1 className="text-[28px] leading-tight font-bold">Your batch</h1>
        <p className="text-ink-2">Start with your section, then widen out to all of UoS.</p>
      </div>
      <Directory
        initialScope={scope}
        initialPage={page.ok ? page.data : { people: [], next: null }}
        counts={{
          section: counts?.section_count ?? 0,
          batch: counts?.batch_count ?? 0,
          department: counts?.department_count ?? 0,
          all: counts?.university_count ?? 0,
        }}
        interests={interests ?? []}
        hasSection={hasSection}
        initialFilters={hometown || interest ? { hometown, interest } : undefined}
        initialQuery={query}
      />
    </AppShell>
  );
}
