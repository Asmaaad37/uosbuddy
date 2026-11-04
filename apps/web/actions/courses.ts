"use server";

import { after } from "next/server";
import { z } from "zod";
import { indexResource } from "@/lib/ai/index-resource.server";
import { getSession } from "@/lib/auth/session";
import type { ActionResult } from "./onboarding";

const fail = (error: string) => ({ ok: false, error }) as const;
const id = z.uuid();

function friendly(error: { code?: string; message: string } | null, fallback: string) {
  if (error && ["42501", "22023", "P0002", "54000"].includes(error.code ?? "")) {
    return error.message;
  }
  return fallback;
}

async function session() {
  const s = await getSession();
  return s.user ? { supabase: s.supabase, user: s.user, profile: s.profile } : null;
}

export type CourseHit = {
  id: string;
  code: string;
  title: string;
  department_id: string;
  department_code: string;
};

/** Phase 6 task 2: find courses by code or title, your department first. */
export async function searchCourses(query: string): Promise<CourseHit[]> {
  const q = query.trim();
  const s = await session();
  if (!s || q.length < 2) return [];
  const norm = q.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  // Commas and brackets would break the filter syntax; % and _ are matched literally.
  const escaped = q.replace(/[,()"]/g, " ").replace(/[%_\\]/g, (c) => `\\${c}`);
  const { data } = await s.supabase
    .from("courses")
    .select("id, code, title, department_id, departments!inner(short_code, university_id)")
    .eq("departments.university_id", s.profile?.university_id ?? "")
    .or(`code_norm.like.${norm}%,title.ilike.%${escaped}%`)
    .limit(20);
  return (data ?? [])
    .map((c) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      department_id: c.department_id,
      department_code: c.departments.short_code,
    }))
    .sort(
      (a, b) =>
        Number(b.department_id === s.profile?.department_id) -
          Number(a.department_id === s.profile?.department_id) || a.code.localeCompare(b.code),
    );
}

const addSchema = z.object({
  department: z.uuid("Choose a department"),
  code: z
    .string()
    .trim()
    .min(3, "Add the course code, like CS-301")
    .max(20, "Course codes are short, like CS-301. Put the name in Course title."),
  title: z.string().trim().max(120, "Keep the title under 120 characters").default(""),
  section: z.string().trim().max(10).optional(),
});

/** Adds a course (or finds the existing one) and joins it for this term. */
export async function addAndJoinCourse(
  input: z.input<typeof addSchema>,
): Promise<ActionResult<string>> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the course");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { department, code, title, section } = parsed.data;
  const { data: courseId, error } = await s.supabase.rpc("add_course", {
    p_department: department,
    p_code: code,
    p_title: title,
  });
  if (error || !courseId) return fail(friendly(error, "Couldn't add the course. Try again."));
  const joined = await joinCourse(courseId, section);
  return joined.ok ? { ok: true, data: courseId } : joined;
}

export async function joinCourse(course: string, section?: string): Promise<ActionResult> {
  if (!id.safeParse(course).success) return fail("Course not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("join_course", {
    p_course: course,
    p_section: section?.trim() || undefined,
  });
  if (error) return fail(friendly(error, "Couldn't join the course. Try again."));
  return { ok: true, data: undefined };
}

export async function leaveCourse(course: string): Promise<ActionResult> {
  if (!id.safeParse(course).success) return fail("Course not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("leave_course", { p_course: course });
  if (error) return fail("Couldn't leave the course. Try again.");
  return { ok: true, data: undefined };
}

export async function joinCourseChat(course: string): Promise<ActionResult<string>> {
  if (!id.safeParse(course).success) return fail("Course not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data, error } = await s.supabase.rpc("join_course_chat", { p_course: course });
  if (error || !data) return fail(friendly(error, "Couldn't open the course chat."));
  return { ok: true, data };
}

const resourceSchema = z.object({
  course: z.uuid(),
  kind: z.enum(["notes", "past_paper", "outline", "slides", "assignment"]),
  title: z.string().trim().min(3, "Give it a title").max(120),
  path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$/),
  mime: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  size: z
    .number()
    .int()
    .min(1)
    .max(10 * 1024 * 1024, "Files are up to 10 MB"),
  year: z.number().int().min(2000).max(2100).optional(),
  teacher: z.string().trim().max(80).optional(),
});

/** Phase 6 task 3: share a file with the course (already uploaded to its folder). */
export async function addResource(
  input: z.input<typeof resourceSchema>,
): Promise<ActionResult<string>> {
  const parsed = resourceSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the file");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const r = parsed.data;
  const { data, error } = await s.supabase.rpc("add_resource", {
    p_course: r.course,
    p_kind: r.kind,
    p_title: r.title,
    p_path: r.path,
    p_mime: r.mime,
    p_size: r.size,
    p_year: r.year,
    p_teacher: r.teacher,
  });
  if (error || !data) return fail(friendly(error, "Couldn't share the file. Try again."));
  // Index it for AI Buddy after responding: the upload shouldn't wait for it.
  const {
    data: { session: auth },
  } = await s.supabase.auth.getSession();
  if (auth?.access_token) after(() => indexResource(data, auth.access_token));
  return { ok: true, data };
}

export async function voteResource(resource: string, up: boolean): Promise<ActionResult<number>> {
  if (!id.safeParse(resource).success) return fail("File not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data, error } = await s.supabase.rpc("vote_resource", { p_resource: resource, p_up: up });
  if (error) return fail(friendly(error, "Couldn't vote. Try again."));
  return { ok: true, data: data ?? 0 };
}

export async function deleteResource(resource: string): Promise<ActionResult> {
  if (!id.safeParse(resource).success) return fail("File not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("delete_resource", { p_resource: resource });
  if (error) return fail("Couldn't delete. Try again.");
  return { ok: true, data: undefined };
}

const groupSchema = z.object({
  course: z.uuid(),
  title: z.string().trim().min(3, "Name the group").max(60),
  meets: z.string().trim().max(80).optional(),
  max: z.number().int().min(2).max(12),
});

export async function createStudyGroup(
  input: z.input<typeof groupSchema>,
): Promise<ActionResult<string>> {
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the group");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { course, title, meets, max } = parsed.data;
  const { data, error } = await s.supabase.rpc("create_study_group", {
    p_course: course,
    p_title: title,
    p_meets: meets,
    p_max: max,
  });
  if (error || !data) return fail(friendly(error, "Couldn't create the group. Try again."));
  return { ok: true, data };
}

export async function joinStudyGroup(group: string): Promise<ActionResult<string>> {
  if (!id.safeParse(group).success) return fail("Group not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data, error } = await s.supabase.rpc("join_study_group", { p_group: group });
  if (error || !data) return fail(friendly(error, "Couldn't join the group. Try again."));
  return { ok: true, data };
}
