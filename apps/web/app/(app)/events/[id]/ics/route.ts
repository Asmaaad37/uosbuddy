import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { toIcs } from "@/lib/ics";

export const dynamic = "force-dynamic";

/** Phase 8 task 3: "Add to calendar" for one event (only for students who can see it). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const { supabase, user } = await getSession();
  if (!user) return new NextResponse("Log in first", { status: 401 });
  const { data: e } = await supabase
    .from("events")
    .select("id, title, description, venue, starts_at, ends_at")
    .eq("id", id)
    .maybeSingle();
  if (!e) return new NextResponse("Not found", { status: 404 });

  const ics = toIcs({
    id: e.id,
    title: e.title,
    description: e.description,
    venue: e.venue,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/events`,
  });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="uosbuddy-event.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
