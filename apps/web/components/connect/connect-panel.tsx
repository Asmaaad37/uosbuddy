"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, MessageCircle, UserPlus, X } from "lucide-react";
import { startDm } from "@/actions/chat";
import {
  removeConnection,
  requestConnection,
  respondConnection,
  type ConnectionState,
} from "@/actions/connect";
import { PingButton } from "@/components/timetable/free-now";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

/**
 * Phase 4 task 2: connect from a profile. The request sheet shows their Opening Move so
 * the note can answer it; an incoming request shows the note they sent.
 */
export function ConnectPanel({
  target,
  firstName,
  initialState,
  openingMove,
  incomingNote,
}: {
  target: string;
  firstName: string;
  initialState: ConnectionState;
  openingMove: { prompt: string; answer: string } | null;
  incomingNote: string | null;
}) {
  const fieldId = useId();
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  async function run<T>(
    key: string,
    fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>,
  ) {
    setBusy(key);
    setError(undefined);
    const result = await fn();
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    return result.data;
  }

  async function message() {
    const id = await run("message", () => startDm(target));
    if (id) router.push(`/chats/${id}`);
  }

  async function send(e: { preventDefault(): void }) {
    e.preventDefault();
    const next = await run("send", () => requestConnection(target, note));
    if (next) {
      setState(next);
      setOpen(false);
    }
  }

  const spin = (key: string) => (busy === key ? <Loader2 className="animate-spin" /> : null);

  return (
    <div className="grid gap-2">
      {state === "incoming" && (
        <div className="grid gap-3 rounded-card border border-accent/40 bg-tint p-4">
          <p className="font-semibold">{firstName} wants to connect</p>
          {incomingNote && <p className="text-sec">&ldquo;{incomingNote}&rdquo;</p>}
          <div className="flex gap-2">
            <Button
              size="md"
              className="flex-1"
              disabled={!!busy}
              onClick={async () => {
                const next = await run("accept", () => respondConnection(target, true));
                if (next) setState(next);
              }}
            >
              {spin("accept") ?? <Check />} Accept
            </Button>
            <Button
              size="md"
              variant="tinted"
              className="flex-1"
              disabled={!!busy}
              onClick={async () => {
                const next = await run("decline", () => respondConnection(target, false));
                if (next) setState(next);
              }}
            >
              {spin("decline") ?? <X />} Decline
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {state === "none" && (
          <Button className="flex-1" onClick={() => setOpen(true)} disabled={!!busy}>
            <UserPlus /> Connect
          </Button>
        )}
        {state === "outgoing" && (
          <Button className="flex-1" variant="tinted" disabled>
            <Check /> Requested
          </Button>
        )}
        {state === "connected" && (
          <>
            <Button className="flex-1" onClick={message} disabled={!!busy}>
              {spin("message") ?? <MessageCircle />} Message
            </Button>
            <PingButton target={target} />
          </>
        )}
        {state !== "connected" && (
          <Button
            variant={state === "none" ? "tinted" : "quiet"}
            className={state === "none" ? "flex-1" : ""}
            onClick={message}
            disabled={!!busy}
          >
            {spin("message") ?? <MessageCircle />} Message
          </Button>
        )}
      </div>

      {state === "outgoing" && (
        <button
          type="button"
          className="justify-self-start text-sm font-semibold text-sec hover:text-label"
          disabled={!!busy}
          onClick={async () => {
            const done = await run("withdraw", () => removeConnection(target));
            if (done !== null) setState("none");
          }}
        >
          Withdraw request
        </button>
      )}
      {state === "connected" && (
        <p className="flex items-center gap-1.5 text-sm text-sec">
          <Check className="size-4 text-tint-text" /> You&apos;re connected
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetTitle className="text-xl font-bold">Connect with {firstName}</SheetTitle>
          <SheetDescription className="mb-4 text-sm text-sec">
            {openingMove
              ? "Reply to their Opening Move. It makes saying hi much easier."
              : "Add a short note so they know who you are."}
          </SheetDescription>
          <form onSubmit={send} className="grid gap-4">
            {openingMove && (
              <div className="grid gap-1 rounded-card border border-sep bg-bg p-3">
                <p className="text-sm font-semibold text-accent">{openingMove.prompt}</p>
                <p className="font-semibold">{openingMove.answer}</p>
              </div>
            )}
            <Field
              id={`${fieldId}-note`}
              label={openingMove ? "Your reply (optional)" : "Note (optional)"}
              hint={`${note.length}/300`}
            >
              {(aria) => (
                <Textarea
                  {...aria}
                  value={note}
                  maxLength={300}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    openingMove ? "Same! Let's go after class" : "Hi! We're in the same section"
                  }
                />
              )}
            </Field>
            {error && (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <Button type="submit" block disabled={!!busy}>
              {spin("send")} Send request
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
