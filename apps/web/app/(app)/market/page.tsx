import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Search, ShoppingBag } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ListingCard, type Listing } from "@/components/market/listing-card";
import { ListingSheet } from "@/components/market/listing-sheet";
import { getSession } from "@/lib/auth/session";
import { LISTING_KINDS, LISTING_KIND_KEYS, type ListingKind } from "@/lib/campus";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";

export const metadata: Metadata = { title: "Market" };

type Props = { searchParams: Promise<{ kind?: string; q?: string }> };

/** Phase 8 task 2: buy, sell, give away, and lost-and-found. */
export default async function MarketPage({ searchParams }: Props) {
  const { supabase, user } = await getSession();
  if (!user) redirect("/login?next=/market");
  const params = await searchParams;
  const mine = params.kind === "mine";
  const kind = LISTING_KIND_KEYS.includes(params.kind as ListingKind)
    ? (params.kind as ListingKind)
    : null;
  const q = params.q?.trim().slice(0, 60) || null;

  const { data: listings } = await supabase.rpc("market_listings", {
    p_kind: kind ?? undefined,
    p_query: q ?? undefined,
    p_mine: mine,
  });

  const tabs = [
    { key: null, label: "All" },
    ...LISTING_KIND_KEYS.map((k) => ({ key: k, label: LISTING_KINDS[k].tab })),
    { key: "mine", label: "Mine" },
  ];
  const href = (k: string | null) => {
    const sp = new URLSearchParams();
    if (k) sp.set("kind", k);
    if (q && k !== "mine") sp.set("q", q);
    return sp.size ? `/market?${sp}` : "/market";
  };

  return (
    <AppShell bell back="/explore">
      <div className="grid gap-1">
        <h1 className="text-large-title">Market</h1>
        <p className="text-sec">Buy, sell, give away, and find lost things around campus.</p>
      </div>
      <ListingSheet initialKind={kind ?? "sell"} />

      <form action="/market" className="relative">
        {kind && <input type="hidden" name="kind" value={kind} />}
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-sec"
          aria-hidden
        />
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          aria-label="Search the market"
          placeholder="Search: calculator, lab coat, keys…"
          className="h-11 w-full rounded-field bg-track pr-4 pl-9 text-body placeholder:text-ter focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </form>

      <FilterChips
        label="Listing kinds"
        value={mine ? "mine" : (kind ?? "all")}
        chips={tabs.map((t) => ({ value: t.key ?? "all", label: t.label, href: href(t.key) }))}
      />

      {listings?.length ? (
        <div className="grid gap-3">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l as Listing} me={user.id} />
          ))}
        </div>
      ) : (
        <EmptyState icon={ShoppingBag}>
          {mine
            ? "Your listings show up here."
            : q
              ? `Nothing matches “${q}”.`
              : "Nothing here yet. Post the first one!"}
        </EmptyState>
      )}
    </AppShell>
  );
}
