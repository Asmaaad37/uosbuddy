"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveTimetableReport } from "@/actions/official-timetable";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { DAYS, minToTime } from "@/lib/academics";

export type TimetableReport = {
  id: string;
  created_at: string;
  department: string | null;
  kind: string;
  note: string | null;
  seen: {
    course?: string;
    room?: string;
    teacher?: string | null;
    day?: number;
    start_min?: number;
  };
  reports: number;
};

const KIND: Record<string, string> = {
  room: "Room",
  time: "Time",
  teacher: "Teacher",
  cancelled: "Cancelled",
  closed: "Room closed",
  other: "Other",
};

/** Launch fix 4: the "Report wrong info" queue. Fixed or Dismiss closes every report on it. */
export function TimetableReports({ reports }: { reports: TimetableReport[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const close = (id: string, status: "fixed" | "dismissed") =>
    start(async () => {
      const r = await resolveTimetableReport(id, status);
      if (!r.ok) return void toast.error(r.error);
      toast.success(status === "fixed" ? "Marked fixed" : "Dismissed");
      router.refresh();
    });

  return (
    <ul className="divide-y divide-sep overflow-hidden rounded-card bg-surface shadow-card contrast-more:border contrast-more:border-label">
      {reports.map((r) => {
        const s = r.seen;
        const when =
          typeof s.day === "number" && typeof s.start_min === "number"
            ? `${DAYS[s.day]} ${minToTime(s.start_min)}`
            : null;
        return (
          <li key={r.id} className="grid gap-2 p-4">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{s.course ?? s.room ?? "Room"}</span>
              <Pill>{KIND[r.kind] ?? r.kind}</Pill>
              {r.reports > 1 && <Pill tone="outline">{r.reports} reports</Pill>}
            </span>
            <span className="text-sm text-sec">
              {[r.department, when, s.course ? s.room : null, s.teacher]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {r.note && <span className="text-sm">&ldquo;{r.note}&rdquo;</span>}
            <span className="flex gap-2">
              <Button
                size="sm"
                variant="tinted"
                disabled={pending}
                onClick={() => close(r.id, "fixed")}
              >
                Fixed
              </Button>
              <Button
                size="sm"
                variant="quiet"
                disabled={pending}
                onClick={() => close(r.id, "dismissed")}
              >
                Dismiss
              </Button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
