import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AtSign,
  Ban,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronRight,
  GraduationCap,
  Library,
  Eye,
  Heart,
  Lock,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ProfileStamps } from "@/components/profile/profile-card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { signOut } from "@/actions/onboarding";
import { getSession } from "@/lib/auth/session";
import { completeness } from "@/lib/profile";

export const metadata: Metadata = { title: "Me" };

function Row({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-surface-2 focus-visible:bg-surface-2"
      >
        <Icon className="size-5 shrink-0 text-ink-2" />
        <span className="grid flex-1 gap-0.5">
          <span className="font-semibold">{label}</span>
          {hint && <span className="text-[13px] text-ink-2">{hint}</span>}
        </span>
        <ChevronRight className="size-4 shrink-0 text-ink-2" />
      </Link>
    </li>
  );
}

/** Own profile hub: completeness, edit links, privacy and the UoS email upgrade. */
export default async function MePage() {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) redirect("/login?next=/me");

  const [{ data: pii }, { count: interestCount }] = await Promise.all([
    supabase.from("private_profile").select("uni_email").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("profile_interests")
      .select("interest_id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);
  const hasUniEmail = !!pii?.uni_email;
  const { percent, nudges } = completeness({
    ...profile,
    interestCount: interestCount ?? 0,
    hasUniEmail,
  });
  const name = profile.full_name ?? profile.handle ?? "You";

  return (
    <AppShell back="/explore" bell>
      <header className="flex items-center gap-4">
        <Avatar name={name} src={profile.avatar_url} size="lg" />
        <div className="grid min-w-0 gap-1.5">
          <h1 className="text-2xl leading-tight font-bold break-words">{name}</h1>
          {profile.handle && <p className="text-ink-2">@{profile.handle}</p>}
          <ProfileStamps hasUniEmail={hasUniEmail} isMentor={profile.is_mentor} />
        </div>
      </header>

      {nudges.length > 0 && (
        <section
          aria-labelledby="completeness"
          className="grid gap-3 rounded-lg border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="completeness" className="font-bold">
              Your profile is {percent}% done
            </h2>
            <span className="text-sm text-ink-2">{nudges.length} to go</span>
          </div>
          <div
            role="progressbar"
            aria-label="Profile completeness"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-2 overflow-hidden rounded-pill bg-surface-2"
          >
            <div className="h-full rounded-pill bg-brand" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-sm text-ink-2">Complete profiles get more hellos from batchmates.</p>
          <ul className="flex flex-wrap gap-2">
            {nudges.slice(0, 3).map((n) => (
              <li key={n.key}>
                <Link
                  href={n.href}
                  className="inline-flex h-9 items-center rounded-pill border border-line px-3 text-sm font-semibold hover:bg-surface-2"
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav aria-label="Profile">
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {profile.handle && (
            <Row
              href={`/people/${profile.handle}`}
              icon={Eye}
              label="View my profile"
              hint="See what other students see"
            />
          )}
          <Row href="/setup/about?edit=1" icon={UserRound} label="Photo, handle and bio" />
          <Row href="/setup/academic?edit=1" icon={BookOpen} label="Studies" />
          <Row href="/setup/interests?edit=1" icon={Heart} label="Interests and Opening Move" />
          <Row
            href="/me/privacy"
            icon={Lock}
            label="Privacy"
            hint="Who sees your profile and photo, and who can message you"
          />
          <Row
            href="/courses"
            icon={Library}
            label="My courses"
            hint="Files, study groups and course chats"
          />
          <Row
            href="/timetable"
            icon={CalendarDays}
            label="Timetable"
            hint="Your week, and free time with friends"
          />
          <Row
            href="/mentors"
            icon={GraduationCap}
            label="Mentors"
            hint="Find a senior, or mentor juniors"
          />
          <Row
            href="/me/notifications"
            icon={Bell}
            label="Notifications"
            hint="What pings you, and push on this phone"
          />
          <Row href="/me/blocked" icon={Ban} label="Blocked" />
          {hasUniEmail ? (
            <li className="flex min-h-14 items-center gap-3 px-4 py-3">
              <AtSign className="size-5 shrink-0 text-ink-2" />
              <span className="grid flex-1 gap-0.5">
                <span className="font-semibold">UoS email linked</span>
                <span className="text-[13px] break-all text-ink-2">{pii?.uni_email}</span>
              </span>
            </li>
          ) : (
            <Row
              href="/me/email"
              icon={Mail}
              label="Link your UoS email"
              hint="Adds the UoS email stamp to your profile"
            />
          )}
          {profile.role === "admin" && (
            <Row
              href="/admin/verifications?from=/me"
              icon={ShieldCheck}
              label="Verification queue"
            />
          )}
        </ul>
      </nav>

      <form action={signOut} className="mt-auto">
        <Button type="submit" block variant="ghost">
          Log out
        </Button>
      </form>
    </AppShell>
  );
}
