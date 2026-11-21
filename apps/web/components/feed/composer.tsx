"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Image as ImageIcon, ImagePlus, Loader2, SquarePen, X } from "lucide-react";
import { createPost } from "@/actions/feed";
import { toast } from "@/components/ui/toast";
import { SupportDialog } from "@/components/safety/support-dialog";
import { mentionsSelfHarm } from "@/lib/support";
import { useGuidelinesGate } from "@/components/trust/guidelines-gate";
import { GUIDELINES_REQUIRED } from "@/lib/guidelines";
import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { uploadPhoto } from "@/lib/photos";

type Space = { value: string; label: string };

const OPEN_EVENT = "uosbuddy:compose";

/** The toolbar's compose button (redesign §5.2 #1): opens the same composer sheet. */
export function ComposeButton() {
  return (
    <IconButton
      cta
      aria-label="New post"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
    >
      <SquarePen aria-hidden />
    </IconButton>
  );
}

/** Opens the composer from anywhere on the page (an empty state's action, say). */
export const openComposer = () => window.dispatchEvent(new Event(OPEN_EVENT));

/** Phase 5 task 2: write a post — text, up to 4 photos, an optional poll. */
export function Composer({
  spaces,
  initialSpace,
  anonymousAllowed,
  me,
  placeholder,
}: {
  spaces: Space[];
  initialSpace: string;
  anonymousAllowed: boolean;
  me: { name: string; src: string | null };
  placeholder: string;
}) {
  const id = useId();
  const router = useRouter();
  const { gate, ask } = useGuidelinesGate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [space, setSpace] = useState(initialSpace);
  const [body, setBody] = useState("");
  const [support, setSupport] = useState(false);
  const [photos, setPhotos] = useState<{ path: string; preview: string }[]>([]);
  const [poll, setPoll] = useState<string[] | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState<"upload" | "post" | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  function reset() {
    setBody("");
    setPhotos([]);
    setPoll(null);
    setAnonymous(false);
    setError(undefined);
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const room = 4 - photos.length;
    const picked = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, room);
    if (!picked.length) return setError("Add JPG, PNG or WebP photos (up to 4).");
    setBusy("upload");
    setError(undefined);
    try {
      for (const file of picked) {
        const uploaded = await uploadPhoto("post-media", "posts", file);
        setPhotos((p) => [...p, uploaded]);
      }
    } catch {
      setError("Couldn't upload the photo. Try again.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    const options = poll?.map((o) => o.trim()).filter(Boolean);
    if (poll && (options?.length ?? 0) < 2) return setError("A poll needs at least 2 options.");
    setBusy("post");
    const result = await createPost({
      space,
      body,
      media: photos.map((p) => p.path),
      poll: options,
      anonymous,
    });
    setBusy(null);
    if (!result.ok && result.error === GUIDELINES_REQUIRED) {
      if (await ask()) await submit(e);
      return;
    }
    if (!result.ok) return setError(result.error);
    if (result.data.held)
      toast.success("Thanks. A moderator will check your post before it shows up.");
    if (mentionsSelfHarm(body)) setSupport(true);
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          {/* The composer row (redesign §5.2 #3): tapping anywhere on it opens the sheet. */}
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-card bg-surface py-3 pr-4 pl-3 text-left shadow-card transition-transform duration-100 ease-out active:scale-[0.99]"
          >
            <span aria-hidden>
              <Avatar name={me.name} src={me.src} size={36} />
            </span>
            <span className="min-w-0 flex-1 truncate text-body text-ter">
              <span className="sr-only">Write a post. </span>
              {placeholder}
            </span>
            <ImageIcon
              className="size-[22px] shrink-0 text-accent"
              strokeWidth={1.75}
              aria-hidden
            />
          </button>
        </SheetTrigger>
        <SheetContent>
          <SheetTitle className="text-title2">New post</SheetTitle>
          <SheetDescription className="mb-4 text-subhead text-sec">
            Only verified UoS students can see it.
          </SheetDescription>
          <form onSubmit={submit} className="grid gap-4" noValidate>
            {spaces.length > 1 && (
              <Field id={`${id}-space`} label="Post to">
                {(aria) => (
                  <NativeSelect {...aria} value={space} onChange={(e) => setSpace(e.target.value)}>
                    {spaces.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
            )}
            <Field id={`${id}-body`} label="What's happening?" hint={`${body.length}/2000`}>
              {(aria) => (
                <Textarea
                  {...aria}
                  value={body}
                  maxLength={2000}
                  onChange={(e) => setBody(e.target.value)}
                  className="min-h-32"
                  placeholder="Lost something? Found a great teacher? Ask the campus."
                />
              )}
            </Field>

            {photos.length > 0 && (
              <ul className="grid grid-cols-4 gap-2">
                {photos.map((p) => (
                  <li key={p.path} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                    <img
                      src={p.preview}
                      alt=""
                      className="aspect-square w-full rounded-field object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() => setPhotos((list) => list.filter((x) => x.path !== p.path))}
                      className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-pill bg-label text-bg"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {poll && (
              <fieldset className="grid gap-2 rounded-well bg-raised p-3">
                <legend className="sr-only">Poll</legend>
                {poll.map((o, i) => (
                  <Input
                    key={i}
                    aria-label={`Option ${i + 1}`}
                    value={o}
                    maxLength={80}
                    placeholder={`Option ${i + 1}`}
                    onChange={(e) =>
                      setPoll((p) => p!.map((x, j) => (j === i ? e.target.value : x)))
                    }
                  />
                ))}
                <div className="flex justify-between text-subhead font-semibold">
                  {poll.length < 4 ? (
                    <button
                      type="button"
                      className="text-accent"
                      onClick={() => setPoll((p) => [...p!, ""])}
                    >
                      Add option
                    </button>
                  ) : (
                    <span />
                  )}
                  <button type="button" className="text-sec" onClick={() => setPoll(null)}>
                    Remove poll
                  </button>
                </div>
              </fieldset>
            )}

            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => void addPhotos(e.target.files)}
              />
              <Button
                type="button"
                variant="tinted"
                size="sm"
                disabled={photos.length >= 4 || busy === "upload"}
                onClick={() => fileRef.current?.click()}
              >
                {busy === "upload" ? <Loader2 className="animate-spin" /> : <ImagePlus />} Photos
              </Button>
              {!poll && (
                <Button type="button" variant="tinted" size="sm" onClick={() => setPoll(["", ""])}>
                  <BarChart3 /> Poll
                </Button>
              )}
            </div>

            {anonymousAllowed && (
              <label className="flex cursor-pointer items-start justify-between gap-4 rounded-well bg-raised p-3">
                <span className="grid gap-0.5">
                  <span className="text-body">Post anonymously</span>
                  <span className="text-footnote text-sec">
                    Other students and moderators see an alias. An admin can find out who wrote it
                    if the rules are broken.
                  </span>
                </span>
                <Switch checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
              </label>
            )}

            {error && (
              <p role="alert" className="text-subhead text-danger">
                {error}
              </p>
            )}
            <Button variant="cta" type="submit" block disabled={!!busy || !body.trim()}>
              {busy === "post" && <Loader2 className="animate-spin" />} Post
            </Button>
          </form>
          {gate}
        </SheetContent>
      </Sheet>
      <SupportDialog open={support} onOpenChange={setSupport} />
    </>
  );
}
