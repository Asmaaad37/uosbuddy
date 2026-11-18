import type { Json } from "@uosbuddy/shared";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { extractWords } from "@/lib/timetable/extract";
import { roomsFromLabels, timetableFromJson, toStageRows } from "@/lib/timetable/normalise";
import { PARSER_VERSION, parseTimetable, type Timetable } from "@/lib/timetable/parser";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Under Vercel's 4.5 MB request limit; department timetables are well under 1 MB.
const MAX_BYTES = 4 * 1024 * 1024;

const json = (status: number, error: string) => NextResponse.json({ error }, { status });

const form = z.object({
  department: z.uuid(),
  term: z.string().regex(/^[0-9]{4}-(fall|spring|summer)$/),
  week_of: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/**
 * Phase 11.1: a data editor uploads a department timetable (the PDF, or the parser's JSON).
 * It's parsed here, mapped to class groups, rooms and courses, and staged for review; nothing
 * is visible to students until the editor publishes it. The database checks the editor's rights.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getSession();
  if (!user) return json(401, "Your session expired. Log in again.");
  const data = await request.formData().catch(() => null);
  const fields = form.safeParse({
    department: data?.get("department"),
    term: data?.get("term"),
    week_of: data?.get("week_of") ?? "",
  });
  if (!fields.success) return json(400, "Choose a department and a term.");
  const { department, term, week_of } = fields.data;

  const { data: allowed } = await supabase.rpc("is_data_editor", {
    p_department: department,
    p_scope: "timetable",
  });
  if (!allowed) return json(403, "You can't import timetables for this department.");

  const file = data?.get("file");
  if (!(file instanceof File) || file.size === 0) return json(400, "Choose the timetable file.");
  if (file.size > MAX_BYTES) return json(400, "That file is over 4 MB.");
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const isJson = file.type === "application/json" || /\.json$/i.test(file.name);
  if (!isPdf && !isJson) return json(400, "Upload the timetable PDF, or the parser's JSON.");

  let timetable: Timetable | null = null;
  let parseReport: Record<string, unknown> = {};
  let roomLabels: string[] = [];
  if (isPdf) {
    try {
      const { timetable: parsed, report } = parseTimetable(
        await extractWords(new Uint8Array(await file.arrayBuffer())),
      );
      if (report.status === "failed") {
        return json(422, "No classes found. Is this the department's weekly timetable PDF?");
      }
      timetable = parsed;
      roomLabels = report.rooms.map((r) => r.room);
      parseReport = {
        status: report.status,
        summary: report.summary,
        warnings: report.warnings.slice(0, 50),
      };
    } catch {
      return json(422, "That PDF couldn't be read. Try downloading it again.");
    }
  } else {
    timetable = timetableFromJson(
      await file
        .text()
        .then(JSON.parse)
        .catch(() => null),
    );
    if (!timetable) return json(422, "That JSON isn't timetable-parser output.");
  }

  const { data: programs } = await supabase
    .from("programs")
    .select("id, name, level")
    .eq("department_id", department);
  const { rows, skipped } = toStageRows(timetable, programs ?? []);
  if (!rows.length) {
    return NextResponse.json(
      {
        error: "None of the classes matched this department's programs.",
        skipped: skipped.slice(0, 20),
      },
      { status: 422 },
    );
  }

  const { data: importId, error } = await supabase.rpc("stage_import", {
    p_department: department,
    p_term: term,
    // null = the term timetable (the usual case); the generated types don't mark it nullable.
    p_week_of: (week_of ?? null) as string,
    p_source_kind: isPdf ? "pdf" : "json",
    p_source_name: file.name.slice(0, 200),
    p_parser_version: PARSER_VERSION,
    p_report: { ...parseReport, rows: rows.length, skipped: skipped.slice(0, 200) },
    // Plain JSON: strings, numbers, booleans and the parser's own fields.
    p_rows: rows as unknown as Json,
  });
  if (error || !importId) {
    const known = ["42501", "22023", "54000"].includes(error?.code ?? "");
    return json(
      known ? 400 : 500,
      known ? error!.message : "Couldn't stage the import. Try again.",
    );
  }
  // The timetable's room list includes rooms with no classes; save those too (free rooms).
  if (roomLabels.length) {
    await supabase.rpc("seed_rooms", {
      p_department: department,
      p_rooms: roomsFromLabels(roomLabels) as unknown as Json,
    });
  }
  return NextResponse.json({ importId, rows: rows.length, skipped: skipped.length });
}
