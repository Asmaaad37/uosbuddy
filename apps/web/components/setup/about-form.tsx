"use client";

import { useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { CroppedAvatar } from "@/components/setup/avatar-cropper";
import { saveAbout } from "@/actions/setup";
import { browserClient } from "@/lib/supabase/lazy";
import { VISIBILITY_LABELS } from "@/lib/setup";
import { handleProblem } from "@/lib/validation/handle";
import { cn } from "@/lib/utils";
import { radioArrowKeys } from "@/lib/radio-keys";

// The cropper is only downloaded when someone picks a photo.
const AvatarCropper = dynamic(
  () => import("@/components/setup/avatar-cropper").then((m) => m.AvatarCropper),
  { ssr: false },
);

type Residence = "day_scholar" | "hostelite" | "other";
type Visibility = keyof typeof VISIBILITY_LABELS;
type HandleState = "idle" | "checking" | "available" | "taken" | "invalid";

const RESIDENCES: { value: Residence; label: string }[] = [
  { value: "day_scholar", label: "Day scholar" },
  { value: "hostelite", label: "Hostelite" },
  { value: "other", label: "Other" },
];

// Common hometowns, offered as suggestions; any city can be typed.
const CITIES = [
  "Sargodha",
  "Bhalwal",
  "Kot Momin",
  "Shahpur",
  "Sillanwali",
  "Sahiwal",
  "Khushab",
  "Jauharabad",
  "Mianwali",
  "Bhakkar",
  "Chiniot",
  "Jhang",
  "Faisalabad",
  "Mandi Bahauddin",
  "Gujrat",
  "Lahore",
  "Rawalpindi",
  "Islamabad",
  "Multan",
  "Gujranwala",
  "Sheikhupura",
  "Hafizabad",
  "Pind Dadan Khan",
];

export function AboutForm({
  userId,
  initial,
  next = "/setup/interests",
  submitLabel = "Continue",
}: {
  userId: string;
  /** Where to go after saving: the next setup step, or back to /me when editing. */
  next?: string;
  submitLabel?: string;
  initial: {
    name: string;
    handle: string;
    bio: string;
    hometown: string;
    residence: Residence | null;
    avatarUrl: string | null;
    photoVisibility: Visibility;
  };
}) {
  const id = useId();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [handle, setHandle] = useState(initial.handle);
  const [handleState, setHandleState] = useState<HandleState>(
    initial.handle ? "available" : "idle",
  );
  const [handleMessage, setHandleMessage] = useState<string>();
  const [bio, setBio] = useState(initial.bio);
  const [hometown, setHometown] = useState(initial.hometown);
  const [residence, setResidence] = useState<Residence | null>(initial.residence);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [photoVisibility, setPhotoVisibility] = useState<Visibility>(initial.photoVisibility);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Debounced availability check: local rules first, then the database.
  useEffect(() => {
    const value = handle.trim();
    if (!value) return setHandleState("idle");
    // Your saved handle is yours; re-checking it would only block a quick Save while editing.
    if (value === initial.handle) {
      setHandleState("available");
      setHandleMessage(undefined);
      return;
    }
    const problem = handleProblem(value);
    if (problem) {
      setHandleState("invalid");
      setHandleMessage(problem);
      return;
    }
    setHandleState("checking");
    const timer = setTimeout(async () => {
      const { data } = await (await browserClient()).rpc("handle_available", { p_handle: value });
      setHandleState(data ? "available" : "taken");
      setHandleMessage(data ? undefined : "That handle is taken");
    }, 400);
    return () => clearTimeout(timer);
  }, [handle, initial.handle]);

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose a photo.");
    setError(undefined);
    setCropSrc(URL.createObjectURL(file));
  }

  async function uploadCropped({ large, small, type }: CroppedAvatar) {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setUploading(true);
    try {
      const supabase = await browserClient();
      const ext = type === "image/webp" ? "webp" : "jpg";
      // A new version per upload, so caches never show the old photo.
      const version = Date.now().toString(36);
      const bucket = supabase.storage.from("avatars");
      const [a, b] = await Promise.all([
        bucket.upload(`${userId}/${version}-512.${ext}`, large, { contentType: type }),
        bucket.upload(`${userId}/${version}-128.${ext}`, small, { contentType: type }),
      ]);
      if (a.error || b.error) throw new Error("upload failed");
      setAvatarUrl(bucket.getPublicUrl(`${userId}/${version}-512.${ext}`).data.publicUrl);
    } catch {
      setError("Couldn't upload your photo. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(undefined);
    if (handleState !== "available") return setError(handleMessage ?? "Choose a handle");
    if (!residence) return setError("Are you a day scholar or a hostelite?");

    setBusy(true);
    const result = await saveAbout({
      handle: handle.trim(),
      bio,
      hometown,
      residence,
      avatarUrl,
      photoVisibility,
    });
    if (!result.ok) {
      setBusy(false);
      return setError(result.error);
    }
    router.push(next);
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar name={initial.name || handle || "?"} src={avatarUrl ?? undefined} size="xl" />
          {uploading && (
            <span className="absolute inset-0 grid place-items-center rounded-pill bg-label/50">
              <Loader2 className="size-6 animate-spin text-bg" />
            </span>
          )}
        </div>
        <div className="grid gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              pickPhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="tinted"
            size="md"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Camera /> {avatarUrl ? "Change photo" : "Add a photo"}
          </Button>
          {avatarUrl && (
            <button
              type="button"
              className="justify-self-start text-sm font-semibold text-sec hover:text-danger"
              onClick={() => setAvatarUrl(null)}
            >
              Remove photo
            </button>
          )}
        </div>
      </div>
      {cropSrc && (
        <AvatarCropper
          src={cropSrc}
          onCancel={() => {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
          }}
          onDone={uploadCropped}
        />
      )}
      <Field id={`${id}-photo-vis`} label="Who can see your photo">
        {(aria) => (
          <NativeSelect
            {...aria}
            value={photoVisibility}
            onChange={(e) => setPhotoVisibility(e.target.value as Visibility)}
          >
            {(Object.keys(VISIBILITY_LABELS) as Visibility[]).map((v) => (
              <option key={v} value={v}>
                {VISIBILITY_LABELS[v]}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field
        id={`${id}-handle`}
        label="Handle"
        hint={
          handleState === "available"
            ? `Your profile link: /people/${handle.trim()}`
            : "Letters, numbers and underscores. You can change it later."
        }
        error={handleState === "taken" || handleState === "invalid" ? handleMessage : undefined}
      >
        {(aria) => (
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sec">
              @
            </span>
            <Input
              {...aria}
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/\s/g, ""))}
              maxLength={20}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="pr-11 pl-9"
            />
            <span className="absolute top-1/2 right-4 -translate-y-1/2" aria-live="polite">
              {handleState === "checking" && (
                <Loader2 className="size-4 animate-spin text-sec" aria-label="Checking" />
              )}
              {handleState === "available" && (
                <Check className="size-4 text-tint-text" aria-label="Available" />
              )}
              {(handleState === "taken" || handleState === "invalid") && (
                <X className="size-4 text-danger" aria-label="Not available" />
              )}
            </span>
          </div>
        )}
      </Field>

      <Field id={`${id}-bio`} label="Bio (optional)" hint={`${bio.length}/280`}>
        {(aria) => (
          <Textarea
            {...aria}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={280}
            placeholder="Chai, cricket and C++. Ask me about the best canteen samosas."
          />
        )}
      </Field>

      <Field id={`${id}-hometown`} label="Hometown (optional)">
        {(aria) => (
          <>
            <Input
              {...aria}
              value={hometown}
              onChange={(e) => setHometown(e.target.value)}
              maxLength={60}
              list={`${id}-cities`}
              autoComplete="address-level2"
            />
            <datalist id={`${id}-cities`}>
              {CITIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </>
        )}
      </Field>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold">Where do you stay?</legend>
        <div
          className="grid grid-cols-3 gap-2"
          role="radiogroup"
          onKeyDown={radioArrowKeys}
          aria-label="Where do you stay?"
        >
          {RESIDENCES.map((r) => (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={residence === r.value}
              onClick={() => setResidence(r.value)}
              className={cn(
                "h-12 rounded-pill text-sm transition-colors",
                residence === r.value
                  ? "bg-midnight font-semibold text-on-fill"
                  : "bg-surface font-medium text-label shadow-card hover:bg-raised",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button variant="cta" type="submit" block disabled={busy || uploading}>
        {busy ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
