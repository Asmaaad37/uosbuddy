import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DeleteAccount, ExportData } from "@/components/trust/data-actions";
import { getSession } from "@/lib/auth/session";
import { ScreenHeader } from "@/components/ui/screen-header";

export const metadata: Metadata = { title: "Your data" };

/** Phase 9 task 6: Me → Data. Export everything; delete the account (14-day grace). */
export default async function DataPage() {
  const { user, profile } = await getSession();
  if (!user || !profile) redirect("/login?next=/me/data");
  const deletesAt = profile.deleted_at
    ? new Date(new Date(profile.deleted_at).getTime() + 14 * 86_400_000).toISOString()
    : null;

  return (
    <AppShell>
      <ScreenHeader
        title="Your data"
        back={deletesAt ? undefined : "/me"}
        subtitle={<>It&apos;s yours. Take it with you, or delete it.</>}
      />
      {!deletesAt && (
        <section
          aria-labelledby="export"
          className="grid gap-3 rounded-card bg-surface p-4 shadow-card contrast-more:border contrast-more:border-label"
        >
          <h2 id="export" className="text-lg font-bold">
            Download your data
          </h2>
          <p className="text-sm text-sec">
            One JSON file with your profile, private details, connections, messages you sent, posts,
            comments, listings, rides, RSVPs, timetable and AI Buddy chats. Once a day.
          </p>
          <ExportData />
        </section>
      )}
      <section
        aria-labelledby="delete"
        className="grid gap-3 rounded-card bg-surface p-4 shadow-card contrast-more:border contrast-more:border-label"
      >
        <h2 id="delete" className="text-lg font-bold">
          {deletesAt ? "Your account is being deleted" : "Delete your account"}
        </h2>
        <DeleteAccount deletesAt={deletesAt} />
      </section>
    </AppShell>
  );
}
