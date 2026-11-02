import { NotificationBell } from "@/components/notifications/bell";
import { getSession } from "@/lib/auth/session";

/** The bell for the signed-in student, with their unread count. */
export async function BellSlot() {
  const { supabase, user } = await getSession();
  if (!user) return null;
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);
  return <NotificationBell userId={user.id} initialUnread={count ?? 0} />;
}
