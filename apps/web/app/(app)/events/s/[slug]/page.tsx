import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EventCard, type EventItem } from "@/components/events/event-card";
import { EventSheet } from "@/components/events/event-sheet";
import { SocietyButton } from "@/components/events/society-sheet";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/badge";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Society" };

type Props = { params: Promise<{ slug: string }> };

/** Phase 8 task 3: a society's page: about, upcoming events, members. */
export default async function SocietyPage({ params }: Props) {
  const { supabase, user } = await getSession();
  const { slug } = await params;
  if (!user) redirect(`/login?next=/events/s/${encodeURIComponent(slug)}`);

  const { data: societies } = await supabase.rpc("societies_list");
  const s = societies?.find((x) => x.slug === slug);
  if (!s) notFound();
  const [{ data: events }, { data: people }] = await Promise.all([
    supabase.rpc("events_board", { p_society: s.id }),
    supabase.rpc("society_people", { p_society: s.id }),
  ]);
  const admin = s.my_role === "admin";

  return (
    <AppShell bell back="/events?tab=societies">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-16 shrink-0 place-items-center rounded-card bg-raised text-3xl text-sec"
        >
          {s.emoji || s.name.slice(0, 1)}
        </span>
        <div className="grid min-w-0 gap-1">
          <h1 className="text-[26px] leading-tight font-bold">{s.name}</h1>
          <p className="text-sm text-sec">
            {s.member_count} {s.member_count === 1 ? "member" : "members"}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {!s.verified && <Pill tone="outline">Awaiting an admin check</Pill>}
            {s.verified && !s.my_role && <SocietyButton society={s.id} kind="join" />}
            {s.my_role && <SocietyButton society={s.id} kind="leave" />}
          </div>
        </div>
      </div>
      {s.description && <p className="whitespace-pre-wrap">{s.description}</p>}
      {!s.verified && admin && (
        <p className="rounded-card bg-surface p-4 text-sm text-sec shadow-card">
          Only you and admins can see this page until it&apos;s verified. You&apos;ll get a
          notification, then you can post events.
        </p>
      )}
      {admin && s.verified && <EventSheet societies={[{ id: s.id, name: s.name }]} />}

      <section aria-labelledby="upcoming" className="grid gap-2">
        <h2 id="upcoming" className="text-lg font-bold">
          Upcoming
        </h2>
        {events?.length ? (
          events.map((e) => <EventCard key={e.id} event={e as EventItem} />)
        ) : (
          <p className="text-sm text-sec">No upcoming events.</p>
        )}
      </section>

      <section aria-labelledby="members" className="grid gap-2">
        <h2 id="members" className="text-lg font-bold">
          Members
        </h2>
        <ul className="divide-y divide-sep overflow-hidden rounded-card border border-sep bg-surface">
          {(people ?? []).map((p) => (
            <li key={p.user_id} className="flex items-center gap-3 px-3 py-2.5">
              <Avatar name={p.full_name} src={p.avatar_url} size="sm" />
              <Link href={`/people/${p.handle}`} className="min-w-0 flex-1 truncate font-medium">
                {p.full_name}
              </Link>
              {p.role === "admin" ? (
                <Pill tone="learn" className="h-6 px-2 text-xs">
                  Admin
                </Pill>
              ) : (
                admin && <SocietyButton society={s.id} kind="make-admin" user={p.user_id} />
              )}
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
