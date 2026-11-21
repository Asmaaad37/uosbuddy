"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { createSociety, setSocietyAdmin, setSocietyMembership } from "@/actions/campus";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

/** Phase 8 task 3: start a society page. An admin verifies it before others see it. */
export function SocietySheet() {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [emoji, setEmoji] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    setBusy(true);
    const result = await createSociety({
      name,
      slug: slug || slugify(name),
      description,
      emoji: emoji || undefined,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    toast.success("Sent for verification. We'll let you know.");
    router.push(`/events/s/${result.data}`);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button block variant="tinted">
          <Plus /> Start a society page
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="text-xl font-bold">Start a society page</SheetTitle>
        <SheetDescription className="mb-4 text-sm text-sec">
          For registered UoS societies. An admin checks it first.
        </SheetDescription>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid grid-cols-[4.5rem_1fr] gap-3">
            <Field id={`${id}-emoji`} label="Emoji">
              {(aria) => (
                <Input
                  {...aria}
                  value={emoji}
                  maxLength={8}
                  onChange={(e) => setEmoji(e.target.value)}
                  placeholder="🎤"
                />
              )}
            </Field>
            <Field id={`${id}-name`} label="Society name">
              {(aria) => (
                <Input
                  {...aria}
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="UoS Debating Society"
                />
              )}
            </Field>
          </div>
          <Field
            id={`${id}-slug`}
            label="Web address"
            hint={`/events/s/${slug || slugify(name) || "…"}`}
          >
            {(aria) => (
              <Input
                {...aria}
                value={slug}
                maxLength={40}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder={slugify(name) || "debating"}
              />
            )}
          </Field>
          <Field id={`${id}-about`} label="About">
            {(aria) => (
              <Textarea
                {...aria}
                value={description}
                maxLength={1000}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What you do, when you meet, how to join"
              />
            )}
          </Field>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <Button variant="cta" type="submit" block disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Send for verification
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** Join / leave a society, or make a member an admin. */
export function SocietyButton({
  society,
  kind,
  user,
  label,
}: {
  society: string;
  kind: "join" | "leave" | "make-admin";
  user?: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant={kind === "join" ? "primary" : "tinted"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r =
            kind === "make-admin"
              ? await setSocietyAdmin(society, user!, true)
              : await setSocietyMembership(society, kind === "join");
          if (!r.ok) return void toast.error(r.error);
          router.refresh();
        })
      }
    >
      {pending && <Loader2 className="animate-spin" />}
      {label ?? (kind === "join" ? "Join" : kind === "leave" ? "Leave" : "Make admin")}
    </Button>
  );
}
