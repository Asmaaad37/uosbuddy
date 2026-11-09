"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { browserClient } from "@/lib/supabase/lazy";
import { DOC_TYPES, MAX_DOC_BYTES } from "@/lib/validation/onboarding";
import type { ActionResult } from "@/actions/onboarding";

/** Re-encode photos as JPEG: smaller uploads, and EXIF (GPS, device) is dropped. */
async function prepare(file: File): Promise<File> {
  if (file.type === "application/pdf") return file;
  const { default: compress } = await import("browser-image-compression");
  return compress(file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 2400,
    fileType: "image/jpeg",
    preserveExif: false,
    // The worker build loads from a CDN, which our CSP blocks; a one-off photo is fine inline.
    useWebWorker: false,
  });
}

/** Prepares and uploads a proof document, returning its path. Throws a message to show. */
export async function uploadDoc(
  file: File,
  start: (mimeType: string) => Promise<ActionResult<{ path: string; token: string }>>,
  onStatus: (status: string) => void,
): Promise<string> {
  onStatus("Preparing your photo…");
  const doc = await prepare(file);
  if (doc.size > MAX_DOC_BYTES) throw new Error("That file is over 8 MB. Try a photo instead.");

  onStatus("Uploading…");
  const upload = await start(doc.type);
  if (!upload.ok) throw new Error(upload.error);
  const { error } = await (
    await browserClient()
  ).storage
    .from("verification-docs")
    .uploadToSignedUrl(upload.data.path, upload.data.token, doc, { contentType: doc.type });
  if (error) throw new Error("The upload failed. Check your connection and try again.");
  return upload.data.path;
}

/** Take a photo or choose a file, with a preview of what was picked. */
export function DocPicker({
  file,
  onFile,
  onError,
  error,
  alt,
}: {
  file: File | null;
  onFile: (file: File | null) => void;
  onError: (message: string) => void;
  error?: string;
  alt: string;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function pick(f: File | undefined) {
    if (!f) return;
    if (!DOC_TYPES[f.type] && !f.type.startsWith("image/")) {
      return onError("Upload a photo or a PDF.");
    }
    onFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  return (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={pickerRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        hidden
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {file ? (
        <div className="flex items-center gap-3 rounded-field border border-sep bg-surface p-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img src={preview} alt={alt} className="size-16 rounded-track object-cover" />
          ) : (
            <span className="grid size-16 place-items-center rounded-track bg-raised">
              <FileText className="size-6 text-sec" />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
          <Button type="button" size="sm" variant="ghost" onClick={() => onFile(null)}>
            Change
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={() => cameraRef.current?.click()}>
            <Camera /> Take photo
          </Button>
          <Button type="button" variant="secondary" onClick={() => pickerRef.current?.click()}>
            <Upload /> Choose file
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </>
  );
}
