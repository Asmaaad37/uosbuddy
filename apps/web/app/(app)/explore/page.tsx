import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, Heart, MapPin, UserPlus, Users } from "lucide-react";
import { getDirectoryCounts, getSuggestions, loadDirectory } from "@/actions/discovery";
import { AppShell } from "@/components/app-shell";
import { BatchReveal } from "@/components/discovery/batch-reveal";
import { ShareButton } from "@/components/discovery/share-button";
import { AIBuddyCard } from "@/components/explore/aibuddy-card";
import { BatchCard } from "@/components/explore/batch-card";
import { NextClass } from "@/components/explore/next-class";
import { Shortcuts } from "@/components/explore/shortcuts";
import { SuggestedPerson } from "@/components/explore/suggested-person";
import { BellSlot } from "@/components/notifications/bell-slot";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { Avatar } from "@/components/ui/avatar";
import { SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GroupedList, Row } from "@/components/ui/grouped-list";
import { ScreenHeader } from "@/components/ui/screen-header";
import { aiEnabled } from "@/lib/ai/claude.server";
import { getSession } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { inviteMessage, whatsappLink } from "@/lib/invite-text";
import { toWeekItems, type MyTimetable } from "@/lib/timetable/week";

export const metadata: Metadata = { title: "Explore" };

type Props = { searchParams: Promise<{ welcome?: string }> };

/** Explore (redesign §5.1): your batch, shortcuts, AIBuddy, people like you, find people. */
export default async function ExplorePage({ searchParams }: Props) {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) redirect("/login?next=/explore");
  const welcome = (await searchParams).welcome === "1";
  const name = profile.full_name ?? profile.handle ?? "Me";
  // The university is in Sargodha; students who share a hometown see their own city.
  const city = profile.hometown_city?.trim() || "Sargodha";

  const [
    counts,
    suggestions,
    batch,
    { data: dept },
    { data: inviteCode },
    { data: interest },
    { data: waitlisted },
    { data: official },
    ownSlots,
  ] = await Promise.all([
    getDirectoryCounts(),
    getSuggestions(8),
    loadDirectory({ scope: "batch" }),
    profile.department_id
      ? supabase
          .from("departments")
          .select("short_code")
          .eq("id", profile.department_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc("my_invite_code"),
    supabase
      .from("profile_interests")
      .select("interest_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("feature_waitlist")
      .select("feature")
      .eq("user_id", user.id)
      .eq("feature", "aibuddy")
      .maybeSingle(),
    supabase.rpc("my_timetable"),
    supabase.rpc("current_term").then(({ data: term }) =>
      supabase
        .from("timetable_slots")
        .select("id, day, start_min, end_min, label, room")
        .eq("user_id", user.id)
        .eq("term", term ?? ""),
    ),
  ]);
  const week = toWeekItems(
    (official as unknown as MyTimetable | null)?.classes ?? [],
    ownSlots.data ?? [],
  );

  const inviteUrl = inviteCode ? `/i/${inviteCode}` : "/";
  const batchCount = counts?.batch_count ?? 0;
  const code = dept?.short_code ?? null;
  const year = profile.batch_year;
  const batchLabel = code && year ? `${code} ${year}` : null;
  const batchPeople = batch.ok ? batch.data.people : [];
  const shareText = batchLabel
    ? `I'm on UOSBuddy. Come find ${batchLabel}:`
    : "I'm on UOSBuddy. Come find our batch:";

  return (
    <AppShell>
      <ScreenHeader
        title="Explore"
        actions={
          <span className="flex items-center gap-2 lg:hidden">
            <BellSlot />
            <Link href="/me" className="rounded-pill">
              {/* Named by the hidden text, so the visible initials don't clash with it. */}
              <span aria-hidden>
                <Avatar name={name} src={profile.avatar_url} size={44} />
              </span>
              <span className="sr-only">My profile</span>
            </Link>
          </span>
        }
      />

      {welcome ? (
        <BatchReveal
          count={batchCount}
          label={batchLabel ?? "your batch"}
          people={batchPeople}
          inviteUrl={inviteUrl}
        />
      ) : (
        <BatchCard
          title={code && year ? `${code} · Class of ${year}` : "Your batch"}
          me={{ name, src: profile.avatar_url }}
          batchmates={batchPeople.map((p) => ({
            name: p.full_name ?? p.handle ?? "Student",
            src: p.avatar_url,
          }))}
          count={batchCount}
          inviteUrl={inviteUrl}
          shareText={shareText}
          whatsappHref={whatsappLink(
            inviteMessage({
              batchLabel,
              count: batchCount + 1,
              url: new URL(inviteUrl, publicEnv.NEXT_PUBLIC_SITE_URL).toString(),
            }),
          )}
        />
      )}

      <NextClass items={week} />
      <InstallPrompt />
      <Shortcuts />
      <AIBuddyCard ready={aiEnabled()} waiting={!!waitlisted} />

      <section aria-labelledby="people-like-you" className="grid gap-3">
        <SectionHeader
          id="people-like-you"
          title="People like you"
          trailing={
            suggestions.length > 0 ? (
              <Link href="/explore/batch?tab=all" className="hit">
                See all
              </Link>
            ) : null
          }
        />
        {suggestions.length > 0 ? (
          <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-1">
            {suggestions.map((s) => (
              <li key={s.person.id} className="shrink-0 snap-start">
                <SuggestedPerson person={s.person} reason={s.reasons[0]} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={UserPlus}
            action={
              <ShareButton
                variant="plain"
                size="sm"
                label="Invite batchmates"
                icon={false}
                url={inviteUrl}
                text={shareText}
              />
            }
          >
            Suggestions appear as more of your batch joins.
          </EmptyState>
        )}
      </section>

      <section aria-labelledby="find-people" className="grid gap-3">
        <SectionHeader id="find-people" title="Find people" />
        <GroupedList aria-label="Find people">
          {profile.section && (
            <Row
              icon={Users}
              title="Your section"
              subtitle="People you sit with every day"
              href="/explore/batch?tab=section"
            />
          )}
          <Row
            icon={MapPin}
            title={`From ${city}`}
            subtitle="Handy for trips home and Eid travel"
            href={`/explore/batch?tab=all&hometown=${encodeURIComponent(city)}`}
          />
          <Row
            icon={Heart}
            title="Shared interests"
            subtitle={interest ? "Match on what you picked" : "Pick a few interests first"}
            href={
              interest
                ? `/explore/batch?tab=all&interest=${interest.interest_id}`
                : "/setup/interests?edit=1"
            }
          />
          <Row
            icon={GraduationCap}
            title={code ? `Seniors in ${code}` : "Seniors"}
            subtitle="Mentors who've done your courses"
            href="/mentors"
          />
        </GroupedList>
      </section>
    </AppShell>
  );
}
