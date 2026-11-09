"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUp, FileText, Flag, ImageIcon, Loader2 } from "lucide-react";
import { voteResource } from "@/actions/courses";
import { ReportDialog } from "@/components/connect/safety-menu";
import { Chip } from "@/components/ui/chip";
import { SearchField } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { signedUrl } from "@/components/ui/private-image";
import { RESOURCE_KINDS, fileSize, type ResourceKind } from "@/lib/academics";
import { cn } from "@/lib/utils";

export type HubItem = {
  id: string;
  kind: string;
  title: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  year: number | null;
  teacher_name: string | null;
  upvotes: number;
  voted: boolean;
  mine: boolean;
  course: { id: string; code: string; title: string } | null;
};

/** Search box, kind chips and year filter; each change updates the URL (debounced). */
export function ResourceSearch({
  q,
  kind,
  year,
  years,
}: {
  q: string;
  kind: ResourceKind | null;
  year: number | null;
  years: number[];
}) {
  const router = useRouter();
  const path = usePathname();
  const [text, setText] = useState(q);
  const [pending, startTransition] = useTransition();
  const first = useRef(true);

  function go(next: { q?: string; kind?: string | null; year?: number | null }) {
    const params = new URLSearchParams();
    const nq = (next.q ?? text).trim();
    const nk = next.kind === undefined ? kind : next.kind;
    const ny = next.year === undefined ? year : next.year;
    if (nq) params.set("q", nq);
    if (nk) params.set("kind", nk);
    if (ny) params.set("year", String(ny));
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${path}?${qs}` : path, { scroll: false }));
  }

  // Search as you type, 300 ms after the last key.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => go({ q: text }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the text drives this
  }, [text]);

  return (
    <div className="grid min-w-0 gap-3">
      <div className="relative">
        <SearchField
          placeholder="Course code, title or teacher"
          aria-label="Search resources"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="[&_input]:h-11"
        />
        {pending && (
          <Loader2
            aria-hidden
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-ter"
          />
        )}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <div
          role="group"
          aria-label="Kind of file"
          className="-ml-4 flex min-w-0 flex-1 [scrollbar-width:none] gap-2 overflow-x-auto pr-1 pl-4"
        >
          <Chip selected={!kind} onClick={() => go({ kind: null })}>
            All
          </Chip>
          {(Object.keys(RESOURCE_KINDS) as ResourceKind[]).map((k) => (
            <Chip key={k} selected={kind === k} onClick={() => go({ kind: kind === k ? null : k })}>
              {RESOURCE_KINDS[k]}
            </Chip>
          ))}
        </div>
        {years.length > 0 && (
          <NativeSelect
            aria-label="Year"
            value={year ?? ""}
            onChange={(e) => go({ year: e.target.value ? Number(e.target.value) : null })}
            className="h-11 w-[104px] text-subhead"
          >
            <option value="">Year</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </NativeSelect>
        )}
      </div>
    </div>
  );
}

/** The matching files: open on tap, upvote, and a link to the course room. */
export function ResourceResults({ items: initial }: { items: HubItem[] }) {
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string>();
  const [reporting, setReporting] = useState<string | null>(null);

  async function open(r: HubItem) {
    const url = await signedUrl("course-resources", r.file_path);
    if (url) window.open(url, "_blank", "noopener");
    else setError("Couldn't open the file. Try again.");
  }

  async function vote(r: HubItem) {
    const next = !r.voted;
    const bump = (list: HubItem[], on: boolean) =>
      list.map((x) =>
        x.id === r.id ? { ...x, voted: on, upvotes: x.upvotes + (on ? 1 : -1) } : x,
      );
    setItems((list) => bump(list, next));
    const result = await voteResource(r.id, next);
    if (!result.ok) {
      setItems((list) => bump(list, !next));
      setError(result.error);
    }
  }

  return (
    <section aria-label="Files" className="grid min-w-0 gap-2">
      <p className="px-1 text-footnote text-ter">
        {items.length === 50
          ? "Top 50 matches"
          : `${items.length} ${items.length === 1 ? "file" : "files"}`}
      </p>
      {error && (
        <p role="alert" className="text-subhead text-danger">
          {error}
        </p>
      )}
      <ul className="overflow-hidden rounded-card bg-surface shadow-card [&>li:last-child_[data-row-text]]:shadow-none">
        {items.map((r) => (
          <li key={r.id} className="flex items-center">
            <button
              type="button"
              onClick={() => open(r)}
              className="flex min-w-0 flex-1 items-center gap-3 self-stretch pl-4 text-left active:bg-raised"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-field bg-raised text-sec">
                {r.mime_type === "application/pdf" ? (
                  <FileText className="size-5" aria-hidden />
                ) : (
                  <ImageIcon className="size-5" aria-hidden />
                )}
              </span>
              <span
                data-row-text
                className="grid min-w-0 flex-1 gap-0.5 self-stretch py-3 pr-2 shadow-[inset_0_-1px_0_var(--sep)]"
              >
                <span className="truncate text-body">{r.title}</span>
                {r.course && (
                  <span className="truncate text-footnote text-sec">
                    {r.course.code} · {r.course.title}
                  </span>
                )}
                <span className="truncate text-footnote text-ter">
                  {[
                    RESOURCE_KINDS[r.kind as ResourceKind] ?? r.kind,
                    r.year,
                    r.teacher_name,
                    fileSize(r.size_bytes),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </button>
            <span className="flex items-center self-stretch pr-3 shadow-[inset_0_-1px_0_var(--sep)] [li:last-child_&]:shadow-none">
              <button
                type="button"
                aria-pressed={r.voted}
                aria-label={`Upvote ${r.title}, ${r.upvotes}`}
                onClick={() => vote(r)}
                className={cn(
                  "hit flex h-9 shrink-0 items-center gap-1 rounded-pill px-2.5 text-subhead font-semibold tabular-nums",
                  r.voted ? "bg-tint text-accent" : "bg-raised text-sec",
                )}
              >
                <ArrowUp className="size-4" aria-hidden /> {r.upvotes}
              </button>
              {!r.mine && (
                <button
                  type="button"
                  aria-label={`Report ${r.title}`}
                  onClick={() => setReporting(r.id)}
                  className="hit ml-1 grid size-9 shrink-0 place-items-center rounded-pill text-sec hover:bg-raised"
                >
                  <Flag className="size-4" aria-hidden />
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <ReportDialog
        open={!!reporting}
        onOpenChange={(o) => !o && setReporting(null)}
        title="Report file"
        targetType="resource"
        targetId={reporting ?? ""}
      />
    </section>
  );
}
