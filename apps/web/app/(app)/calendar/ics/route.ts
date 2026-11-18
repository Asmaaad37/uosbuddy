import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { KIND_LABEL } from "@/lib/calendar";
import { toIcsCalendar } from "@/lib/ics";

export const dynamic = "force-dynamic";

/** Phase 11.4: the published academic calendar as one .ics file for a phone's calendar. */
export async function GET() {
  const { supabase, user } = await getSession();
  if (!user) return new NextResponse("Log in first", { status: 401 });
  const { data: events } = await supabase
    .from("calendar_events")
    .select("id, kind, title, notes, starts_on, ends_on, tentative")
    .eq("status", "published")
    .order("starts_on");

  const ics = toIcsCalendar(
    "UoS academic calendar",
    (events ?? []).map((e) => ({
      id: e.id,
      title: e.tentative ? `${e.title} (tentative)` : e.title,
      description: [KIND_LABEL[e.kind] ?? e.kind, e.notes].filter(Boolean).join(". "),
      startsOn: e.starts_on,
      endsOn: e.ends_on,
    })),
    `${publicEnv.NEXT_PUBLIC_SITE_URL}/calendar`,
  );
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="uos-academic-calendar.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
