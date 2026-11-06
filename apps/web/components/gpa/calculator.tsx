"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cgpa, gpa, gradeFor, PASS_MARK } from "@/lib/gpa";
import { cn } from "@/lib/utils";

type Course = { id: string; name: string; credits: number; marks: string };
type Semester = { id: string; courses: Course[] };

const KEY = "uosb-gpa-v1";
const newCourse = (): Course => ({ id: crypto.randomUUID(), name: "", credits: 3, marks: "" });
const newSemester = (): Semester => ({ id: crypto.randomUUID(), courses: [newCourse()] });

const toResults = (s: Semester) =>
  s.courses.map((c) => ({
    credits: c.credits,
    marks: c.marks.trim() === "" ? null : Number(c.marks),
  }));

/**
 * Phase 6 task 9: GPA/CGPA with the UoS grading table. Saved only in this browser — grades
 * never leave the phone.
 */
export function GpaCalculator() {
  const [semesters, setSemesters] = useState<Semester[]>([newSemester()]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Semester[] | null;
      if (Array.isArray(saved) && saved.length) setSemesters(saved);
    } catch {
      // Private mode or bad data: start fresh.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(semesters));
    } catch {
      // Storage unavailable: the calculator still works for this visit.
    }
  }, [semesters, loaded]);

  const update = (sid: string, cid: string, patch: Partial<Course>) =>
    setSemesters((list) =>
      list.map((s) =>
        s.id === sid
          ? { ...s, courses: s.courses.map((c) => (c.id === cid ? { ...c, ...patch } : c)) }
          : s,
      ),
    );

  const overall = cgpa(semesters.map(toResults));

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 rounded-lg bg-ink p-5 text-bg">
        <div>
          <p className="text-sm text-bg/70">CGPA</p>
          <p className="text-large-title">{overall.gpa?.toFixed(2) ?? "–"}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-bg/70">Credit hours</p>
          <p className="text-large-title">{overall.credits}</p>
        </div>
      </div>

      {semesters.map((s, i) => {
        const result = gpa(toResults(s));
        return (
          <section
            key={s.id}
            aria-label={`Semester ${i + 1}`}
            className="grid gap-3 rounded-lg border border-line bg-surface p-4"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="font-bold">Semester {i + 1}</h2>
              <p className="text-sm">
                GPA <strong>{result.gpa?.toFixed(2) ?? "–"}</strong>
              </p>
            </div>
            <div className="grid grid-cols-[1fr_4.5rem_4.5rem_2.5rem_2rem] items-center gap-2 text-xs font-semibold text-ink-2">
              <span>Course</span>
              <span>Credits</span>
              <span>Marks</span>
              <span>Grade</span>
              <span />
            </div>
            {s.courses.map((c) => {
              const marks = c.marks.trim() === "" ? null : Number(c.marks);
              const grade = marks !== null && Number.isFinite(marks) ? gradeFor(marks) : null;
              return (
                <div key={c.id} className="grid gap-1">
                  <div className="grid grid-cols-[1fr_4.5rem_4.5rem_2.5rem_2rem] items-center gap-2">
                    <input
                      aria-label="Course"
                      value={c.name}
                      maxLength={40}
                      onChange={(e) => update(s.id, c.id, { name: e.target.value })}
                      placeholder="DSA"
                      className="h-10 min-w-0 rounded-md border border-line bg-bg px-2 text-sm"
                    />
                    <select
                      aria-label="Credit hours"
                      value={c.credits}
                      onChange={(e) => update(s.id, c.id, { credits: Number(e.target.value) })}
                      className="h-10 rounded-md border border-line bg-bg px-1 text-sm"
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label="Marks out of 100"
                      inputMode="numeric"
                      value={c.marks}
                      maxLength={3}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "");
                        update(s.id, c.id, {
                          marks: v === "" ? "" : String(Math.min(100, Number(v))),
                        });
                      }}
                      placeholder="0–100"
                      className="h-10 rounded-md border border-line bg-bg px-2 text-sm tabular-nums"
                    />
                    <span
                      className={cn(
                        "text-center text-sm font-bold",
                        grade && !grade.passed ? "text-danger" : "text-ink",
                      )}
                      aria-label={
                        grade
                          ? `Grade ${grade.letter}, ${grade.points.toFixed(2)} points`
                          : "No grade yet"
                      }
                    >
                      {grade?.letter ?? "–"}
                    </span>
                    <button
                      type="button"
                      aria-label="Remove course"
                      onClick={() =>
                        setSemesters((list) =>
                          list.map((x) =>
                            x.id === s.id
                              ? { ...x, courses: x.courses.filter((y) => y.id !== c.id) }
                              : x,
                          ),
                        )
                      }
                      className="grid size-8 place-items-center rounded-pill text-ink-2 hover:bg-surface-2"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {grade && (
                    <p className={cn("text-xs", grade.passed ? "text-ink-2" : "text-danger")}>
                      {grade.points.toFixed(2)} grade points
                      {!grade.passed && ` · below the ${PASS_MARK}% pass mark`}
                    </p>
                  )}
                </div>
              );
            })}
            <div className="flex justify-between">
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-semibold text-brand"
                onClick={() =>
                  setSemesters((list) =>
                    list.map((x) =>
                      x.id === s.id ? { ...x, courses: [...x.courses, newCourse()] } : x,
                    ),
                  )
                }
              >
                <Plus className="size-4" /> Add course
              </button>
              {semesters.length > 1 && (
                <button
                  type="button"
                  className="text-sm font-semibold text-ink-2"
                  onClick={() => setSemesters((list) => list.filter((x) => x.id !== s.id))}
                >
                  Remove semester
                </button>
              )}
            </div>
          </section>
        );
      })}

      <Button
        variant="secondary"
        block
        onClick={() => setSemesters((list) => [...list, newSemester()])}
      >
        <Plus /> Add a semester
      </Button>
      <p className="text-xs text-ink-2">
        Uses the University of Sargodha grading table: 80+ = A (4.00), 65–79 = B, 50–64 = C, 40–49 =
        D, below 40 = F. A course needs {PASS_MARK}% to pass in the semester system. Saved only on
        this device. Your official result is what counts.
      </p>
    </div>
  );
}
