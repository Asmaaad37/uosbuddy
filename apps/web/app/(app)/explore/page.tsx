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
import { ComingUp } from "@/components/explore/coming-up";
import { NextClass } from "@/components/explore/next-class";
import { Shortcuts } from "@/components/explore/shortcuts";
import { InviteCard, SuggestedPerson } from "@/components/explore/suggested-person";
import { BellSlot } from "@/components/notifications/bell-slot";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { Avatar } from "@/components/ui/avatar";
import { SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipLink } from "@/components/ui/chip";
import { ScreenHeader } from "@/components/ui/screen-header";
import { aiEnabled } from "@/lib/ai/claude.server";
import { getSession } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { inviteMessage, whatsappLink } from "@/lib/invite-text";
import { toWeekItems, type MyTimetable } from "@/lib/timetable/week";
import { pakistanToday, upcoming, type CalendarEvent } from "@/lib/calendar";

export const metadata: Metadata = { title: "Explore" };

type Props = { searchParams: Promise<{ welcome?: string }> };

/**
 * Explore (docs/design/explore-v2.png): your batch as the hero with the one orange action,
 * four shortcuts and More, what's next, AIBuddy, people like you, and find-people chips.
 */
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
    { data: calendar },
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
    supabase
      .from("calendar_events")
      .select("id, term, kind, title, notes, starts_on, ends_on, tentative")
      .eq("status", "published")
      .gte("starts_on", new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10))
      .order("starts_on")
      .limit(20),
  ]);
  const today = pakistanToday();
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
  // "Saturday, 21 Nov" in Pakistan time.
  const pk = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", ...opts }).format(new Date());
  const date = `${pk({ weekday: "long" })}, ${pk({ day: "numeric", month: "short" })}`;

  return (
    <AppShell>
      <ScreenHeader
        title="Explore"
        eyebrow={date}
        actionsBesideTitle
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
          // The year students joined, not graduation: "Batch 2024".
          title={code && year ? `${code} · Batch ${year}` : "Your batch"}
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

      <Shortcuts />
      <NextClass items={week} />
      <ComingUp events={upcoming((calendar ?? []) as CalendarEvent[], today, 1)} today={today} />
      <InstallPrompt />
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
            <li className="shrink-0 snap-start">
              <InviteCard url={inviteUrl} text={shareText} />
            </li>
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
        <div className="flex flex-wrap gap-2.5">
          {profile.section && (
            <ChipLink icon={Users} href="/explore/batch?tab=section">
              My section
            </ChipLink>
          )}
          <ChipLink
            icon={MapPin}
            href={`/explore/batch?tab=all&hometown=${encodeURIComponent(city)}`}
          >
            From {city}
          </ChipLink>
          <ChipLink
            icon={Heart}
            href={
              interest
                ? `/explore/batch?tab=all&interest=${interest.interest_id}`
                : "/setup/interests?edit=1"
            }
          >
            Same interests
          </ChipLink>
          <ChipLink icon={GraduationCap} href="/mentors">
            {code ? `${code} seniors` : "Seniors"}
          </ChipLink>
        </div>
      </section>
    </AppShell>
  );
}
