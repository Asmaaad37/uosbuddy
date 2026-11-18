"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import {
  discardImport,
  excludeEntry,
  publishImport,
  restoreImport,
} from "@/actions/official-timetable";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { fieldClass } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { toast } from "@/components/ui/toast";

type Option = { value: string; label: string };

/** Phase 11.1: upload a department timetable (PDF, or the parser's JSON) for review. */
export function ImportForm({
  departments,
  terms,
  defaultTerm,
}: {
  departments: Option[];
  terms: Option[];
  defaultTerm: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [skipped, setSkipped] = useState<{ reason: string; lines: string[] }[]>([]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setSkipped([]);
    try {
      const res = await fetch("/api/admin/timetable", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const body = (await res.json().catch(() => ({}))) as {
        importId?: string;
        error?: string;
        skipped?: { reason: string; lines: string[] }[];
      };
      if (!res.ok || !body.importId) {
        setSkipped(body.skipped ?? []);
        toast.error(body.error ?? "Couldn't import that file. Try again.");
        return;
      }
      toast.success("Ready to review");
      router.push(`/admin/timetable/${body.importId}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-card bg-surface p-4 shadow-card">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-subhead font-semibold">
          Department
          <NativeSelect name="department" required defaultValue={departments[0]?.value}>
            {departments.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1 text-subhead font-semibold">
          Term
          <NativeSelect name="term" required defaultValue={defaultTerm}>
            {terms.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1 text-subhead font-semibold">
          One week only (optional)
          <input type="date" name="week_of" className={fieldClass} aria-describedby="week-hint" />
        </label>
      </div>
      <p id="week-hint" className="text-footnote text-sec">
        Leave the week empty for the term timetable. Pick a Monday only for a one-week change.
      </p>
      <label className="grid gap-1 text-subhead font-semibold">
        Timetable file
        <input
          type="file"
          name="file"
          required
          accept="application/pdf,.pdf,application/json,.json"
          className="text-subhead file:mr-3 file:rounded-field file:border-0 file:bg-tint file:px-3 file:py-2 file:font-semibold file:text-tint-text"
        />
      </label>
      <div>
        <Button type="submit" disabled={pending}>
          <Upload /> {pending ? "Reading the timetable…" : "Upload and review"}
        </Button>
      </div>
      {skipped.length > 0 && (
        <ul className="grid gap-1 text-footnote text-sec">
          {skipped.map((s, i) => (
            <li key={i}>
              {s.reason}: {s.lines.join(" · ")}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    done: string,
    then?: () => void,
  ) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "Something went wrong");
      toast.success(done);
      if (then) then();
      else router.refresh();
    });
  return { pending, run };
}

/** Publish or discard an import in review; restore an earlier published one. */
export function ImportActions({
  importId,
  status,
  live,
  changes,
}: {
  importId: string;
  status: "review" | "published" | "discarded";
  live: boolean;
  changes: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const { pending, run } = useRun();
  if (status === "review") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={async () => {
            const ok = await confirm({
              title: "Publish this timetable?",
              body: `Students will see it straight away. ${changes} change${changes === 1 ? "" : "s"} from what's live now.`,
              action: "Publish",
            });
            if (ok) run(() => publishImport(importId), "Published");
          }}
        >
          Publish
        </Button>
        <Button
          variant="destructive"
          disabled={pending}
          onClick={async () => {
            const ok = await confirm({
              title: "Discard this import?",
              body: "Nothing was published. You can upload the file again.",
              action: "Discard",
            });
            if (ok)
              run(
                () => discardImport(importId),
                "Discarded",
                () => router.push("/admin/timetable"),
              );
          }}
        >
          Discard
        </Button>
      </div>
    );
  }
  if (status === "published" && !live) {
    return (
      <Button
        variant="tinted"
        disabled={pending}
        onClick={async () => {
          const ok = await confirm({
            title: "Restore this version?",
            body: "It's published again as a new import, and students see what changed.",
            action: "Restore",
          });
          if (ok)
            run(
              () => restoreImport(importId),
              "Restored",
              () => router.push("/admin/timetable"),
            );
        }}
      >
        Restore this version
      </Button>
    );
  }
  return null;
}

/** Leave one class out of an import before publishing (a parsing mistake, say). */
export function ExcludeToggle({ entryId, excluded }: { entryId: string; excluded: boolean }) {
  const { pending, run } = useRun();
  return (
    <Button
      size="sm"
      variant={excluded ? "tinted" : "quiet"}
      disabled={pending}
      onClick={() =>
        run(() => excludeEntry(entryId, !excluded), excluded ? "Included" : "Left out")
      }
    >
      {excluded ? "Include" : "Leave out"}
    </Button>
  );
}
