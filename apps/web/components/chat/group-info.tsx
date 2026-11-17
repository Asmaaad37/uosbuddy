"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, LogOut, Search, UserMinus, UserPlus, Users } from "lucide-react";
import { addGroupMembers, leaveConversation, removeGroupMember, renameGroup } from "@/actions/chat";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Field, Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Person = {
  id: string;
  handle: string | null;
  full_name: string | null;
  avatar_url: string | null;
};
type Member = Person & { role: string };

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin" };
const nameOf = (p: Person) => p.full_name ?? p.handle ?? "Student";

/** C4: a group's members, and for its owner and admins: rename, add and remove. */
export function GroupInfo({
  conversationId,
  me,
  kind,
  title,
  emoji,
  myRole,
  manage,
  isRide,
  people,
  addable,
}: {
  conversationId: string;
  me: string;
  kind: string;
  title: string;
  emoji: string;
  myRole: string;
  /** The caller may rename, add and remove (a group someone made, and they run it). */
  manage: boolean;
  isRide: boolean;
  people: Member[];
  addable: Person[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, start] = useTransition();

  // Owners, then admins, then everyone else by name; you first among equals.
  const rank = (m: Member) => (m.role === "owner" ? 0 : m.role === "admin" ? 1 : 2);
  const members = [...people].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      Number(b.id === me) - Number(a.id === me) ||
      nameOf(a).localeCompare(nameOf(b)),
  );

  // The owner can remove anyone; an admin can remove members.
  const canRemove = (m: Member) =>
    manage && m.id !== me && m.role !== "owner" && (myRole === "owner" || m.role === "member");

  async function remove(m: Member) {
    const ok = await confirm({
      title: `Remove ${nameOf(m)}?`,
      body: "They'll lose access to this chat, including its earlier messages.",
      action: "Remove",
    });
    if (!ok) return;
    start(async () => {
      const r = await removeGroupMember(conversationId, m.id);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Removed ${nameOf(m)}`);
      router.refresh();
    });
  }

  async function leave() {
    const ok = await confirm({
      title: `Leave ${title}?`,
      body: isRide
        ? "You'll give up your seat on this ride."
        : myRole === "owner" && people.length > 1
          ? "You'll stop getting its messages. Someone else in the group becomes its owner."
          : "You'll stop getting its messages.",
      action: "Leave",
    });
    if (!ok) return;
    start(async () => {
      const r = await leaveConversation(conversationId);
      if (!r.ok) return void toast.error(r.error);
      router.replace("/chats?tab=groups");
    });
  }

  return (
    <div className="grid gap-6">
      <div className="grid justify-items-center gap-2 text-center">
        <span className="grid size-20 place-items-center rounded-pill bg-raised text-4xl text-sec">
          {emoji || <Users className="size-9" aria-hidden />}
        </span>
        <h1 className="text-title2">{title}</h1>
        <p className="text-subhead text-sec">
          {people.length} {people.length === 1 ? "member" : "members"}
        </p>
      </div>

      {manage && <RenameForm conversationId={conversationId} title={title} emoji={emoji} />}

      <section className="grid gap-2" aria-labelledby="members-heading">
        <div className="flex items-center justify-between">
          <h2 id="members-heading" className="text-headline">
            Members
          </h2>
          {manage && <AddPeople conversationId={conversationId} addable={addable} />}
        </div>
        <ul className="divide-y divide-sep overflow-hidden rounded-card bg-surface shadow-card contrast-more:border contrast-more:border-label">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-3 py-2">
              <Link
                href={m.handle ? `/people/${m.handle}` : "#"}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-3"
              >
                <Avatar name={nameOf(m)} src={m.avatar_url} size="sm" />
                <span className="truncate font-medium">
                  {nameOf(m)}
                  {m.id === me && <span className="text-sec"> (you)</span>}
                </span>
              </Link>
              {ROLE_LABEL[m.role] && (
                <Pill tone="outline" className="h-6 px-2 text-xs">
                  {ROLE_LABEL[m.role]}
                </Pill>
              )}
              {canRemove(m) && (
                <Button
                  variant="destructive"
                  size="icon"
                  aria-label={`Remove ${nameOf(m)}`}
                  disabled={pending}
                  onClick={() => void remove(m)}
                >
                  <UserMinus />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {(kind === "group" || kind === "batch" || kind === "course") && (
        <Button variant="destructive" block disabled={pending} onClick={() => void leave()}>
          <LogOut /> {isRide ? "Leave ride" : "Leave group"}
        </Button>
      )}
    </div>
  );
}

function RenameForm({
  conversationId,
  title: initialTitle,
  emoji: initialEmoji,
}: {
  conversationId: string;
  title: string;
  emoji: string;
}) {
  const id = useId();
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [emoji, setEmoji] = useState(initialEmoji);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const changed = title.trim() !== initialTitle || emoji.trim() !== initialEmoji;

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    setBusy(true);
    const r = await renameGroup(conversationId, { title, emoji });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setError(undefined);
    toast.success("Group updated");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-3" noValidate>
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
            />
          )}
        </Field>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      {changed && (
        <Button type="submit" size="md" disabled={busy || !title.trim()}>
          {busy && <Loader2 className="animate-spin" />} Save
        </Button>
      )}
    </form>
  );
}

function AddPeople({ conversationId, addable }: { conversationId: string; addable: Person[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const q = query.trim().toLowerCase();
  const shown = q
    ? addable.filter((c) => `${c.full_name ?? ""} ${c.handle ?? ""}`.toLowerCase().includes(q))
    : addable;
  const toggle = (person: string) =>
    setPicked((p) => (p.includes(person) ? p.filter((x) => x !== person) : [...p, person]));

  async function add() {
    setBusy(true);
    const r = await addGroupMembers(conversationId, picked);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success(picked.length === 1 ? "Added 1 person" : `Added ${picked.length} people`);
    setPicked([]);
    setQuery("");
    setError(undefined);
    setOpen(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="plain" size="sm">
          <UserPlus /> Add people
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="text-xl font-bold">Add people</SheetTitle>
        <SheetDescription className="mb-4 text-sm text-sec">
          Pick from your connections. Groups hold up to 50 people.
        </SheetDescription>
        {addable.length === 0 ? (
          <p className="text-sec">
            Nobody to add. You can add your connections who aren&apos;t in the group yet.
          </p>
        ) : (
          <div className="grid gap-3">
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
            <ul className="max-h-[50dvh] divide-y divide-sep overflow-y-auto rounded-card bg-surface shadow-card contrast-more:border contrast-more:border-label">
              {shown.map((c) => {
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
                      <Avatar name={nameOf(c)} src={c.avatar_url} size="sm" />
                      <span className="flex-1 truncate font-medium">{nameOf(c)}</span>
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
            {error && (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <Button block disabled={busy || picked.length === 0} onClick={() => void add()}>
              {busy && <Loader2 className="animate-spin" />}{" "}
              {picked.length > 1 ? `Add ${picked.length} people` : "Add"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
