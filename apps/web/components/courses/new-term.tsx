"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import { joinCourse } from "@/actions/courses";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

type LastCourse = { id: string; code: string; title: string };

/** C5: a new term starts with an empty list; offer last term's courses back in one tap. */
export function NewTermCourses({ courses }: { courses: LastCourse[] }) {
  const router = useRouter();
  const [added, setAdded] = useState<string[]>([]);
  const [busy, setBusy] = useState<string>();

  return (
    <section
      aria-labelledby="new-term"
      className="grid gap-3 rounded-card border border-accent/40 bg-tint p-4"
    >
      <div className="grid gap-1">
        <h2 id="new-term" className="text-headline">
          It&apos;s a new term
        </h2>
        <p className="text-sm text-sec">
          Your course list starts fresh each term. Still taking any of last term&apos;s?
        </p>
      </div>
      <ul className="grid gap-2">
        {courses.map((c) => {
          const done = added.includes(c.id);
          return (
            <li key={c.id} className="flex items-center gap-3 rounded-field bg-surface px-3 py-2">
              <span className="grid min-w-0 flex-1">
                <span className="font-semibold">{c.code}</span>
                <span className="truncate text-sm text-sec">{c.title}</span>
              </span>
              <Button
                size="sm"
                variant={done ? "quiet" : "tinted"}
                disabled={done || busy === c.id}
                onClick={async () => {
                  setBusy(c.id);
                  const r = await joinCourse(c.id);
                  setBusy(undefined);
                  if (!r.ok) return void toast.error(r.error);
                  setAdded((a) => [...a, c.id]);
                  router.refresh();
                }}
              >
                {busy === c.id ? <Loader2 className="animate-spin" /> : done ? <Check /> : <Plus />}{" "}
                {done ? "Added" : "Add"}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
