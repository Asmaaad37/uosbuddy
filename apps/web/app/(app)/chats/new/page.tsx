import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NewGroupForm } from "@/components/chat/new-group-form";
import { getSession } from "@/lib/auth/session";
import { ScreenHeader } from "@/components/ui/screen-header";

export const metadata: Metadata = { title: "New group" };

/** Phase 4 task 5: create a custom group. */
export default async function NewGroupPage() {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login?next=/chats/new");
  const { data: connections } = await supabase.rpc("my_connections");

  return (
    <AppShell>
      <ScreenHeader
        title="New group"
        back="/chats?tab=groups"
        subtitle={<>Up to 50 people, chosen from your connections.</>}
      />
      <NewGroupForm connections={connections ?? []} />
    </AppShell>
  );
}
