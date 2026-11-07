import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Ban,
  Bell,
  BookOpen,
  Calculator,
  CalendarDays,
  ChevronRight,
  Download,
  FileSearch,
  GraduationCap,
  Heart,
  Library,
  LifeBuoy,
  Lock,
  ShieldCheck,
  UserRound,
  VolumeX,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppearanceRow, LogOutRow } from "@/components/me/me-controls";
import { BellSlot } from "@/components/notifications/bell-slot";
import { Avatar } from "@/components/ui/avatar";
import { GroupedList, Row } from "@/components/ui/grouped-list";
import { ScreenHeader } from "@/components/ui/screen-header";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { getSession } from "@/lib/auth/session";
import { completeness } from "@/lib/profile";

export const metadata: Metadata = { title: "Me" };

function SmallPill({ children }: { children: React.ReactNode }) {
  return (
    <li className="inline-flex h-7 items-center gap-1 rounded-pill bg-raised px-2.5 text-footnote font-semibold text-label">
      {children}
    </li>
  );
}

/** Me (redesign §5.5): your profile, what's left to fill in, and every setting. */
export default async function MePage() {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) redirect("/login?next=/me");
  const isAdmin = profile.role === "admin";

  const [
    { data: pii },
    { count: interestCount },
    { data: badges },
    { data: dept },
    { count: waiting },
  ] = await Promise.all([
    supabase.from("private_profile").select("uni_email").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("profile_interests")
      .select("interest_id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase.rpc("profile_badges", { p_user: user.id }),
    profile.department_id
      ? supabase
          .from("departments")
          .select("short_code")
          .eq("id", profile.department_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // RLS lets only admins count other students' requests.
    isAdmin
      ? supabase
          .from("verification_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
      : Promise.resolve({ count: null }),
  ]);
  const hasUniEmail = !!pii?.uni_email;
  const { percent, nudges } = completeness({
    ...profile,
    interestCount: interestCount ?? 0,
    hasUniEmail,
  });
  const name = profile.full_name ?? profile.handle ?? "You";
  const studies =
    dept?.short_code && profile.batch_year
      ? `${dept.short_code} · Class of ${profile.batch_year}`
      : null;

  const profileBody = (
    <>
      <Avatar name={name} src={profile.avatar_url} size={64} />
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[20px] leading-6 font-bold tracking-[-0.01em]">
            {name}
          </span>
          <VerifiedBadge className="size-[18px] shrink-0" />
        </span>
        {studies && <span className="text-subhead text-sec">{studies}</span>}
        {((badges?.length ?? 0) > 0 || hasUniEmail || profile.is_mentor) && (
          <ul aria-label="Badges" className="flex flex-wrap gap-1.5 pt-0.5">
            {hasUniEmail && <SmallPill>UoS email</SmallPill>}
            {profile.is_mentor && <SmallPill>Mentor</SmallPill>}
            {badges?.map((b) => (
              <SmallPill key={b.slug}>
                <span aria-hidden>{b.emoji}</span> {b.name}
                <span className="sr-only">: {b.description}</span>
              </SmallPill>
            ))}
          </ul>
        )}
      </span>
    </>
  );

  return (
    <AppShell>
      <ScreenHeader
        title="Me"
        actions={
          <span className="lg:hidden">
            <BellSlot />
          </span>
        }
      />

      {profile.handle ? (
        <Link
          href={`/people/${profile.handle}`}
          className="flex items-center gap-4 rounded-card bg-surface p-4 shadow-card transition-transform duration-100 ease-out active:scale-[0.99]"
        >
          {profileBody}
          <span className="sr-only">View my profile</span>
          <ChevronRight className="size-[18px] shrink-0 text-ter" aria-hidden />
        </Link>
      ) : (
        <div className="flex items-center gap-4 rounded-card bg-surface p-4 shadow-card">
          {profileBody}
        </div>
      )}

      {nudges.length > 0 && (
        <section
          aria-labelledby="completeness"
          className="overflow-hidden rounded-card bg-surface shadow-card"
        >
          <div className="grid gap-3 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="completeness" className="text-headline">
                Finish your profile
              </h2>
              <span className="text-footnote text-sec tabular-nums">{percent}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Profile completeness"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-1.5 overflow-hidden rounded-pill bg-track"
            >
              <div className="h-full rounded-pill bg-accent" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-footnote text-sec">
              Complete profiles get more hellos from batchmates.
            </p>
          </div>
          <ul className="shadow-[inset_0_1px_0_var(--sep)] [&>li:last-child_[data-row-text]]:shadow-none">
            {nudges.map((n) => (
              <Row
                key={n.key}
                href={n.href}
                title={n.label}
                leading={
                  <span
                    aria-hidden
                    className="size-[22px] shrink-0 rounded-pill border-[1.5px] border-ter"
                  />
                }
              />
            ))}
          </ul>
        </section>
      )}

      <GroupedList header="Profile">
        <Row href="/setup/about?edit=1" icon={UserRound} title="Photo, handle and bio" />
        <Row
          href="/setup/academic?edit=1"
          icon={BookOpen}
          title="Studies"
          subtitle="Department, batch, section"
        />
        <Row href="/setup/interests?edit=1" icon={Heart} title="Interests and Opening Move" />
      </GroupedList>

      <GroupedList header="Study">
        <Row
          href="/courses"
          icon={Library}
          title="My courses"
          subtitle="Files, study groups and course chats"
        />
        <Row
          href="/resources"
          icon={FileSearch}
          title="Resources"
          subtitle="Notes and past papers from every course"
        />
        <Row
          href="/timetable"
          icon={CalendarDays}
          title="Timetable"
          subtitle="Your week, and free time with friends"
        />
        <Row
          href="/gpa"
          icon={Calculator}
          title="GPA calculator"
          subtitle="UoS grading, saved on this phone"
        />
        <Row
          href="/mentors"
          icon={GraduationCap}
          title="Mentors"
          subtitle="Find a senior, or mentor juniors"
        />
      </GroupedList>

      <GroupedList header="Privacy and settings">
        <Row
          href="/me/privacy"
          icon={Lock}
          title="Privacy"
          subtitle="Who sees your profile and can message you"
        />
        <Row href="/me/notifications" icon={Bell} title="Notifications" />
        <Row href="/me/blocked" icon={Ban} title="Blocked people" />
        <Row href="/me/muted" icon={VolumeX} title="Muted" />
        <AppearanceRow />
      </GroupedList>

      <GroupedList header="Help">
        <Row
          href="/safety"
          icon={LifeBuoy}
          title="Safety centre"
          subtitle="Reporting, privacy, help"
        />
        <Row
          href="/me/data"
          icon={Download}
          title="Your data"
          subtitle="Download it, or delete your account"
        />
      </GroupedList>

      {(isAdmin || profile.role === "moderator") && (
        <GroupedList header="Admin">
          {isAdmin ? (
            <Row
              href="/admin"
              icon={ShieldCheck}
              title="Admin"
              subtitle="Verification queue, reports, people"
              trailing={
                waiting ? (
                  <span className="rounded-pill bg-tint px-2.5 py-0.5 text-footnote font-semibold text-tint-text">
                    Review
                    <span className="sr-only">: {waiting} waiting</span>
                  </span>
                ) : undefined
              }
            />
          ) : (
            <Row
              href="/admin/reports"
              icon={ShieldCheck}
              title="Moderation"
              subtitle="Reports in your feeds"
            />
          )}
        </GroupedList>
      )}

      <LogOutRow />

      <footer className="grid gap-2 pt-2 text-center text-footnote text-sec">
        <p>
          UOSBuddy is a student-run project and is not an official University of Sargodha service.
        </p>
        <nav aria-label="Legal" className="flex justify-center gap-4">
          <Link href="/privacy" className="hit">
            Privacy
          </Link>
          <Link href="/terms" className="hit">
            Terms
          </Link>
          <Link href="/guidelines" className="hit">
            Guidelines
          </Link>
        </nav>
      </footer>
    </AppShell>
  );
}
