"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { saveAcademic } from "@/actions/setup";
import { batchYears, departmentShortName } from "@/lib/setup";
import { cn } from "@/lib/utils";

type Department = { id: string; name: string; faculty: string | null; aliases: string[] };
type Program = { id: string; department_id: string; name: string; duration_semesters: number };
type Shift = "morning" | "evening" | "weekend";

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
}: {
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
  const [section, setSection] = useState(initial.section);
  const [shift, setShift] = useState<Shift | null>(initial.shift);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

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
  if (initial.batchYear && !years.includes(initial.batchYear)) years.push(initial.batchYear);

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(undefined);
    if (!departmentId) return setError("Choose your department");
    if (!programId) return setError("Choose your program");
    if (!batchYear) return setError("Choose your session");
    if (!semester) return setError("Choose your semester");
    if (!shift) return setError("Choose your shift");

    setBusy(true);
    const result = await saveAcademic({
      departmentId,
      programId,
      batchYear: Number(batchYear),
      semester: Number(semester),
      section,
      shift,
    });
    if (!result.ok) {
      setBusy(false);
      return setError(result.error);
    }
    router.push(next);
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <Field id={`${id}-dept`} label="Department">
        {(aria) => (
          <NativeSelect
            {...aria}
            value={departmentId}
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

      <Field
        id={`${id}-section`}
        label="Section (optional)"
        hint="Like A, B or 2. Leave empty if your class has no sections."
      >
        {(aria) => (
          <Input
            {...aria}
            value={section}
            onChange={(e) => setSection(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            maxLength={3}
            autoCapitalize="characters"
            className="w-28 text-center font-semibold"
          />
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
              onClick={() => setShift(s.value)}
              className={cn(
                "h-12 rounded-pill border text-sm font-semibold transition-colors",
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

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button type="submit" block disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
