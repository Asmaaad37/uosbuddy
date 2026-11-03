import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RideCard, type Ride } from "@/components/rides/ride-card";
import { RideSheet } from "@/components/rides/ride-sheet";
import { getSession } from "@/lib/auth/session";
import { RIDE_SAFETY_TIPS } from "@/lib/campus";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Rides" };

const TABS = [
  { key: "offers", label: "Lifts offered" },
  { key: "requests", label: "Lifts needed" },
  { key: "mine", label: "My rides" },
] as const;
type Tab = (typeof TABS)[number]["key"];

type Props = { searchParams: Promise<{ tab?: string }> };

/** Phase 8 task 1: carpool around Sargodha and home districts. */
export default async function RidesPage({ searchParams }: Props) {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login?next=/rides");
  const tabParam = (await searchParams).tab;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? (tabParam as Tab) : "offers";

  const [{ data: rides }, { data: access }] = await Promise.all([
    supabase.rpc("rides_board", {
      p_kind: tab === "mine" ? undefined : tab === "offers" ? "offer" : "request",
      p_mine: tab === "mine",
    }),
    supabase.from("women_only_access").select("status").eq("user_id", user.id).maybeSingle(),
  ]);
  const eligible = access?.status === "approved";

  return (
    <AppShell bell back="/explore">
      <div className="grid gap-1">
        <h1 className="text-[28px] leading-tight font-bold">Rides</h1>
        <p className="text-ink-2">
          Share a ride with UoS students. Split the fare, not your number.
        </p>
      </div>
      <RideSheet womenEligible={eligible} />

      <details className="group rounded-lg border border-line bg-surface p-3 text-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
          <ShieldCheck className="size-4 text-brand" aria-hidden /> Ride safely
        </summary>
        <ul className="mt-2 grid list-disc gap-1 pl-5 text-ink-2">
          {RIDE_SAFETY_TIPS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        {!eligible && (
          <p className="mt-2 text-ink-2">
            Women-only rides:{" "}
            {access?.status === "pending" ? (
              "your request is with an admin."
            ) : (
              <Link href="/me/privacy#women-only" className="font-semibold text-brand">
                ask for access
              </Link>
            )}
          </p>
        )}
      </details>

      <nav aria-label="Ride lists" className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "offers" ? "/rides" : `/rides?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "flex h-10 shrink-0 items-center rounded-pill border px-4 text-sm font-semibold",
              tab === t.key
                ? "border-ink bg-ink text-bg"
                : "border-line bg-surface hover:border-ink-2/50",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {rides?.length ? (
        <ul className="grid gap-2">
          {rides.map((r) => (
            <RideCard key={r.id} ride={r as Ride} me={user.id} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-ink-2">
          {tab === "mine"
            ? "Rides you post or join show up here."
            : tab === "offers"
              ? "No lifts offered right now. Ask for one!"
              : "Nobody's asking for a lift right now."}
        </p>
      )}
    </AppShell>
  );
}
