import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PrefsForm } from "@/components/notifications/prefs-form";
import { getSession } from "@/lib/auth/session";
import { ScreenHeader } from "@/components/ui/screen-header";

export const metadata: Metadata = { title: "Notification settings" };

/** Phase 5 task 6: per-type notification preferences. */
export default async function NotificationSettingsPage() {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login?next=/me/notifications");
  const [{ data: prefs }, { data: devices }] = await Promise.all([
    supabase
      .from("notification_prefs")
      .select("connections, backup, comments, messages, timetable, push, previews, digest")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("push_subscriptions").select("endpoint").eq("user_id", user.id),
  ]);

  return (
    <AppShell>
      <ScreenHeader
        title="Notifications"
        back="/me"
        subtitle={<>Choose what pings you. Blocked students never notify you.</>}
      />
      <PrefsForm
        endpoints={(devices ?? []).map((d) => d.endpoint)}
        initial={
          prefs ?? {
            connections: true,
            backup: true,
            comments: true,
            messages: true,
            push: true,
            timetable: true,
            previews: true,
            digest: true,
          }
        }
      />
    </AppShell>
  );
}
