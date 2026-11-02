import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PrefsForm } from "@/components/notifications/prefs-form";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Notification settings" };

/** Phase 5 task 6: per-type notification preferences. */
export default async function NotificationSettingsPage() {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login?next=/me/notifications");
  const { data: prefs } = await supabase
    .from("notification_prefs")
    .select("connections, backup, comments, messages, push")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <AppShell back="/me">
      <div className="grid gap-1">
        <h1 className="text-[28px] leading-tight font-bold">Notifications</h1>
        <p className="text-ink-2">Choose what pings you. Blocked students never notify you.</p>
      </div>
      <PrefsForm
        initial={
          prefs ?? { connections: true, backup: true, comments: true, messages: true, push: true }
        }
      />
    </AppShell>
  );
}
