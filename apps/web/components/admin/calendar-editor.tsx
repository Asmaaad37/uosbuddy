"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteCalendarEvent,
  saveCalendarEvent,
  type CalendarEventInput,
} from "@/actions/calendar";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Input, fieldClass } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { toast } from "@/components/ui/toast";
import { KIND_LABEL, dateRange } from "@/lib/calendar";

export type EditorEvent = {
  id: string;
  term: string | null;
  kind: string;
  title: string;
  notes: string | null;
  starts_on: string;
  ends_on: string | null;
  tentative: boolean;
  source: string | null;
  status: string;
};

const blank: CalendarEventInput = {
  id: null,
  term: null,
  kind: "deadline",
  title: "",
  notes: "",
  starts_on: "",
  ends_on: null,
  tentative: false,
  source: "",
  status: "published",
};

/** Phase 11.4: editors add, change, publish and delete academic calendar dates. Audited. */
export function CalendarEditor({
  events,
  terms,
}: {
  events: EditorEvent[];
  terms: { code: string; name: string }[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<CalendarEventInput | null>(null);

  const save = (input: CalendarEventInput) =>
    start(async () => {
      const r = await saveCalendarEvent(input);
      if (!r.ok) return void toast.error(r.error);
      toast.success(input.status === "published" ? "Saved and published" : "Saved as a draft");
      setEditing(null);
      router.refresh();
    });

  const groups = new Map<string, EditorEvent[]>();
  for (const e of events) {
    const key = terms.find((t) => t.code === e.term)?.name ?? "No term";
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  return (
    <div className="grid gap-4">
      {editing ? (
        <EventForm
          value={editing}
          terms={terms}
          pending={pending}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      ) : (
        <div>
          <Button variant="tinted" onClick={() => setEditing(blank)}>
            <Plus /> Add a date
          </Button>
        </div>
      )}

      {[...groups.entries()].map(([term, list]) => (
        <section key={term} aria-label={term} className="grid gap-2">
          <h2 className="text-lg font-bold">{term}</h2>
          <ul className="divide-y divide-sep overflow-hidden rounded-card bg-surface shadow-card">
            {list.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 p-4">
                <span className="grid gap-0.5">
                  <span className="font-medium">{e.title}</span>
                  <span className="text-footnote text-sec">{dateRange(e)}</span>
                  <span className="flex flex-wrap gap-1.5 pt-1">
                    <Pill>{KIND_LABEL[e.kind] ?? e.kind}</Pill>
                    {e.tentative && <Pill tone="outline">Tentative</Pill>}
                    {e.status === "draft" && <Pill tone="brand">Draft</Pill>}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="quiet"
                    aria-label={`Edit ${e.title}`}
                    onClick={() =>
                      setEditing({
                        id: e.id,
                        term: e.term,
                        kind: e.kind as CalendarEventInput["kind"],
                        title: e.title,
                        notes: e.notes ?? "",
                        starts_on: e.starts_on,
                        ends_on: e.ends_on,
                        tentative: e.tentative,
                        source: e.source ?? "",
                        status: e.status as "draft" | "published",
                      })
                    }
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    aria-label={`Delete ${e.title}`}
                    disabled={pending}
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Delete “${e.title}”?`,
                        body: "Students stop seeing it, and reminders for it are removed.",
                        action: "Delete",
                      });
                      if (!ok) return;
                      start(async () => {
                        const r = await deleteCalendarEvent(e.id);
                        if (!r.ok) return void toast.error(r.error);
                        toast.success("Deleted");
                        router.refresh();
                      });
                    }}
                  >
                    <Trash2 />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function EventForm({
  value,
  terms,
  pending,
  onCancel,
  onSave,
}: {
  value: CalendarEventInput;
  terms: { code: string; name: string }[];
  pending: boolean;
  onCancel: () => void;
  onSave: (v: CalendarEventInput) => void;
}) {
  const [v, setV] = useState(value);
  const set = <K extends keyof CalendarEventInput>(k: K, x: CalendarEventInput[K]) =>
    setV((old) => ({ ...old, [k]: x }));
  const label = "grid gap-1 text-subhead font-semibold";

  return (
    <form
      className="grid gap-3 rounded-card bg-surface p-4 shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v);
      }}
    >
      <h2 className="text-lg font-bold">{v.id ? "Edit date" : "Add a date"}</h2>
      <label className={label}>
        Title
        <Input
          value={v.title}
          onChange={(e) => set("title", e.target.value)}
          required
          maxLength={140}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={label}>
          Kind
          <NativeSelect
            value={v.kind}
            onChange={(e) => set("kind", e.target.value as CalendarEventInput["kind"])}
          >
            {Object.entries(KIND_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className={label}>
          Term
          <NativeSelect value={v.term ?? ""} onChange={(e) => set("term", e.target.value || null)}>
            <option value="">No term</option>
            {terms.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className={label}>
          Status
          <NativeSelect
            value={v.status}
            onChange={(e) => set("status", e.target.value as "draft" | "published")}
          >
            <option value="published">Published</option>
            <option value="draft">Draft (only editors see it)</option>
          </NativeSelect>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Starts
          <input
            type="date"
            className={fieldClass}
            required
            value={v.starts_on}
            onChange={(e) => set("starts_on", e.target.value)}
          />
        </label>
        <label className={label}>
          Ends (for a range)
          <input
            type="date"
            className={fieldClass}
            value={v.ends_on ?? ""}
            onChange={(e) => set("ends_on", e.target.value || null)}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-subhead">
        <input
          type="checkbox"
          checked={v.tentative}
          onChange={(e) => set("tentative", e.target.checked)}
          className="size-5 accent-[var(--accent)]"
        />
        Tentative (subject to the moon or a government notice)
      </label>
      <label className={label}>
        Note for students
        <Input value={v.notes} onChange={(e) => set("notes", e.target.value)} maxLength={400} />
      </label>
      <label className={label}>
        Source
        <Input
          value={v.source}
          onChange={(e) => set("source", e.target.value)}
          maxLength={200}
          placeholder="Circular SU/DIRACAD/751"
        />
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          Save
        </Button>
        <Button type="button" variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
