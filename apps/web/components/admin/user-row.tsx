"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  allowStudiesChange,
  revokeVerification,
  setBanned,
  setModerator,
  warnUser,
} from "@/actions/trust";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

export type AdminUser = {
  id: string;
  full_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  role: string;
  verification_status: string;
  banned_at: string | null;
  deleted_at: string | null;
  department: string | null;
  batch_year: number | null;
  email: string | null;
  open_reports: number;
  last_active_at: string | null;
};

/** Phase 9 task 1: one student in admin search, with warn / ban / moderator controls. */
export function UserRow({
  user: u,
  spaces,
  scopes,
}: {
  user: AdminUser;
  spaces: { value: string; label: string }[];
  scopes: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"warn" | "ban" | "revoke" | "mod" | null>(null);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string[]>(scopes);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "Something went wrong");
      toast.success(done);
      setMode(null);
      setText("");
      router.refresh();
    });
  const name = u.full_name ?? "Unnamed";

  return (
    <li className="grid gap-3 p-3">
      <div className="flex items-center gap-3">
        <Avatar name={name} src={u.avatar_url} size="md" />
        <div className="grid min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5 font-semibold">
            {u.handle ? <Link href={`/people/${u.handle}`}>{name}</Link> : name}
            {u.role !== "student" && (
              <Pill tone="brand" className="h-5 px-2 text-caption capitalize">
                {u.role}
              </Pill>
            )}
            {u.banned_at && (
              <Pill tone="help" className="h-5 px-2 text-caption">
                Banned
              </Pill>
            )}
            {u.deleted_at && (
              <Pill tone="outline" className="h-5 px-2 text-caption">
                Deleting
              </Pill>
            )}
          </span>
          <span className="truncate text-xs text-sec">
            {[u.department, u.batch_year, u.verification_status, u.email]
              .filter(Boolean)
              .join(" · ")}
            {u.open_reports > 0 && ` · ${u.open_reports} open reports`}
          </span>
        </div>
      </div>
      {u.role !== "admin" && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="quiet"
            onClick={() => setMode(mode === "warn" ? null : "warn")}
          >
            Warn
          </Button>
          {u.banned_at ? (
            <Button
              size="sm"
              variant="tinted"
              disabled={pending}
              onClick={() => run(() => setBanned(u.id, false), `${name} unbanned`)}
            >
              Unban
            </Button>
          ) : (
            <Button
              size="sm"
              variant="quiet"
              onClick={() => setMode(mode === "ban" ? null : "ban")}
            >
              Ban
            </Button>
          )}
          <Button size="sm" variant="quiet" onClick={() => setMode(mode === "mod" ? null : "mod")}>
            {u.role === "moderator" ? "Moderator feeds" : "Make moderator"}
          </Button>
          <Button
            size="sm"
            variant="quiet"
            disabled={pending}
            onClick={() =>
              run(() => allowStudiesChange(u.id), `${name} can ask for one more studies change`)
            }
          >
            Allow studies change
          </Button>
          {u.verification_status === "verified" && (
            <Button
              size="sm"
              variant="quiet"
              onClick={() => setMode(mode === "revoke" ? null : "revoke")}
            >
              Revoke verification
            </Button>
          )}
        </div>
      )}
      {(mode === "warn" || mode === "ban" || mode === "revoke") && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                mode === "warn"
                  ? warnUser(u.id, text)
                  : mode === "ban"
                    ? setBanned(u.id, true, text)
                    : revokeVerification(u.id, text),
              mode === "warn"
                ? "Warning sent"
                : mode === "ban"
                  ? `${name} banned`
                  : `${name} is no longer verified`,
            );
          }}
        >
          <Input
            aria-label={
              mode === "warn"
                ? "Warning message"
                : mode === "ban"
                  ? "Reason for the ban"
                  : "Reason sent to the student"
            }
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
          />
          <Button
            type="submit"
            size="sm"
            variant={mode === "warn" ? "primary" : "destructive"}
            disabled={pending}
          >
            {mode === "warn" ? "Send" : mode === "ban" ? "Ban" : "Revoke"}
          </Button>
        </form>
      )}
      {mode === "mod" && (
        <form
          className="grid gap-2 rounded-field border border-sep p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => setModerator(u.id, picked),
              picked.length
                ? `${name} moderates ${picked.length} feed(s)`
                : `${name} is no longer a moderator`,
            );
          }}
        >
          <p className="text-sm font-semibold">Feeds they moderate</p>
          <div className="grid max-h-48 gap-1 overflow-y-auto">
            {spaces.map((s) => (
              <label key={s.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--accent)]"
                  checked={picked.includes(s.value)}
                  onChange={(e) =>
                    setPicked((p) =>
                      e.target.checked ? [...p, s.value] : p.filter((x) => x !== s.value),
                    )
                  }
                />
                {s.label}
              </label>
            ))}
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            Save
          </Button>
        </form>
      )}
    </li>
  );
}
