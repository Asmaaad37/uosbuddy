import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ConnectPanel } from "@/components/connect/connect-panel";
import { SafetyMenu } from "@/components/connect/safety-menu";
import { BadgeRow } from "@/components/profile/badge-row";
import { ProfileCard } from "@/components/profile/profile-card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import type { ConnectionState } from "@/actions/connect";
import { getProfileCard } from "@/lib/profile.server";

type Props = { params: Promise<{ handle: string }> };

const HANDLE = /^[A-Za-z0-9_]{3,20}$/;

// Names stay out of the tab title: it ends up in browser history and screenshots.
export const metadata: Metadata = { title: "Profile" };

/** Phase 2 task 5: a student's profile, exactly as their privacy settings allow. */
export default async function PersonPage({ params }: Props) {
  const { handle } = await params;
  if (!HANDLE.test(handle)) notFound();

  const { supabase, user } = await getSession();
  if (!user) redirect(`/login?next=/people/${handle}`);

  const profile = await getProfileCard(supabase, { handle });
  // Hidden and missing look the same, so a handle can't be probed for existence.
  if (!profile) notFound();
  if (profile.handle && profile.handle !== handle) redirect(`/people/${profile.handle}`);

  const own = profile.id === user.id;
  const [{ data: state }, { data: incoming }, { data: badges }, { data: mutuals }] =
    await Promise.all([
      own ? { data: null } : supabase.rpc("connection_state", { p_other: profile.id }),
      own
        ? { data: null }
        : supabase.rpc("incoming_requests").eq("requester_id", profile.id).maybeSingle(),
      supabase.rpc("profile_badges", { p_user: profile.id }),
      own ? { data: null } : supabase.rpc("mutual_connections", { p_other: profile.id }),
    ]);
  const firstName = (profile.full_name ?? profile.handle ?? "them").split(" ")[0]!;

  return (
    <AppShell
      back={own ? "/me" : "/explore"}
      action={
        own ? (
          <Button asChild size="sm" variant="tinted">
            <Link href="/setup/about?edit=1">
              <Pencil /> Edit
            </Link>
          </Button>
        ) : (
          <SafetyMenu target={profile.id} name={firstName} />
        )
      }
    >
      {own && (
        <p className="rounded-field bg-tint px-3 py-2 text-sm text-label">
          This is how your profile looks to students your privacy settings allow.
        </p>
      )}
      <ProfileCard
        profile={profile}
        actions={
          own ? undefined : (
            <div className="grid gap-3">
              <ConnectPanel
                target={profile.id}
                firstName={firstName}
                initialState={(state as ConnectionState | null) ?? "none"}
                openingMove={
                  profile.opening_move_prompt && profile.opening_move
                    ? { prompt: profile.opening_move_prompt, answer: profile.opening_move }
                    : null
                }
                incomingNote={incoming?.message ?? null}
              />
              {mutuals && mutuals.length > 0 && <Mutuals people={mutuals} />}
            </div>
          )
        }
      />
      <BadgeRow badges={badges ?? []} />
    </AppShell>
  );
}

/** Feature #21: "You both know Ali, Sara and 3 others", with their faces. */
function Mutuals({
  people,
}: {
  people: {
    user_id: string;
    full_name: string | null;
    handle: string | null;
    avatar_url: string | null;
    total: number;
  }[];
}) {
  const total = people[0]?.total ?? people.length;
  const first = (p: (typeof people)[number]) =>
    (p.full_name ?? p.handle ?? "a student").split(" ")[0]!;
  const names = people.map(first);
  const others = total - names.length;
  const text =
    total === 1
      ? (people[0]!.full_name ?? names[0])
      : others > 0
        ? `${names.slice(0, 2).join(", ")} and ${total - 2} ${total - 2 === 1 ? "other" : "others"}`
        : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return (
    <section
      aria-label="Mutual connections"
      className="flex items-center gap-3 rounded-card bg-surface px-4 py-3 shadow-card"
    >
      <span className="flex shrink-0" aria-hidden>
        {people.map((p, i) => (
          <Avatar
            key={p.user_id}
            name={p.full_name ?? p.handle ?? "Student"}
            src={p.avatar_url}
            size={36}
            className={i > 0 ? "-ml-2 ring-[3px] ring-surface" : "ring-[3px] ring-surface"}
          />
        ))}
      </span>
      <p className="min-w-0 text-subhead text-sec">
        You both know <span className="font-semibold text-label">{text}</span>
      </p>
    </section>
  );
}
