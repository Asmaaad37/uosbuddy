"use server";

import { z } from "zod";
import { fail, friendly, session } from "@/lib/action-helpers.server";
import type { ActionResult } from "./onboarding";

const id = z.uuid();

/**
 * Phase 11.1: a data editor reviews a staged timetable import, then publishes, discards or
 * restores. Every step is checked and audited in the database (is_data_editor).
 */
async function call(
  fn: "publish_import" | "discard_import" | "revert_import",
  importId: string,
  fallback: string,
): Promise<ActionResult> {
  if (!id.safeParse(importId).success) return fail("Import not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc(fn, { p_import: importId });
  if (error) return fail(friendly(error, fallback));
  return { ok: true, data: undefined };
}

export async function publishImport(importId: string) {
  return call("publish_import", importId, "Couldn't publish. Try again.");
}

export async function discardImport(importId: string) {
  return call("discard_import", importId, "Couldn't discard. Try again.");
}

/** Republishes a copy of an earlier import, so the change history stays honest. */
export async function restoreImport(importId: string) {
  return call("revert_import", importId, "Couldn't restore. Try again.");
}

export async function excludeEntry(entryId: string, excluded: boolean): Promise<ActionResult> {
  if (!id.safeParse(entryId).success) return fail("Class not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("exclude_entry", {
    p_entry: entryId,
    p_excluded: excluded,
  });
  if (error) return fail(friendly(error, "Couldn't change that class. Try again."));
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Phase 11.2: a student's week. Checked in the database (verified students only).
// ---------------------------------------------------------------------------

/** "My section is different": choose a class group, or null to go back to the profile. */
export async function setMyClassGroup(groupId: string | null): Promise<ActionResult> {
  if (groupId !== null && !id.safeParse(groupId).success) return fail("Choose a section");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("set_my_class_group", {
    // null = match my profile again; the generated types don't mark it nullable.
    p_group: groupId as string,
  });
  if (error) return fail(friendly(error, "Couldn't change your section. Try again."));
  return { ok: true, data: undefined };
}

/** The courses a section has this term, for "Add a class from another section". */
export async function sectionCourses(
  groupId: string,
): Promise<ActionResult<{ course_id: string; title: string; code: string | null }[]>> {
  if (!id.safeParse(groupId).success) return fail("Choose a section");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data, error } = await s.supabase
    .from("timetable_live")
    .select("course_id, course_title, course_code")
    .eq("class_group_id", groupId)
    .not("course_id", "is", null);
  if (error) return fail("Couldn't load that section. Try again.");
  const seen = new Map<string, { course_id: string; title: string; code: string | null }>();
  for (const c of data ?? []) {
    if (c.course_id && !seen.has(c.course_id)) {
      seen.set(c.course_id, {
        course_id: c.course_id,
        title: c.course_title ?? "",
        code: c.course_code,
      });
    }
  }
  return {
    ok: true,
    data: [...seen.values()].sort((a, b) => a.title.localeCompare(b.title)),
  };
}

/** Follow one course in another section (a repeat course or an elective). */
export async function followClass(groupId: string, courseId: string): Promise<ActionResult> {
  if (!id.safeParse(groupId).success || !id.safeParse(courseId).success) {
    return fail("Choose a class");
  }
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase
    .from("timetable_follows")
    .insert({ class_group_id: groupId, course_id: courseId });
  if (error && error.code !== "23505") return fail("Couldn't add that class. Try again.");
  return { ok: true, data: undefined };
}

export async function unfollowClass(followId: string): Promise<ActionResult> {
  if (!id.safeParse(followId).success) return fail("Class not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.from("timetable_follows").delete().eq("id", followId);
  if (error) return fail("Couldn't remove that class. Try again.");
  return { ok: true, data: undefined };
}
