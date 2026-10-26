"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, FileText, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { browserClient } from "@/lib/supabase/lazy";
import { createProofUpload, submitProof } from "@/actions/onboarding";
import {
  DOC_TYPES,
  MAX_DOC_BYTES,
  fullNameSchema,
  isStudentId,
  whatsappSchema,
  type StudentIdFormats,
} from "@/lib/validation/onboarding";

type Errors = Partial<Record<"fullName" | "studentId" | "whatsapp" | "file" | "form", string>>;

/** Re-encode photos as JPEG: smaller uploads, and EXIF (GPS, device) is dropped. */
async function prepare(file: File): Promise<File> {
  if (file.type === "application/pdf") return file;
  const { default: compress } = await import("browser-image-compression");
  return compress(file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 2400,
    fileType: "image/jpeg",
    preserveExif: false,
    useWebWorker: true,
  });
}

/** Fresher step 2: student ID and proof (Section 7, screen 4b; §3.3 B steps 2–3). */
export function ProofForm({
  formats,
  defaults,
}: {
  formats: StudentIdFormats;
  defaults: { fullName: string; studentId: string; whatsapp: string };
}) {
  const id = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(defaults.fullName);
  const [studentId, setStudentId] = useState(defaults.studentId);
  const [whatsapp, setWhatsapp] = useState(defaults.whatsapp);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function pick(f: File | undefined) {
    if (!f) return;
    if (!DOC_TYPES[f.type] && !f.type.startsWith("image/")) {
      return setErrors((e) => ({ ...e, file: "Upload a photo or a PDF." }));
    }
    setErrors((e) => ({ ...e, file: undefined }));
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    const name = fullNameSchema.safeParse(fullName);
    const phone = whatsappSchema.safeParse(whatsapp);
    const next: Errors = {
      fullName: name.success ? undefined : name.error.issues[0]?.message,
      studentId: isStudentId(studentId, formats)
        ? undefined
        : "That doesn't look like a UoS roll or registration number.",
      whatsapp: phone.success ? undefined : phone.error.issues[0]?.message,
      file: file ? undefined : "Add a photo of your proof.",
    };
    setErrors(next);
    if (Object.values(next).some(Boolean) || !file) return;

    try {
      setStatus("Preparing your photo…");
      const doc = await prepare(file);
      if (doc.size > MAX_DOC_BYTES) {
        setStatus(null);
        return setErrors({ file: "That file is over 8 MB. Try a photo instead." });
      }

      setStatus("Uploading…");
      const upload = await createProofUpload(doc.type);
      if (!upload.ok) throw new Error(upload.error);
      const { error } = await (
        await browserClient()
      ).storage
        .from("verification-docs")
        .uploadToSignedUrl(upload.data.path, upload.data.token, doc, { contentType: doc.type });
      if (error) throw new Error("The upload failed. Check your connection and try again.");

      setStatus("Submitting…");
      const result = await submitProof({
        fullName,
        studentId,
        whatsapp,
        docPath: upload.data.path,
      });
      if (!result.ok) throw new Error(result.error);
      window.location.assign("/pending");
    } catch (err) {
      setStatus(null);
      setErrors({ form: err instanceof Error ? err.message : "Something went wrong. Try again." });
    }
  }

  const busy = status !== null;

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <Field
        id={`${id}-name`}
        label="Full name"
        hint="Exactly as on your proof."
        error={errors.fullName}
      >
        {(aria) => (
          <Input
            {...aria}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
          />
        )}
      </Field>
      <Field
        id={`${id}-sid`}
        label="Roll or registration number"
        hint="Like BSCS51F22S037 or 22F-US-CSC-401. Only the reviewer sees it."
        error={errors.studentId}
      >
        {(aria) => (
          <Input
            {...aria}
            value={studentId}
            onChange={(e) => setStudentId(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="font-mono tracking-wide"
          />
        )}
      </Field>
      <Field
        id={`${id}-wa`}
        label="WhatsApp (optional)"
        hint="Only admins see this, in case we need to ask you something."
        error={errors.whatsapp}
      >
        {(aria) => (
          <Input
            {...aria}
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            autoComplete="tel"
            placeholder="+92 3XX XXXXXXX"
          />
        )}
      </Field>

      <fieldset className="grid gap-3">
        <legend className="mb-1.5 text-sm font-semibold">Proof that you&apos;re at UoS</legend>
        <p className="text-[13px] text-ink-2">
          Any one of: admission letter, fee challan, student card, or a screenshot of the student
          portal showing your name and roll number.
        </p>
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
          <div className="flex items-center gap-3 rounded-md border border-line bg-surface p-3">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
              <img src={preview} alt="Your proof" className="size-16 rounded-sm object-cover" />
            ) : (
              <span className="grid size-16 place-items-center rounded-sm bg-surface-2">
                <FileText className="size-6 text-ink-2" />
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => setFile(null)}>
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
        {errors.file && (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {errors.file}
          </p>
        )}
      </fieldset>

      <p className="flex gap-2 rounded-md bg-surface-2 p-3 text-[13px] text-ink-2">
        <ShieldCheck className="size-4 shrink-0 text-success" />
        Only a verifier sees your document. It&apos;s deleted 30 days after review.
      </p>

      {errors.form && (
        <p role="alert" className="text-sm font-medium text-danger">
          {errors.form}
        </p>
      )}
      <Button type="submit" block disabled={busy}>
        {status ?? "Submit for review"}
      </Button>
    </form>
  );
}
