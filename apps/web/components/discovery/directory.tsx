"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { loadDirectory, type DirectoryPage, type DirectoryQuery } from "@/actions/discovery";
import { PersonCard } from "@/components/discovery/person-card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SCOPES, type Scope } from "@/lib/discovery";
import { RESIDENCE_LABELS, SHIFT_LABELS } from "@/lib/profile";
import { cn } from "@/lib/utils";

type Filters = Pick<DirectoryQuery, "shift" | "residence" | "hometown" | "interest">;
type Interest = { id: string; label: string; emoji: string };

const EMPTY: Record<Scope, string> = {
  section: "Nobody from your section is here yet. Invite them!",
  batch: "Nobody from your batch is here yet. Invite them!",
  department: "Nobody from your department is here yet.",
  all: "Nobody matches yet.",
};

/** Directory (Phase 3 task 3): scope tabs, search, filters and keyset "Load more". */
export function Directory({
  initialScope,
  initialPage,
  counts,
  interests,
  hasSection,
  initialFilters = {},
  initialQuery = "",
}: {
  initialScope: Scope;
  initialFilters?: Filters;
  initialQuery?: string;
  initialPage: DirectoryPage;
  counts: Record<Scope, number>;
  interests: Interest[];
  hasSection: boolean;
}) {
  const id = useId();
  const [scope, setScope] = useState<Scope>(initialScope);
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState<DirectoryPage>(initialPage);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [loadingMore, setLoadingMore] = useState(false);
  const first = useRef(true);

  const active = Object.values(filters).filter(Boolean).length;

  // Reload from the top whenever the tab, search or filters change (search debounced).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(
      () =>
        startTransition(async () => {
          const result = await loadDirectory({ scope, query, ...filters });
          if (!result.ok) return setError(result.error);
          setError(undefined);
          setPage(result.data);
        }),
      query || filters.hometown ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [scope, query, filters]);

  async function loadMore() {
    if (!page.next) return;
    setLoadingMore(true);
    const result = await loadDirectory({ scope, query, ...filters, after: page.next });
    setLoadingMore(false);
    if (!result.ok) return setError(result.error);
    setPage((p) => ({ people: [...p.people, ...result.data.people], next: result.data.next }));
  }

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value || undefined }));

  return (
    <div className="grid gap-4">
      <div
        role="tablist"
        aria-label="Who to show"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
      >
        {SCOPES.filter((s) => s.key !== "section" || hasSection).map((s) => (
          <button
            key={s.key}
            role="tab"
            type="button"
            aria-selected={scope === s.key}
            onClick={() => setScope(s.key)}
            className={cn(
              "flex h-10 shrink-0 items-center gap-1.5 rounded-pill border px-4 text-sm font-semibold transition-colors",
              scope === s.key
                ? "border-ink bg-ink text-bg"
                : "border-line bg-surface text-ink hover:border-ink-2/50",
            )}
          >
            {s.label}
            <span className={cn("text-xs", scope === s.key ? "text-bg/70" : "text-ink-2")}>
              {counts[s.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search by name or handle</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-2" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or @handle"
            className="pl-10"
            maxLength={60}
          />
        </label>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="relative h-12 w-12"
              aria-label={active ? `Filters (${active} on)` : "Filters"}
            >
              <SlidersHorizontal />
              {active > 0 && (
                <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-pill bg-brand text-[11px] text-brand-ink">
                  {active}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle className="text-xl font-bold">Filters</SheetTitle>
            <SheetDescription className="mb-4 text-sm text-ink-2">
              Narrow down who you see in this tab.
            </SheetDescription>
            <div className="grid gap-4">
              <Field id={`${id}-shift`} label="Shift">
                {(aria) => (
                  <NativeSelect
                    {...aria}
                    value={filters.shift ?? ""}
                    onChange={(e) => set("shift", e.target.value as Filters["shift"])}
                  >
                    <option value="">Any shift</option>
                    {Object.entries(SHIFT_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              <Field id={`${id}-res`} label="Day scholar or hostelite">
                {(aria) => (
                  <NativeSelect
                    {...aria}
                    value={filters.residence ?? ""}
                    onChange={(e) => set("residence", e.target.value as Filters["residence"])}
                  >
                    <option value="">Anyone</option>
                    {Object.entries(RESIDENCE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              <Field id={`${id}-home`} label="Hometown">
                {(aria) => (
                  <Input
                    {...aria}
                    value={filters.hometown ?? ""}
                    onChange={(e) => set("hometown", e.target.value)}
                    placeholder="e.g. Sargodha"
                    maxLength={60}
                  />
                )}
              </Field>
              <Field id={`${id}-int`} label="Into">
                {(aria) => (
                  <NativeSelect
                    {...aria}
                    value={filters.interest ?? ""}
                    onChange={(e) => set("interest", e.target.value)}
                  >
                    <option value="">Any interest</option>
                    {interests.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.emoji} {i.label}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setFilters({})}
                  disabled={!active}
                >
                  Clear
                </Button>
                <SheetClose asChild>
                  <Button className="flex-1">Show people</Button>
                </SheetClose>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {active > 0 && (
        <button
          type="button"
          onClick={() => setFilters({})}
          className="flex items-center gap-1 justify-self-start text-sm font-semibold text-brand"
        >
          <X className="size-4" /> Clear {active} {active === 1 ? "filter" : "filters"}
        </button>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <div
        aria-busy={pending}
        aria-live="polite"
        className={cn("grid gap-2", pending && "opacity-60")}
      >
        {page.people.length === 0 && !pending ? (
          <p className="rounded-lg border border-dashed border-line p-6 text-center text-ink-2">
            {query || active ? "Nobody matches. Try fewer filters." : EMPTY[scope]}
          </p>
        ) : (
          <ul className="grid gap-2">
            {page.people.map((p) => (
              <li key={p.id}>
                <PersonCard person={p} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {page.next && (
        <Button variant="secondary" block onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? <Loader2 className="animate-spin" /> : null}
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
