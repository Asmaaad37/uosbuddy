"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DocPicker, uploadDoc } from "@/components/onboarding/doc-picker";
import { createStudiesProofUpload, requestStudiesChange, saveAcademic } from "@/actions/setup";
import { SECTIONS, batchYears, departmentShortName } from "@/lib/setup";
import { cn } from "@/lib/utils";

type Department = { id: string; name: string; faculty: string | null; aliases: string[] };
type Program = { id: string; department_id: string; name: string; duration_semesters: number };
type Shift = "morning" | "evening" | "weekend";
type Section = "" | (typeof SECTIONS)[number]["value"];

const SHIFTS: { value: Shift; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "evening", label: "Evening" },
  { value: "weekend", label: "Weekend" },
];

export function AcademicForm({
  departments,
  programs,
  initial,
  next = "/setup/about",
  submitLabel = "Continue",
  mode = "free",
}: {
  /**
   * "free" during setup. "locked" after it: department and session stay, and so do a section
   * and shift already chosen. "proof" asks an admin to change them, with a document.
   */
  mode?: "free" | "locked" | "proof";
  /** Where to go after saving: the next setup step, or back to /me when editing. */
  next?: string;
  submitLabel?: string;
  departments: Department[];
  programs: Program[];
  initial: {
    departmentId: string;
    programId: string;
    batchYear: number | null;
    semester: number | null;
    section: string;
    shift: Shift | null;
  };
}) {
  const id = useId();
  const router = useRouter();
  const [departmentId, setDepartmentId] = useState(initial.departmentId);
  const [programId, setProgramId] = useState(initial.programId);
  const [batchYear, setBatchYear] = useState(initial.batchYear ? String(initial.batchYear) : "");
  const [semester, setSemester] = useState(initial.semester ? String(initial.semester) : "");
  // A section from before the fixed list can't be in the form; the database cleared those.
  const [section, setSection] = useState<Section>(
    SECTIONS.find((s) => s.value === initial.section)?.value ?? "",
  );
  const [shift, setShift] = useState<Shift | null>(initial.shift);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<string | null>(null);

  const faculties = useMemo(() => {
    const groups = new Map<string, Department[]>();
    for (const d of departments) {
      const key = d.faculty ?? "Other";
      groups.set(key, [...(groups.get(key) ?? []), d]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [departments]);

  const departmentPrograms = programs.filter((p) => p.department_id === departmentId);
  const program = programs.find((p) => p.id === programId);
  const years = batchYears();
  const locked = mode === "locked";
  if (initial.batchYear && !years.includes(initial.batchYear)) years.push(initial.batchYear);

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(undefined);
    if (!departmentId) return setError("Choose your department");
    if (!programId) return setError("Choose your program");
    if (!batchYear) return setError("Choose your session");
    if (!semester) return setError("Choose your semester");
    if (!shift) return setError("Choose your shift");
    if (mode === "proof" && !file) return setFileError("Add a photo of your proof.");

    const values = {
      departmentId,
      programId,
      batchYear: Number(batchYear),
      semester: Number(semester),
      section,
      shift,
    };
    try {
      setStatus("Saving…");
      const result =
        mode === "proof"
          ? await requestStudiesChange({
              ...values,
              docPath: await uploadDoc(file!, createStudiesProofUpload, setStatus),
            })
          : await saveAcademic(values);
      if (!result.ok) throw new Error(result.error);
      router.push(next);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <Field id={`${id}-dept`} label="Department">
        {(aria) => (
          <NativeSelect
            {...aria}
            value={departmentId}
            disabled={locked}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setProgramId("");
              setSemester("");
            }}
          >
            <option value="" disabled>
              Choose your department
            </option>
            {faculties.map(([faculty, list]) => (
              <optgroup key={faculty} label={faculty.replace(/^Faculty of /, "")}>
                {list.map((d) => (
                  <option key={d.id} value={d.id}>
                    {departmentShortName(d.name)}
                  </option>
                ))}
              </optgroup>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field id={`${id}-program`} label="Program">
        {(aria) => (
          <NativeSelect
            {...aria}
            value={programId}
            disabled={!departmentId}
            onChange={(e) => {
              setProgramId(e.target.value);
              setSemester("");
            }}
          >
            <option value="" disabled>
              {departmentId ? "Choose your program" : "Choose a department first"}
            </option>
            {departmentPrograms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id={`${id}-batch`} label="Session (year you joined)">
          {(aria) => (
            <NativeSelect
              {...aria}
              value={batchYear}
              disabled={locked}
              onChange={(e) => setBatchYear(e.target.value)}
            >
              <option value="" disabled>
                Year
              </option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {program
                    ? `${y}–${String(y + Math.ceil(program.duration_semesters / 2)).slice(2)}`
                    : y}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field id={`${id}-semester`} label="Semester">
          {(aria) => (
            <NativeSelect
              {...aria}
              value={semester}
              disabled={!program}
              onChange={(e) => setSemester(e.target.value)}
            >
              <option value="" disabled>
                {program ? "Semester" : "—"}
              </option>
              {Array.from({ length: program?.duration_semesters ?? 0 }, (_, i) => i + 1).map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ),
              )}
            </NativeSelect>
          )}
        </Field>
      </div>

      <Field id={`${id}-section`} label="Section (optional)">
        {(aria) => (
          <NativeSelect
            {...aria}
            value={section}
            disabled={locked && !!initial.section}
            onChange={(e) => setSection(e.target.value as Section)}
          >
            <option value="">No section</option>
            {SECTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold">Shift</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Shift">
          {SHIFTS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={shift === s.value}
              disabled={locked && !!initial.shift}
              onClick={() => setShift(s.value)}
              className={cn(
                "h-12 rounded-pill border text-sm font-semibold transition-colors disabled:opacity-60",
                shift === s.value
                  ? "border-accent bg-tint text-tint-text"
                  : "border-sep text-label hover:bg-raised",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>

      {mode === "proof" && (
        <fieldset className="grid gap-3">
          <legend className="mb-1.5 text-sm font-semibold">Your proof</legend>
          <p className="text-[13px] text-sec">
            Any one of: student card, fee challan, admission or transfer letter, or a screenshot of
            the student portal. It must show your name and these new details.
          </p>
          <DocPicker
            file={file}
            onFile={(f) => {
              setFileError(undefined);
              setFile(f);
            }}
            onError={setFileError}
            error={fileError}
            alt="Your proof"
          />
          <p className="flex gap-2 rounded-field bg-raised p-3 text-[13px] text-sec">
            <ShieldCheck className="size-4 shrink-0 text-tint-text" />
            Only a verifier sees your document. It&apos;s deleted 30 days after review.
          </p>
        </fieldset>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button type="submit" block disabled={status !== null}>
        {status ?? submitLabel}
      </Button>
    </form>
  );
}
