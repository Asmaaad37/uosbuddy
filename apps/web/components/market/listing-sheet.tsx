"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Plus, X } from "lucide-react";
import { createListing } from "@/actions/campus";
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
import { useGuidelinesGate } from "@/components/trust/guidelines-gate";
import { GUIDELINES_REQUIRED } from "@/lib/guidelines";
import { LISTING_KINDS, LISTING_KIND_KEYS, type ListingKind } from "@/lib/campus";
import { browserClient } from "@/lib/supabase/lazy";
import { cn } from "@/lib/utils";
import { radioArrowKeys } from "@/lib/radio-keys";

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

/** Phase 8 task 2: sell, ask, give away, or report something lost or found. */
export function ListingSheet({ initialKind = "sell" }: { initialKind?: ListingKind }) {
  const id = useId();
  const router = useRouter();
  const { gate, ask } = useGuidelinesGate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ListingKind>(initialKind);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [photos, setPhotos] = useState<{ path: string; preview: string }[]>([]);
  const [busy, setBusy] = useState<"upload" | "post" | null>(null);
  const [error, setError] = useState<string>();
  const priced = kind === "sell" || kind === "buy";

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const picked = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 4 - photos.length);
    if (!picked.length) return setError("Add JPG, PNG or WebP photos (up to 4).");
    setBusy("upload");
    setError(undefined);
    try {
      const supabase = await browserClient();
      for (const file of picked) {
        const photo = await prepare(file);
        const path = `listings/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("listing-media")
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
    const amount = price.trim() ? Number(price.replace(/[,\s]/g, "")) : undefined;
    if (amount !== undefined && !Number.isInteger(amount)) return setError("Price in whole rupees");
    setBusy("post");
    const result = await createListing({
      kind,
      title,
      description,
      price: priced ? amount : undefined,
      media: photos.map((p) => p.path),
      location: location || undefined,
    });
    setBusy(null);
    if (!result.ok && result.error === GUIDELINES_REQUIRED) {
      if (await ask()) await submit(e);
      return;
    }
    if (!result.ok) return setError(result.error);
    if (result.data.held) toast.success("Thanks. A moderator will check it before it shows up.");
    setOpen(false);
    setTitle("");
    setDescription("");
    setPrice("");
    setLocation("");
    setPhotos([]);
    setError(undefined);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button block variant="primary">
          <Plus /> Post a listing
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="text-xl font-bold">New listing</SheetTitle>
        <SheetDescription className="mb-4 text-sm text-sec">
          Seen by verified UoS students. Meet on campus to hand things over, and never pay in
          advance.
        </SheetDescription>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div
            className="grid grid-cols-5 gap-1.5"
            role="radiogroup"
            onKeyDown={radioArrowKeys}
            aria-label="Kind"
          >
            {LISTING_KIND_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "grid h-14 place-items-center rounded-field border text-xs font-semibold",
                  kind === k ? "border-accent bg-tint" : "border-sep hover:border-sec/50",
                )}
              >
                <span aria-hidden className="text-base">
                  {LISTING_KINDS[k].emoji}
                </span>
                {LISTING_KINDS[k].tab}
              </button>
            ))}
          </div>
          <Field id={`${id}-title`} label="Title">
            {(aria) => (
              <Input
                {...aria}
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={kind === "lost" ? "Blue umbrella near the library" : "Casio fx-991ES"}
              />
            )}
          </Field>
          <Field id={`${id}-description`} label="Details (optional)">
            {(aria) => (
              <Textarea
                {...aria}
                value={description}
                maxLength={1000}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Condition, when and where to meet"
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {priced && (
              <Field id={`${id}-price`} label="Price (Rs)">
                {(aria) => (
                  <Input
                    {...aria}
                    inputMode="numeric"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="2500"
                  />
                )}
              </Field>
            )}
            <Field id={`${id}-where`} label="Where (optional)">
              {(aria) => (
                <Input
                  {...aria}
                  value={location}
                  maxLength={80}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Main library"
                />
              )}
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <div key={p.path} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                <img src={p.preview} alt="" className="size-20 rounded-field object-cover" />
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => setPhotos((x) => x.filter((y) => y.path !== p.path))}
                  className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-pill bg-fill text-on-fill"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            {photos.length < 4 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy === "upload"}
                className="grid size-20 place-items-center rounded-field border border-dashed border-sep text-sec"
                aria-label="Add photos"
              >
                {busy === "upload" ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              aria-label="Listing photos"
              onChange={(e) => void addPhotos(e.target.files)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <Button type="submit" block disabled={!!busy}>
            {busy === "post" && <Loader2 className="animate-spin" />} Post
          </Button>
        </form>
        {gate}
      </SheetContent>
    </Sheet>
  );
}
