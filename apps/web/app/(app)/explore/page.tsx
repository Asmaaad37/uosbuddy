import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, MessageCircle, ShieldCheck } from "lucide-react";
import { getDirectoryCounts, getSuggestions, loadDirectory } from "@/actions/discovery";
import { AppShell } from "@/components/app-shell";
import { BatchReveal } from "@/components/discovery/batch-reveal";
import { FeatureDock } from "@/components/discovery/feature-dock";
import { aiEnabled } from "@/lib/ai/claude.server";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { PersonCard } from "@/components/discovery/person-card";
import { ShareButton } from "@/components/discovery/share-button";
import { publicEnv } from "@/lib/env";
import { inviteMessage, whatsappLink } from "@/lib/invite-text";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Explore" };

type Props = { searchParams: Promise<{ welcome?: string }> };

/** Phase 3 task 1: the Explore hub, with the batch reveal (task 2) after setup. */
export default async function ExplorePage({ searchParams }: Props) {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) redirect("/login?next=/explore");
  const welcome = (await searchParams).welcome === "1";
  const isAdmin = profile.role === "admin";
  const name = profile.full_name ?? profile.handle ?? "there";

  // "From your city" (Phase 3 task 7): only when the student shows their own hometown.
  const city = profile.hometown_city?.trim() || null;
  const [
    counts,
    suggestions,
    batch,
    { data: dept },
    { count: waiting },
    { data: inviteCode },
    fromCity,
  ] = await Promise.all([
    getDirectoryCounts(),
    getSuggestions(6),
    loadDirectory({ scope: "batch" }),
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
    supabase.rpc("my_invite_code"),
    city ? loadDirectory({ scope: "all", hometown: city }) : Promise.resolve(null),
  ]);
  const inviteUrl = inviteCode ? `/i/${inviteCode}` : "/";
  const cityPeople = fromCity?.ok ? fromCity.data.people : [];

  const batchCount = counts?.batch_count ?? 0;
  const code = dept?.short_code;
  const batchLabel = code && profile.batch_year ? `${code} ${profile.batch_year}` : "your batch";
  const batchPeople = batch.ok ? batch.data.people : [];

  return (
    <AppShell
      bell
      action={
        <Link href="/me" className="rounded-pill">
          <span aria-hidden>
            <Avatar name={name} src={profile.avatar_url} size="md" />
          </span>
          <span className="sr-only">My profile</span>
        </Link>
      }
    >
      <div className="grid gap-1">
        <h1 className="text-[28px] leading-tight font-bold">
          {welcome ? "Welcome" : "Hi"}, {name.split(" ")[0]}!
        </h1>
        <p className="text-ink-2">Find your people at the University of Sargodha.</p>
      </div>

      {welcome ? (
        <BatchReveal
          count={batchCount}
          label={code && profile.batch_year ? `${code} ${profile.batch_year}` : "your batch"}
          people={batchPeople}
          inviteUrl={inviteUrl}
        />
      ) : (
        <Link
          href="/explore/batch"
          className="group grid gap-1 rounded-lg bg-ink p-5 text-bg shadow-[var(--shadow-card)]"
        >
          <span className="text-large-title">{batchCount}</span>
          <span className="font-semibold">
            from {batchLabel} {batchCount === 1 ? "is" : "are"} here
          </span>
          <span className="mt-2 flex items-center gap-1 text-sm font-semibold text-on-ink-accent">
            See your batch
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      )}

      <InstallPrompt />
      <FeatureDock
        aiReady={aiEnabled()}
        previews={batchPeople.map((p) => ({
          name: p.full_name ?? p.handle ?? "Student",
          avatar: p.avatar_url,
        }))}
      />

      <section aria-labelledby="people-like-you" className="grid gap-3">
        <div className="flex items-baseline justify-between">
          <h2 id="people-like-you" className="text-lg font-bold">
            People like you
          </h2>
          <Link href="/explore/batch" className="text-sm font-semibold text-brand">
            See everyone
          </Link>
        </div>
        {suggestions.length > 0 ? (
          <ul className="grid gap-2">
            {suggestions.map((s) => (
              <li key={s.person.id}>
                <PersonCard person={s.person} reason={s.reasons[0]} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-line p-6 text-center text-ink-2">
            Suggestions show up as more of your batch joins.
          </p>
        )}
      </section>

      {city && cityPeople.length > 0 && (
        <section aria-labelledby="from-your-city" className="grid gap-3">
          <div className="flex items-baseline justify-between">
            <h2 id="from-your-city" className="text-lg font-bold">
              From {city}
            </h2>
            <Link
              href={`/explore/batch?tab=all&hometown=${encodeURIComponent(city)}`}
              className="text-sm font-semibold text-brand"
            >
              See all
            </Link>
          </div>
          <p className="-mt-2 text-sm text-ink-2">Handy for travel home and Eid trips.</p>
          <ul className="grid gap-2">
            {cityPeople.slice(0, 3).map((p) => (
              <li key={p.id}>
                <PersonCard person={p} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        <ShareButton
          block
          variant="secondary"
          url={inviteUrl}
          text={`${batchCount} of ${batchLabel} are on UOSBuddy. Join us:`}
        />
        <Button asChild block variant="secondary">
          <a
            href={whatsappLink(
              inviteMessage({
                batchLabel: code && profile.batch_year ? batchLabel : null,
                count: batchCount,
                url: new URL(inviteUrl, publicEnv.NEXT_PUBLIC_SITE_URL).toString(),
              }),
            )}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle /> WhatsApp
          </a>
        </Button>
      </div>

      {isAdmin && (
        <Button asChild block variant="secondary">
          <Link href="/admin/verifications?from=/explore">
            <ShieldCheck />
            Verification queue
            {waiting ? (
              <span className="rounded-pill bg-brand px-2 py-0.5 text-xs text-brand-ink">
                {waiting} waiting
              </span>
            ) : null}
          </Link>
        </Button>
      )}
    </AppShell>
  );
}
