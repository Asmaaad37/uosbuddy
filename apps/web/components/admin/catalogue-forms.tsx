"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteCourse, saveCourse, saveDepartment, saveProgram } from "@/actions/trust";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { toast } from "@/components/ui/toast";

const LEVELS = [
  ["bs", "BS"],
  ["bs_5th_semester", "BS (5th semester intake)"],
  ["associate", "Associate"],
  ["ms_mphil", "MS / MPhil"],
  ["phd", "PhD"],
  ["other", "Other"],
] as const;
type Level = (typeof LEVELS)[number][0];

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    done: string,
    after?: () => void,
  ) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "Something went wrong");
      toast.success(done);
      after?.();
      router.refresh();
    });
  return { pending, run };
}

export type Dept = {
  id: string;
  name: string;
  short_code: string;
  faculty: string | null;
  aliases: string[];
};

/** Add (no `dept`) or edit a department. */
export function DepartmentForm({ dept }: { dept?: Dept }) {
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(dept?.name ?? "");
  const [code, setCode] = useState(dept?.short_code ?? "");
  const [faculty, setFaculty] = useState(dept?.faculty ?? "");
  const [aliases, setAliases] = useState(dept?.aliases.join(", ") ?? "");
  if (!open) {
    return (
      <Button size="sm" variant={dept ? "ghost" : "secondary"} onClick={() => setOpen(true)}>
        {dept ? <Pencil /> : <Plus />} {dept ? "Edit" : "Add a department"}
      </Button>
    );
  }
  return (
    <form
      className="grid w-full gap-2 rounded-md border border-line p-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            saveDepartment({
              id: dept?.id,
              name,
              shortCode: code,
              faculty: faculty || undefined,
              aliases: aliases
                .split(",")
                .map((a) => a.trim())
                .filter(Boolean),
            }),
          "Department saved",
          () => setOpen(false),
        );
      }}
    >
      <Input
        aria-label="Department name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Computer Science"
      />
      <Input
        aria-label="Short code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="CS"
      />
      <Input
        aria-label="Faculty"
        value={faculty}
        onChange={(e) => setFaculty(e.target.value)}
        placeholder="Faculty of Computing"
      />
      <Input
        aria-label="Other names (comma-separated)"
        value={aliases}
        onChange={(e) => setAliases(e.target.value)}
        placeholder="Other names, comma-separated"
      />
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export type Prog = { id: string; name: string; level: Level; duration_semesters: number };

/** Add or edit a program within a department. */
export function ProgramForm({ department, program }: { department: string; program?: Prog }) {
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(program?.name ?? "");
  const [level, setLevel] = useState<Level>(program?.level ?? "bs");
  const [semesters, setSemesters] = useState(program?.duration_semesters ?? 8);
  if (!open) {
    return (
      <button
        type="button"
        className="text-xs font-semibold text-brand"
        onClick={() => setOpen(true)}
        aria-label={program ? `Edit ${program.name}` : "Add a program"}
      >
        {program ? "Edit" : "+ Add a program"}
      </button>
    );
  }
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => saveProgram({ id: program?.id, department, name, level, semesters }),
          "Program saved",
          () => setOpen(false),
        );
      }}
    >
      <Input
        aria-label="Program name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="min-w-48 flex-1"
      />
      <NativeSelect
        aria-label="Level"
        value={level}
        onChange={(e) => setLevel(e.target.value as Level)}
        className="w-auto"
      >
        {LEVELS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </NativeSelect>
      <Input
        aria-label="Semesters"
        type="number"
        min={1}
        max={12}
        value={semesters}
        onChange={(e) => setSemesters(Number(e.target.value))}
        className="w-20"
      />
      <Button type="submit" size="sm" disabled={pending}>
        Save
      </Button>
    </form>
  );
}

/** Rename a course, or delete a duplicate. */
export function CourseRow({
  course,
}: {
  course: { id: string; code: string; title: string; department: string };
}) {
  const { pending, run } = useRun();
  const [code, setCode] = useState(course.code);
  const [title, setTitle] = useState(course.title);
  const changed = code !== course.code || title !== course.title;
  return (
    <li className="flex flex-wrap items-center gap-2 p-3">
      <Input
        aria-label="Course code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="w-28"
      />
      <Input
        aria-label="Course title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="min-w-40 flex-1"
      />
      <span className="text-xs text-ink-2">{course.department}</span>
      {changed && (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => saveCourse(course.id, code, title), "Course saved")}
        >
          Save
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Delete ${course.code}`}
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete ${course.code}? Its files, groups and enrolments go too.`)) {
            run(() => deleteCourse(course.id), "Course deleted");
          }
        }}
      >
        <Trash2 />
      </Button>
    </li>
  );
}
