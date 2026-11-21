"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle, Plus, Users } from "lucide-react";
import {
  createStudyGroup,
  joinCourse,
  joinCourseChat,
  joinStudyGroup,
  leaveCourse,
} from "@/actions/courses";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Field, Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";

/** Join or leave the course this term, and open its chat. */
export function CourseControls({
  course,
  enrolled,
  chatId,
}: {
  course: string;
  enrolled: boolean;
  chatId: string | null;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  async function run(
    key: string,
    fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>,
  ) {
    setBusy(key);
    setError(undefined);
    const r = await fn();
    setBusy(null);
    if (!r.ok) return setError(r.error);
    return r;
  }

  if (!enrolled) {
    return (
      <div className="grid gap-1">
        <Button
          block
          onClick={() => run("join", () => joinCourse(course)).then((r) => r && router.refresh())}
          disabled={!!busy}
        >
          {busy === "join" && <Loader2 className="animate-spin" />} I&apos;m taking this course
        </Button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={async () => {
            if (chatId) return router.push(`/chats/${chatId}`);
            setBusy("chat");
            const r = await joinCourseChat(course);
            setBusy(null);
            if (r.ok) router.push(`/chats/${r.data}`);
            else setError(r.error);
          }}
          disabled={!!busy}
        >
          {busy === "chat" ? <Loader2 className="animate-spin" /> : <MessageCircle />} Course chat
        </Button>
        <Button
          variant="quiet"
          onClick={async () => {
            const ok = await confirm({
              title: "Leave this course?",
              body: "You'll leave its class list, course chat and study groups. You can join again any time.",
              action: "Leave course",
            });
            if (ok) void run("leave", () => leaveCourse(course)).then((r) => r && router.refresh());
          }}
          disabled={!!busy}
        >
          Leave
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export type StudyGroup = {
  id: string;
  title: string;
  meets: string | null;
  max_members: number;
  member_count: number;
  is_member: boolean;
  conversation_id: string;
};

/** Phase 6 task 3: study groups for a course (small group chats). */
export function StudyGroups({
  course,
  groups,
  enrolled,
}: {
  course: string;
  groups: StudyGroup[];
  enrolled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [meets, setMeets] = useState("");
  const [max, setMax] = useState(6);

  async function join(g: StudyGroup) {
    if (g.is_member) return router.push(`/chats/${g.conversation_id}`);
    setBusy(g.id);
    const r = await joinStudyGroup(g.id);
    setBusy(null);
    if (r.ok) router.push(`/chats/${r.data}`);
    else setError(r.error);
  }

  async function create(e: { preventDefault(): void }) {
    e.preventDefault();
    setBusy("create");
    const r = await createStudyGroup({ course, title, meets: meets || undefined, max });
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setOpen(false);
    router.push(`/chats/${r.data}`);
  }

  return (
    <div className="grid gap-3">
      {enrolled && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="tinted" block>
              <Plus /> Start a study group
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle className="text-xl font-bold">Start a study group</SheetTitle>
            <SheetDescription className="mb-4 text-sm text-sec">
              A small group chat for this course. Classmates can join until it&apos;s full.
            </SheetDescription>
            <form onSubmit={create} className="grid gap-4" noValidate>
              <Field id="sg-title" label="Name">
                {(aria) => (
                  <Input
                    {...aria}
                    value={title}
                    maxLength={60}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Mid-term prep"
                  />
                )}
              </Field>
              <Field id="sg-meets" label="When and where (optional)">
                {(aria) => (
                  <Input
                    {...aria}
                    value={meets}
                    maxLength={80}
                    onChange={(e) => setMeets(e.target.value)}
                    placeholder="Tue 3pm, central library"
                  />
                )}
              </Field>
              <Field id="sg-max" label="Size">
                {(aria) => (
                  <NativeSelect
                    {...aria}
                    value={max}
                    onChange={(e) => setMax(Number(e.target.value))}
                  >
                    {[3, 4, 6, 8, 12].map((n) => (
                      <option key={n} value={n}>
                        Up to {n} people
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
              <Button variant="cta" type="submit" block disabled={busy === "create"}>
                {busy === "create" && <Loader2 className="animate-spin" />} Create
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      )}
      {error && !open && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {groups.length ? (
        <ul className="grid gap-2">
          {groups.map((g) => {
            const full = g.member_count >= g.max_members;
            return (
              <li
                key={g.id}
                className="flex items-center gap-3 rounded-card bg-surface p-3 shadow-card contrast-more:border contrast-more:border-label"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-pill bg-raised text-sec">
                  <Users className="size-5" />
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-semibold">{g.title}</span>
                  <span className="truncate text-sm text-sec">
                    {g.member_count}/{g.max_members}
                    {g.meets && ` · ${g.meets}`}
                  </span>
                </span>
                {(g.is_member || (enrolled && !full)) && (
                  <Button
                    size="sm"
                    variant={g.is_member ? "tinted" : "primary"}
                    onClick={() => join(g)}
                    disabled={!!busy}
                  >
                    {busy === g.id && <Loader2 className="animate-spin" />}{" "}
                    {g.is_member ? "Open" : "Join"}
                  </Button>
                )}
                {!g.is_member && full && <span className="text-sm text-sec">Full</span>}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={Users}>No study groups yet.</EmptyState>
      )}
    </div>
  );
}
