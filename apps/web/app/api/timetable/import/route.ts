import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse, type NextRequest } from "next/server";
import { MODEL, aiEnabled, aiFake, claude, fileBlock } from "@/lib/ai/claude.server";
import {
  TIMETABLE_SYSTEM,
  timetableSchema,
  toDrafts,
  type Draft,
  type ReadTimetable,
} from "@/lib/ai/timetable";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
// Under Vercel's 4.5 MB request limit.
const MAX_BYTES = 4 * 1024 * 1024;

const json = (status: number, error: string) => NextResponse.json({ error }, { status });

/** A read that fails or finds nothing doesn't count toward the 10 a day. */
const refund = (userId: string) =>
  createAdminClient().rpc("refund_ai", { p_user: userId, p_kind: "timetable" });

/**
 * Phase 7 task 6: read a timetable screenshot into classes for the student to check.
 * Nothing is saved here; the student confirms first. 10 reads a day.
 */
export async function POST(request: NextRequest) {
  if (!aiEnabled()) return json(503, "Reading timetables isn't switched on yet.");
  const { supabase, user } = await getSession();
  if (!user) return json(401, "Your session expired. Log in again.");

  const image = (await request.formData().catch(() => null))?.get("image");
  if (!(image instanceof File) || !TYPES.has(image.type)) {
    return json(400, "Upload a JPG, PNG or WebP screenshot.");
  }
  if (image.size > MAX_BYTES) return json(400, "That image is over 4 MB. Try a screenshot.");

  const { error: quotaError } = await supabase.rpc("use_ai", { p_kind: "timetable" });
  if (quotaError) {
    return json(
      quotaError.code === "54000" ? 429 : 400,
      quotaError.code === "54000" ? quotaError.message : "Couldn't start. Try again.",
    );
  }

  let read: ReadTimetable;
  try {
    if (aiFake()) {
      read = {
        classes: [
          {
            day: "Monday",
            start: "8:30",
            end: "10:00",
            course_code: null,
            course_title: "Calculus",
            room: "Room 12",
          },
          {
            day: "Wednesday",
            start: "11:00",
            end: "12:30",
            course_code: null,
            course_title: "Physics lab",
            room: null,
          },
        ],
      };
    } else {
      const response = await claude().messages.parse({
        model: MODEL,
        max_tokens: 8000,
        output_config: { effort: "low", format: zodOutputFormat(timetableSchema) },
        system: TIMETABLE_SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              fileBlock(Buffer.from(await image.arrayBuffer()), image.type),
              { type: "text", text: "Read this timetable." },
            ],
          },
        ],
      });
      if (!response.parsed_output) throw new Error(`no timetable (${response.stop_reason})`);
      read = response.parsed_output;
    }
  } catch (error) {
    console.error("[timetable] read failed", error instanceof Error ? error.message : error);
    await refund(user.id);
    return json(502, "Couldn't read that timetable. Try a clearer screenshot.");
  }

  const { data: courses } = await supabase.rpc("my_courses");
  const classes: Draft[] = toDrafts(read, courses ?? []);
  if (!classes.length) {
    await refund(user.id);
    return json(422, "We couldn't find any classes in that image.");
  }
  return NextResponse.json({ classes });
}
