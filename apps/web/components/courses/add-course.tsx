"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search } from "lucide-react";
import { addAndJoinCourse, joinCourse, searchCourses, type CourseHit } from "@/actions/courses";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type Department = { id: string; short_code: string; name: string };

/**
 * Phase 6 task 2: find a course and join it for this term. If nobody has added it yet,
 * the student adds it (code + title) and everyone after them finds it.
 */
export function AddCourse({
  departments,
  myDepartment,
}: {
  departments: Department[];
  myDepartment: string | null;
}) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CourseHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [department, setDepartment] = useState(myDepartment ?? "");
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (query.trim().length < 2) return setHits([]);
    setSearching(true);
    const timer = setTimeout(async () => {
      setHits(await searchCourses(query));
      setSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  async function join(course: string) {
    setBusy(course);
    const r = await joinCourse(course);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setOpen(false);
    router.push(`/courses/${course}`);
  }

  async function add(e: { preventDefault(): void }) {
    e.preventDefault();
    setBusy("add");
    const r = await addAndJoinCourse({ department, code, title });
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setOpen(false);
    router.push(`/courses/${r.data}`);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button block>
          <Plus /> Add a course
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="text-xl font-bold">Add a course</SheetTitle>
        <SheetDescription className="mb-4 text-sm text-ink-2">
          Search by code or name. If it isn&apos;t here yet, add it for everyone.
        </SheetDescription>
        {!adding ? (
          <div className="grid gap-3">
            <label className="relative">
              <span className="sr-only">Search courses</span>
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-2" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="CS-301 or Data Structures"
                className="pl-10"
                autoFocus
              />
            </label>
            {searching && <Loader2 className="mx-auto size-5 animate-spin text-ink-2" />}
            {hits.length > 0 && (
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
                {hits.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="grid min-w-0 flex-1">
                      <span className="font-semibold">{c.code}</span>
                      <span className="truncate text-sm text-ink-2">
                        {c.title} · {c.department_code}
                      </span>
                    </span>
                    <Button size="sm" onClick={() => join(c.id)} disabled={!!busy}>
                      {busy === c.id && <Loader2 className="animate-spin" />} Join
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim().length >= 2 && !searching && (
              <button
                type="button"
                className="justify-self-start text-sm font-semibold text-brand"
                onClick={() => {
                  setAdding(true);
                  setCode(query.trim());
                  setError(undefined);
                }}
              >
                Can&apos;t find it? Add it
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={add} className="grid gap-4" noValidate>
            <Field id={`${id}-dept`} label="Department">
              {(aria) => (
                <NativeSelect
                  {...aria}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option value="">Choose…</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.short_code} · {d.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field id={`${id}-code`} label="Course code" hint="As on your timetable, like CS-301">
              {(aria) => (
                <Input
                  {...aria}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={20}
                />
              )}
            </Field>
            <Field id={`${id}-title`} label="Course title">
              {(aria) => (
                <Input
                  {...aria}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder="Data Structures"
                />
              )}
            </Field>
            {error && (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setAdding(false)}
              >
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={busy === "add"}>
                {busy === "add" && <Loader2 className="animate-spin" />} Add and join
              </Button>
            </div>
          </form>
        )}
        {error && !adding && (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {error}
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
