"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellOff, LogOut, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { hideConversation, leaveConversation, setMuted } from "@/actions/chat";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ChatRowData = {
  id: string;
  name: string;
  avatar: string | null;
  group: boolean;
  emoji: string | null;
  preview: string;
  time: string;
  unread: number;
  muted: boolean;
};

const ACTION_W = 80;

/**
 * A chat row (redesign §5.4 #5): avatar 52, name 17/600, one-line preview, time, and an
 * --accent dot when unread. Swipe left for Mute, and Leave (groups) or Delete (one-to-one
 * chats, from your list only); both confirm first.
 */
export function ChatRow({ chat }: { chat: ChatRowData }) {
  const router = useRouter();
  const [muted, setMutedState] = useState(chat.muted);
  const [x, setX] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; base: number; swiping: boolean } | null>(null);
  const moved = useRef(false);
  const width = ACTION_W * 2;
  const open = x !== 0;
  const unread = chat.unread > 0 && !muted;

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse") return;
    start.current = { x: e.clientX, y: e.clientY, base: x, swiping: false };
    moved.current = false;
  }
  function onPointerMove(e: React.PointerEvent) {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (!s.swiping) {
      if (Math.abs(e.clientY - s.y) > 10) return void (start.current = null);
      if (Math.abs(dx) < 8) return;
      s.swiping = true;
      moved.current = true;
      setDragging(true);
    }
    setX(Math.min(0, Math.max(-width - 24, s.base + dx)));
  }
  function onPointerUp() {
    if (start.current?.swiping) setX((v) => (v < -width / 2 ? -width : 0));
    start.current = null;
    setDragging(false);
  }

  async function toggleMute() {
    const next = !muted;
    setMutedState(next);
    setX(0);
    const r = await setMuted(chat.id, next);
    if (!r.ok) {
      setMutedState(!next);
      return void toast.error(r.error);
    }
    toast(next ? `Muted ${chat.name}` : `Unmuted ${chat.name}`, {
      action: {
        label: "Undo",
        onClick: () => void setMuted(chat.id, !next).then(() => setMutedState(!next)),
      },
    });
  }

  async function leave() {
    setConfirm(false);
    const r = chat.group ? await leaveConversation(chat.id) : await hideConversation(chat.id);
    if (!r.ok) return void toast.error(r.error);
    router.refresh();
  }

  return (
    <li className="relative overflow-hidden">
      <div
        className={cn("absolute inset-y-0 right-0 flex", !open && !dragging && "invisible")}
        style={{ width }}
        aria-hidden={!open}
      >
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          onClick={toggleMute}
          className="grid flex-1 place-items-center gap-1 bg-thumb text-footnote font-semibold text-label"
        >
          <span className="grid justify-items-center gap-1">
            {muted ? (
              <Bell className="size-5" aria-hidden />
            ) : (
              <BellOff className="size-5" aria-hidden />
            )}
            {muted ? "Unmute" : "Mute"}
          </span>
        </button>
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          onClick={() => setConfirm(true)}
          className="grid flex-1 place-items-center bg-danger text-footnote font-semibold text-bg"
        >
          <span className="grid justify-items-center gap-1">
            {chat.group ? (
              <LogOut className="size-5" aria-hidden />
            ) : (
              <Trash2 className="size-5" aria-hidden />
            )}
            {chat.group ? "Leave" : "Delete"}
          </span>
        </button>
      </div>
      <Link
        href={`/chats/${chat.id}`}
        onClick={(e) => {
          if (moved.current || open) {
            e.preventDefault();
            moved.current = false;
            setX(0);
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: `translateX(${x}px)` }}
        className={cn(
          "relative flex touch-pan-y items-center gap-3 bg-surface pl-4 active:bg-raised",
          !dragging &&
            "transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none",
        )}
      >
        {chat.group ? (
          <span className="grid size-[52px] shrink-0 place-items-center rounded-pill bg-raised text-xl text-sec">
            {chat.emoji ?? <Users className="size-6" aria-hidden />}
          </span>
        ) : (
          <Avatar name={chat.name} src={chat.avatar} size={52} />
        )}
        <span
          data-row-text
          className="flex min-h-[76px] min-w-0 flex-1 flex-col justify-center gap-0.5 py-3 pr-4 shadow-[inset_0_-1px_0_var(--sep)]"
        >
          <span className="flex items-baseline gap-2">
            <span className="truncate text-headline">{chat.name}</span>
            {muted && <BellOff className="size-3.5 shrink-0 text-ter" aria-label="Muted" />}
            <span className="ml-auto shrink-0 text-footnote text-ter">{chat.time}</span>
          </span>
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "truncate text-subhead",
                unread ? "font-semibold text-label" : "text-sec",
              )}
            >
              {chat.preview}
            </span>
            {chat.unread > 0 && (
              <span
                aria-label={`${chat.unread} unread`}
                className={cn(
                  "ml-auto size-2.5 shrink-0 rounded-pill",
                  muted ? "bg-ter" : "bg-accent",
                )}
              />
            )}
          </span>
        </span>
      </Link>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogTitle className="text-headline">
            {chat.group ? `Leave ${chat.name}?` : `Delete chat with ${chat.name}?`}
          </DialogTitle>
          <DialogDescription className="text-subhead text-sec">
            {chat.group
              ? "You'll stop getting its messages. You can join a batch chat again any time."
              : `It leaves your list only; ${chat.name.split(" ")[0]} keeps it. It comes back if either of you sends a new message.`}
          </DialogDescription>
          <div className="mt-4 grid gap-2">
            <Button variant="destructive" block onClick={leave}>
              {chat.group ? "Leave" : "Delete"}
            </Button>
            <Button variant="quiet" block onClick={() => setConfirm(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </li>
  );
}
