"use client";

import { useId, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { DocPicker, uploadDoc } from "@/components/onboarding/doc-picker";
import { createProofUpload, submitProof } from "@/actions/onboarding";
import {
  fullNameSchema,
  isStudentId,
  whatsappSchema,
  type StudentIdFormats,
} from "@/lib/validation/onboarding";

type Errors = Partial<Record<"fullName" | "studentId" | "whatsapp" | "file" | "form", string>>;

/** Fresher step 2: student ID and proof (Section 7, screen 4b; §3.3 B steps 2–3). */
export function ProofForm({
  formats,
  defaults,
}: {
  formats: StudentIdFormats;
  defaults: { fullName: string; studentId: string; whatsapp: string };
}) {
  const id = useId();
  const [fullName, setFullName] = useState(defaults.fullName);
  const [studentId, setStudentId] = useState(defaults.studentId);
  const [whatsapp, setWhatsapp] = useState(defaults.whatsapp);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<string | null>(null);

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
      const docPath = await uploadDoc(file, createProofUpload, setStatus);

      setStatus("Submitting…");
      const result = await submitProof({
        fullName,
        studentId,
        whatsapp,
        docPath,
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
        <p className="text-[13px] text-sec">
          Any one of: admission letter, fee challan, student card, or a screenshot of the student
          portal showing your name and roll number.
        </p>
        <DocPicker
          file={file}
          onFile={(f) => {
            setErrors((e) => ({ ...e, file: undefined }));
            setFile(f);
          }}
          onError={(file) => setErrors((e) => ({ ...e, file }))}
          error={errors.file}
          alt="Your proof"
        />
      </fieldset>

      <p className="flex gap-2 rounded-field bg-raised p-3 text-[13px] text-sec">
        <ShieldCheck className="size-4 shrink-0 text-tint-text" />
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
