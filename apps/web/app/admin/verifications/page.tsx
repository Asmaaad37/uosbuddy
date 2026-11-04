import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewQueue, type QueueItem } from "@/components/admin/review-queue";
import { homePath, safeNext } from "@/lib/auth/routing";
import type { Precheck } from "@/lib/ai/precheck";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Verification queue", robots: { index: false } };

/** Signed document links last long enough to review a batch, then expire. */
const DOC_LINK_SECONDS = 15 * 60;

/** Admin verification queue (Phase 1 task 7). RLS lets admins read requests, PII and documents. */
export default async function VerificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { supabase, profile } = await getSession();
  // The middleware already redirects non-admins; this is the server-side check (§3.6 point 3).
  if (profile?.role !== "admin") notFound();
  // Back to the page that opened the queue; otherwise the admin's usual home.
  const from = safeNext((await searchParams).from);
  const back = from ?? homePath(profile);

  const [{ data: rows }, { count: waitingOnStudents }] = await Promise.all([
    supabase
      .from("verification_requests")
      .select(
        "id, updated_at, doc_path, roll_no_submitted, full_name_submitted, ai_precheck, applicant:profiles!verification_requests_user_id_fkey(full_name, private_profile(personal_email, uni_email, whatsapp))",
      )
      .eq("status", "pending")
      .order("updated_at", { ascending: true })
      .limit(50),
    supabase
      .from("verification_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "needs_info"),
  ]);

  const paths = (rows ?? []).flatMap((r) => (r.doc_path ? [r.doc_path] : []));
  const { data: signed } = paths.length
    ? await supabase.storage.from("verification-docs").createSignedUrls(paths, DOC_LINK_SECONDS)
    : { data: [] };
  const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  const items: QueueItem[] = (rows ?? []).map((r) => {
    const pii = r.applicant?.private_profile;
    return {
      id: r.id,
      updatedAt: r.updated_at,
      docPath: r.doc_path,
      docUrl: (r.doc_path && urls.get(r.doc_path)) || null,
      submittedName: r.full_name_submitted,
      accountName: r.applicant?.full_name ?? null,
      studentId: r.roll_no_submitted,
      email: pii?.personal_email ?? pii?.uni_email ?? null,
      emailIsUni: !pii?.personal_email && !!pii?.uni_email,
      whatsapp: pii?.whatsapp ?? null,
      precheck: (r.ai_precheck as Precheck | null) ?? null,
    };
  });
  // Phase 7: high pre-check confidence first (§4.6); unscored last; oldest first otherwise.
  items.sort(
    (a, b) =>
      (b.precheck?.confidence ?? -1) - (a.precheck?.confidence ?? -1) ||
      a.updatedAt.localeCompare(b.updatedAt),
  );

  return (
    <div className="min-h-dvh">
      <header className="gutter flex items-center justify-between border-b border-line py-3">
        <Link
          href={
            from ? `/admin/verifications?from=${encodeURIComponent(from)}` : "/admin/verifications"
          }
          className="font-pixel text-lg"
        >
          UOSBUDDY ADMIN
        </Link>
        <nav className="flex gap-4 text-sm font-semibold text-brand">
          <Link href="/admin">Dashboard</Link>
          <Link href={back}>Back to app</Link>
        </nav>
      </header>
      <main className="gutter mx-auto max-w-6xl py-6">
        <ReviewQueue items={items} waitingOnStudents={waitingOnStudents ?? 0} />
      </main>
    </div>
  );
}
