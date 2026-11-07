"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Search, Users } from "lucide-react";
import { createGroup } from "@/actions/chat";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

type Connection = {
  id: string;
  handle: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

/** Phase 4 task 5: name, emoji and members (your connections, up to 49 others). */
export function NewGroupForm({ connections }: { connections: Connection[] }) {
  const id = useId();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const q = query.trim().toLowerCase();
  const shown = q
    ? connections.filter((c) => `${c.full_name ?? ""} ${c.handle ?? ""}`.toLowerCase().includes(q))
    : connections;

  const toggle = (person: string) =>
    setPicked((p) => (p.includes(person) ? p.filter((x) => x !== person) : [...p, person]));

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    setBusy(true);
    const result = await createGroup({ title, emoji: emoji || undefined, members: picked });
    if (!result.ok) {
      setBusy(false);
      return setError(result.error);
    }
    router.push(`/chats/${result.data}`);
  }

  if (connections.length === 0) {
    return (
      <EmptyState icon={Users}>
        Groups are made from your connections. Connect with a few batchmates first.
      </EmptyState>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="grid grid-cols-[5rem_1fr] gap-3">
        <Field id={`${id}-emoji`} label="Emoji">
          {(aria) => (
            <Input
              {...aria}
              value={emoji}
              maxLength={8}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="📚"
              className="text-center text-xl"
            />
          )}
        </Field>
        <Field id={`${id}-title`} label="Group name">
          {(aria) => (
            <Input
              {...aria}
              value={title}
              maxLength={60}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="DSA study group"
            />
          )}
        </Field>
      </div>

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold">Add people</p>
          <p className="text-sm text-sec" aria-live="polite">
            {picked.length} picked
          </p>
        </div>
        <label className="relative">
          <span className="sr-only">Search your connections</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-sec" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your connections"
            className="pl-10"
          />
        </label>
        <ul className="divide-y divide-sep overflow-hidden rounded-card border border-sep bg-surface">
          {shown.map((c) => {
            const name = c.full_name ?? c.handle ?? "Student";
            const on = picked.includes(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(c.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-raised"
                >
                  <Avatar name={name} src={c.avatar_url} size="sm" />
                  <span className="flex-1 truncate font-medium">{name}</span>
                  <span
                    className={cn(
                      "grid size-6 place-items-center rounded-pill border-2",
                      on ? "border-accent bg-fill text-on-fill" : "border-sep",
                    )}
                  >
                    {on && <Check className="size-3.5" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button type="submit" block disabled={busy || !title.trim() || picked.length === 0}>
        {busy && <Loader2 className="animate-spin" />} Create group
      </Button>
    </form>
  );
}
