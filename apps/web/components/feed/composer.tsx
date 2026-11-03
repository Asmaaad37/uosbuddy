"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, ImagePlus, Loader2, PenSquare, X } from "lucide-react";
import { createPost } from "@/actions/feed";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { browserClient } from "@/lib/supabase/lazy";

type Space = { value: string; label: string };

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

/** Phase 5 task 2: write a post — text, up to 4 photos, an optional poll. */
export function Composer({
  spaces,
  initialSpace,
  anonymousAllowed,
}: {
  spaces: Space[];
  initialSpace: string;
  anonymousAllowed: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [space, setSpace] = useState(initialSpace);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<{ path: string; preview: string }[]>([]);
  const [poll, setPoll] = useState<string[] | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState<"upload" | "post" | null>(null);
  const [error, setError] = useState<string>();

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
      const supabase = await browserClient();
      for (const file of picked) {
        const photo = await prepare(file);
        // A random name: a photo's path must never reveal who posted it.
        const path = `posts/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("post-media")
          .upload(path, photo, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;
        setPhotos((p) => [...p, { path, preview: URL.createObjectURL(photo) }]);
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
    if (!result.ok) return setError(result.error);
    if (result.data.held)
      toast.success("Thanks. A moderator will check your post before it shows up.");
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button block>
          <PenSquare /> Write a post
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="text-xl font-bold">New post</SheetTitle>
        <SheetDescription className="mb-4 text-sm text-ink-2">
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
                    className="aspect-square w-full rounded-md object-cover"
                  />
                  <button
                    type="button"
                    aria-label="Remove photo"
                    onClick={() => setPhotos((list) => list.filter((x) => x.path !== p.path))}
                    className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-pill bg-ink text-bg"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {poll && (
            <fieldset className="grid gap-2 rounded-md border border-line p-3">
              <legend className="px-1 text-sm font-semibold">Poll</legend>
              {poll.map((o, i) => (
                <Input
                  key={i}
                  aria-label={`Option ${i + 1}`}
                  value={o}
                  maxLength={80}
                  placeholder={`Option ${i + 1}`}
                  onChange={(e) => setPoll((p) => p!.map((x, j) => (j === i ? e.target.value : x)))}
                />
              ))}
              <div className="flex justify-between text-sm font-semibold">
                {poll.length < 4 ? (
                  <button
                    type="button"
                    className="text-brand"
                    onClick={() => setPoll((p) => [...p!, ""])}
                  >
                    Add option
                  </button>
                ) : (
                  <span />
                )}
                <button type="button" className="text-ink-2" onClick={() => setPoll(null)}>
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
              variant="secondary"
              size="sm"
              disabled={photos.length >= 4 || busy === "upload"}
              onClick={() => fileRef.current?.click()}
            >
              {busy === "upload" ? <Loader2 className="animate-spin" /> : <ImagePlus />} Photos
            </Button>
            {!poll && (
              <Button type="button" variant="secondary" size="sm" onClick={() => setPoll(["", ""])}>
                <BarChart3 /> Poll
              </Button>
            )}
          </div>

          {anonymousAllowed && (
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-md border border-line p-3">
              <span className="grid gap-0.5">
                <span className="text-sm font-semibold">Post anonymously</span>
                <span className="text-[13px] text-ink-2">
                  Other students see an alias. Moderators can still see who wrote it.
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="mt-1 size-5 accent-[var(--brand)]"
              />
            </label>
          )}

          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <Button type="submit" block disabled={!!busy || !body.trim()}>
            {busy === "post" && <Loader2 className="animate-spin" />} Post
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
