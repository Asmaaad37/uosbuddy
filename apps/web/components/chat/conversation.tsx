"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Flag,
  ImagePlus,
  LogOut,
  Loader2,
  MoreHorizontal,
  SendHorizontal,
  Trash2,
  Users,
} from "lucide-react";
import {
  answerMessageRequest,
  deleteMessage,
  leaveConversation,
  loadLatest,
  loadOlder,
  markRead,
  setMuted,
  type Message,
} from "@/actions/chat";
import { ReportDialog, SafetyMenu } from "@/components/connect/safety-menu";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Button } from "@/components/ui/button";
import { clockTime, dayLabel, sameDay, startsGroup } from "@/lib/chat";
import { browserClient, realtimeClient } from "@/lib/supabase/lazy";
import { cn } from "@/lib/utils";

export type Person = {
  id: string;
  handle: string | null;
  full_name: string | null;
  avatar_url: string | null;
  last_read_at: string | null;
};

type Local = Message & { pending?: boolean; failed?: boolean; previewUrl?: string };

const BUCKET = "chat-attachments";

/** The database explains refusals in plain words; anything else gets a generic line. */
function sendErrorMessage(error: { code?: string; message: string } | null) {
  if (error && ["42501", "22023", "P0002", "54000"].includes(error.code ?? "")) {
    return error.message;
  }
  return "Couldn't send. Check your connection and try again.";
}

/** Re-encode photos as JPEG: smaller uploads, and EXIF (GPS, device) is dropped. */
async function prepare(file: File): Promise<File> {
  const { default: compress } = await import("browser-image-compression");
  return compress(file, {
    maxSizeMB: 1.5,
    maxWidthOrHeight: 1600,
    fileType: "image/jpeg",
    preserveExif: false,
    useWebWorker: false,
  });
}

/** Private photos: short-lived signed links, fetched once per path. */
const signed = new Map<string, Promise<string | null>>();
function useAttachmentUrl(path: string | null, seed?: string) {
  const [url, setUrl] = useState<string | null>(seed ?? null);
  useEffect(() => {
    if (!path || seed) return;
    let live = true;
    if (!signed.has(path)) {
      signed.set(
        path,
        browserClient().then(async (s) => {
          const { data } = await s.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
          return data?.signedUrl ?? null;
        }),
      );
    }
    void signed.get(path)!.then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [path, seed]);
  return url;
}

function Attachment({ path, seed }: { path: string | null; seed?: string }) {
  const url = useAttachmentUrl(path, seed);
  if (!url) return <div className="aspect-[4/3] w-56 animate-pulse rounded-md bg-surface-2" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
      <img src={url} alt="Photo" className="max-h-80 w-56 rounded-md object-cover" loading="lazy" />
    </a>
  );
}

/**
 * Phase 4 task 3: a conversation. Realtime inserts on `conversation:{id}` (RLS: members
 * only), optimistic send, typing via private broadcast, read receipts, photos, and older
 * messages loaded as you scroll up.
 */
export function Conversation({
  conversationId,
  me,
  kind,
  title,
  people,
  initialMessages,
  signedUrls,
  isRequest,
  muted: initialMuted,
}: {
  conversationId: string;
  me: string;
  kind: "dm" | "group" | "batch" | "course" | "backup_temp";
  title: string;
  people: Person[];
  /** Newest first, as loaded. */
  initialMessages: Message[];
  signedUrls: Record<string, string>;
  isRequest: boolean;
  muted: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Local[]>(() => [...initialMessages].reverse());
  const [reads, setReads] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(people.map((p) => [p.id, p.last_read_at])),
  );
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [request, setRequest] = useState(isRequest);
  const [muted, setMutedState] = useState(initialMuted);
  const [reporting, setReporting] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(initialMessages.length === 30);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [live, setLive] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const channel = useRef<RealtimeChannel | null>(null);
  const lastTypingSent = useRef(0);
  const keepOffset = useRef<number | null>(null);
  const stick = useRef(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  const other = kind === "dm" ? people.find((p) => p.id !== me) : undefined;
  const nameOf = (id: string | null) =>
    (id && (byId[id]?.full_name ?? byId[id]?.handle)) || "Someone";

  // Keep the view pinned to the newest message unless the reader scrolled up; after
  // loading older messages, keep what they were looking at in place.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (keepOffset.current !== null) {
      el.scrollTop = el.scrollHeight - keepOffset.current;
      keepOffset.current = null;
    } else if (stick.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const read = useCallback(() => {
    if (document.visibilityState === "visible") void markRead(conversationId);
  }, [conversationId]);

  useEffect(() => {
    read();
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, [read]);

  // Realtime: new and changed messages, read positions, typing.
  useEffect(() => {
    let cancelled = false;
    void realtimeClient().then((supabase) => {
      if (cancelled) return;
      const filter = `conversation_id=eq.${conversationId}`;
      channel.current = supabase
        .channel(`conversation:${conversationId}`, { config: { private: true } })
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter },
          (p) => {
            const msg = p.new as Message;
            setMessages((list) => (list.some((m) => m.id === msg.id) ? list : [...list, msg]));
            if (msg.sender_id !== me) {
              setTyping((t) => {
                const rest = { ...t };
                delete rest[msg.sender_id ?? ""];
                return rest;
              });
              read();
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages", filter },
          (p) => {
            const msg = p.new as Message;
            setMessages((list) => list.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)));
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "conversation_members", filter },
          (p) => {
            const row = p.new as { user_id: string; last_read_at: string | null };
            setReads((r) => ({ ...r, [row.user_id]: row.last_read_at }));
          },
        )
        // Row changes flow once Postgres is subscribed (not just when the channel joins);
        // then merge anything sent while connecting.
        .on("system", {}, async (payload: { extension?: string; status?: string }) => {
          if (payload.extension !== "postgres_changes") return;
          const ready = payload.status === "ok";
          setLive(ready);
          if (!ready) return;
          const latest = await loadLatest(conversationId);
          if (!latest.ok || cancelled) return;
          setMessages((list) => {
            const known = new Set(list.map((m) => m.id));
            const missed = [...latest.data].reverse().filter((m) => !known.has(m.id));
            if (!missed.length) return list;
            return [...list, ...missed].sort(
              (a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
                a.id.localeCompare(b.id),
            );
          });
        })
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          const from = (payload as { userId?: string }).userId;
          if (from && from !== me) setTyping((t) => ({ ...t, [from]: Date.now() }));
        })
        .subscribe();
    });
    return () => {
      cancelled = true;
      const ch = channel.current;
      if (ch) void browserClient().then((supabase) => supabase.removeChannel(ch));
    };
  }, [conversationId, me, read]);

  // Typing fades after 4 s without news.
  useEffect(() => {
    if (!Object.keys(typing).length) return;
    const timer = setInterval(() => {
      setTyping((t) =>
        Object.fromEntries(Object.entries(t).filter(([, at]) => Date.now() - at < 4000)),
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [typing]);

  // Older messages as the top comes into view.
  useEffect(() => {
    const el = top.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry?.isIntersecting || loadingOlder) return;
      const oldest = messages.find((m) => !m.pending);
      if (!oldest) return;
      setLoadingOlder(true);
      const result = await loadOlder(conversationId, {
        createdAt: oldest.created_at,
        id: oldest.id,
      });
      setLoadingOlder(false);
      if (!result.ok) return;
      setHasMore(result.data.length === 30);
      keepOffset.current =
        (scroller.current?.scrollHeight ?? 0) - (scroller.current?.scrollTop ?? 0);
      setMessages((list) => [...[...result.data].reverse(), ...list]);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [conversationId, hasMore, loadingOlder, messages]);

  function announceTyping() {
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    void channel.current?.send({ type: "broadcast", event: "typing", payload: { userId: me } });
  }

  async function deliver(local: Local, body?: string, attachmentPath?: string) {
    stick.current = true;
    setMessages((list) => [...list, local]);
    // Straight to the database (no hop through our server): the function checks membership,
    // blocks and the rate limit itself.
    const supabase = await browserClient();
    const { data, error: sendError } = await supabase.rpc("send_message", {
      p_conversation: conversationId,
      p_body: body,
      p_attachment_path: attachmentPath,
    });
    const result =
      sendError || !data
        ? { ok: false as const, error: sendErrorMessage(sendError) }
        : { ok: true as const, data: data as Message };
    if (!result.ok) {
      setError(result.error);
      setMessages((list) =>
        list.map((m) => (m.id === local.id ? { ...m, pending: false, failed: true } : m)),
      );
      return;
    }
    setError(undefined);
    setRequest(false);
    const real = result.data;
    setMessages((list) => {
      const without = list.filter((m) => m.id !== local.id);
      return without.some((m) => m.id === real.id)
        ? without
        : [...without, { ...real, previewUrl: local.previewUrl }];
    });
  }

  function optimistic(
    body: string | null,
    attachmentPath: string | null,
    previewUrl?: string,
  ): Local {
    return {
      id: `local-${crypto.randomUUID()}`,
      conversation_id: conversationId,
      sender_id: me,
      body,
      attachment_path: attachmentPath,
      created_at: new Date().toISOString(),
      deleted_at: null,
      edited_at: null,
      reply_to_id: null,
      pending: true,
      previewUrl,
    };
  }

  function submit(e?: { preventDefault(): void }) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    void deliver(optimistic(body, null), body);
  }

  async function attach(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Send a photo (JPG, PNG or WebP).");
    setUploading(true);
    try {
      const photo = await prepare(file);
      const path = `${conversationId}/${crypto.randomUUID()}.jpg`;
      const supabase = await browserClient();
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, photo, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      const preview = URL.createObjectURL(photo);
      signed.set(path, Promise.resolve(preview));
      await deliver(optimistic(null, path, preview), undefined, path);
    } catch {
      setError("Couldn't send the photo. Try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // "Seen" under my latest message in a DM, once they've read past it.
  const myLast = [...messages].reverse().find((m) => m.sender_id === me && !m.pending);
  const theirRead = other ? reads[other.id] : null;
  const seen =
    kind === "dm" && myLast && theirRead && new Date(theirRead) >= new Date(myLast.created_at);
  const typers = Object.keys(typing).map(nameOf);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <header className="gutter flex items-center gap-3 border-b border-line bg-surface py-2">
        <Link
          href={request ? "/chats?tab=requests" : kind === "dm" ? "/chats" : "/chats?tab=groups"}
          aria-label="Back to chats"
          className="-ml-2 grid size-11 place-items-center rounded-pill hover:bg-surface-2"
        >
          <ArrowLeft className="size-5" />
        </Link>
        {other ? (
          <Link href={`/people/${other.handle}`} className="flex min-w-0 items-center gap-2">
            <Avatar name={title} src={other.avatar_url} size="sm" />
            <span className="truncate font-semibold">{title}</span>
          </Link>
        ) : (
          <span className="flex min-w-0 items-center gap-2">
            <span className="grid size-8 place-items-center rounded-pill bg-lane-people text-lane-people-ink">
              <Users className="size-4" />
            </span>
            <span className="grid min-w-0">
              <span className="truncate font-semibold">{title}</span>
              <span className="text-xs text-ink-2">{people.length} members</span>
            </span>
          </span>
        )}
        <div className="ml-auto">
          <SafetyMenu
            target={other?.id}
            name={kind === "dm" ? title.split(" ")[0]! : title}
            reportType={kind === "dm" && other ? "profile" : "conversation"}
            reportId={kind === "dm" && other ? other.id : conversationId}
            afterBlock="/chats"
            extra={
              <>
                <MenuItem
                  onSelect={async () => {
                    const next = !muted;
                    setMutedState(next);
                    const r = await setMuted(conversationId, next);
                    if (!r.ok) setMutedState(!next);
                  }}
                >
                  {muted ? <Bell /> : <BellOff />} {muted ? "Unmute" : "Mute"}
                </MenuItem>
                {kind !== "dm" && (
                  <MenuItem
                    onSelect={async () => {
                      const r = await leaveConversation(conversationId);
                      if (r.ok) router.replace("/chats?tab=groups");
                      else setError(r.error);
                    }}
                  >
                    <LogOut /> Leave
                  </MenuItem>
                )}
              </>
            }
          />
        </div>
      </header>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-label="Messages"
        data-live={live || undefined}
      >
        <div className="gutter mx-auto grid max-w-2xl gap-0.5 py-4">
          <div ref={top} aria-hidden className="h-1" />
          {loadingOlder && <Loader2 className="mx-auto size-5 animate-spin text-ink-2" />}
          {!hasMore && messages.length > 0 && (
            <p className="pb-4 text-center text-xs text-ink-2">This is the start of your chat.</p>
          )}
          {messages.length === 0 && (
            <p className="py-10 text-center text-ink-2">No messages yet. Say hi! 👋</p>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const mine = m.sender_id === me;
            const newDay = !prev || !sameDay(prev.created_at, m.created_at);
            const head = newDay || startsGroup(prev, m);
            return (
              <div key={m.id}>
                {newDay && (
                  <p className="py-3 text-center text-xs font-semibold text-ink-2">
                    {dayLabel(m.created_at)}
                  </p>
                )}
                {head && !mine && kind !== "dm" && (
                  <p className="mt-2 px-3 text-xs font-semibold text-ink-2">
                    {nameOf(m.sender_id)}
                  </p>
                )}
                <div
                  className={cn(
                    "group flex items-center gap-1",
                    mine ? "flex-row-reverse" : "flex-row",
                    head && "mt-2",
                  )}
                >
                  <div
                    className={cn(
                      "grid max-w-[80%] gap-1 rounded-lg px-3 py-2",
                      mine ? "bg-ink text-bg" : "border border-line bg-surface",
                      m.pending && "opacity-60",
                      m.failed && "border border-danger",
                    )}
                  >
                    {m.deleted_at ? (
                      <p className="text-sm italic opacity-70">Message deleted</p>
                    ) : (
                      <>
                        {m.attachment_path && (
                          <Attachment
                            path={m.attachment_path}
                            seed={m.previewUrl ?? signedUrls[m.attachment_path]}
                          />
                        )}
                        {m.body && (
                          <p className="text-[15px] break-words whitespace-pre-wrap">{m.body}</p>
                        )}
                      </>
                    )}
                    <p className={cn("text-right text-[10px]", mine ? "text-bg/60" : "text-ink-2")}>
                      {m.failed ? "Not sent" : m.pending ? "Sending…" : clockTime(m.created_at)}
                    </p>
                  </div>
                  {!m.pending && !m.failed && !m.deleted_at && (
                    <Menu>
                      <MenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Message options"
                          className="grid size-8 place-items-center rounded-pill text-ink-2 opacity-40 group-hover:opacity-100 hover:bg-surface-2 focus-visible:opacity-100"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </MenuTrigger>
                      <MenuContent align={mine ? "end" : "start"}>
                        {mine ? (
                          <MenuItem
                            danger
                            onSelect={async () => {
                              const r = await deleteMessage(m.id);
                              if (!r.ok) return setError(r.error);
                              setMessages((list) =>
                                list.map((x) =>
                                  x.id === m.id
                                    ? {
                                        ...x,
                                        body: null,
                                        attachment_path: null,
                                        deleted_at: new Date().toISOString(),
                                      }
                                    : x,
                                ),
                              );
                            }}
                          >
                            <Trash2 /> Delete for everyone
                          </MenuItem>
                        ) : (
                          <MenuItem onSelect={() => setReporting(m.id)}>
                            <Flag /> Report message
                          </MenuItem>
                        )}
                      </MenuContent>
                    </Menu>
                  )}
                </div>
                {m.id === myLast?.id && kind === "dm" && (
                  <p className="pt-1 pr-1 text-right text-[11px] text-ink-2">
                    {seen ? "Seen" : "Sent"}
                  </p>
                )}
              </div>
            );
          })}
          {typers.length > 0 && (
            <p className="mt-2 px-3 text-sm text-ink-2 italic" aria-live="polite">
              {typers.join(", ")} {typers.length === 1 ? "is" : "are"} typing…
            </p>
          )}
        </div>
      </div>

      {request && other && (
        <div className="gutter grid gap-2 border-t border-line bg-surface py-3">
          <p className="text-sm">
            <strong>{title}</strong> isn&apos;t connected with you. Reply to accept, or decline to
            delete this chat.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={async () => {
                const r = await answerMessageRequest(conversationId, true);
                if (r.ok) setRequest(false);
                else setError(r.error);
              }}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              onClick={async () => {
                const r = await answerMessageRequest(conversationId, false);
                if (r.ok) router.replace("/chats?tab=requests");
                else setError(r.error);
              }}
            >
              Decline
            </Button>
          </div>
        </div>
      )}

      <form
        onSubmit={submit}
        className="gutter flex items-end gap-2 border-t border-line bg-surface pt-2 pb-[max(8px,env(safe-area-inset-bottom))]"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => void attach(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Send a photo"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
        </Button>
        <div className="flex-1">
          <textarea
            aria-label="Message"
            value={draft}
            rows={1}
            maxLength={4000}
            onChange={(e) => {
              setDraft(e.target.value);
              announceTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Message"
            className="max-h-32 min-h-11 w-full resize-none rounded-md border border-line bg-bg px-3 py-2.5 text-[15px] focus-visible:border-brand focus-visible:outline-none"
          />
        </div>
        <Button type="submit" size="icon" aria-label="Send" disabled={!draft.trim()}>
          <SendHorizontal />
        </Button>
      </form>
      <ReportDialog
        open={!!reporting}
        onOpenChange={(o) => !o && setReporting(null)}
        title="Report message"
        targetType="message"
        targetId={reporting ?? ""}
      />
      {error && (
        <p role="alert" className="gutter bg-surface pb-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
