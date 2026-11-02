import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NewGroupForm } from "@/components/chat/new-group-form";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New group" };

/** Phase 4 task 5: create a custom group. */
export default async function NewGroupPage() {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login?next=/chats/new");
  const { data: connections } = await supabase.rpc("my_connections");

  return (
    <AppShell back="/chats?tab=groups">
      <div className="grid gap-1">
        <h1 className="text-[28px] leading-tight font-bold">New group</h1>
        <p className="text-ink-2">Up to 50 people, chosen from your connections.</p>
      </div>
      <NewGroupForm connections={connections ?? []} />
    </AppShell>
  );
}
