"use server";

import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { DAYS, freeWindows, type Window } from "@/lib/academics";
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
  return s.user ? { supabase: s.supabase, user: s.user } : null;
}

const slotSchema = z
  .object({
    id: z.uuid().optional(),
    day: z.number().int().min(0).max(6),
    start: z.number().int().min(0).max(1439),
    end: z.number().int().min(1).max(1440),
    label: z.string().trim().min(1, "Name the class").max(60),
    room: z.string().trim().max(40).optional(),
    course: z.uuid().optional(),
  })
  .refine((s) => s.start < s.end, "The class has to end after it starts");

/** Phase 6 task 5: add or change a class in your timetable (this term). */
export async function saveSlot(input: z.input<typeof slotSchema>): Promise<ActionResult> {
  const parsed = slotSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the class");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data: term } = await s.supabase.rpc("current_term");
  const v = parsed.data;
  const row = {
    user_id: s.user.id,
    term: term ?? "",
    day: v.day,
    start_min: v.start,
    end_min: v.end,
    label: v.label,
    room: v.room || null,
    course_id: v.course ?? null,
  };
  const { error } = v.id
    ? await s.supabase.from("timetable_slots").update(row).eq("id", v.id)
    : await s.supabase.from("timetable_slots").insert(row);
  if (error) return fail("Couldn't save the class. Try again.");
  return { ok: true, data: undefined };
}

export async function deleteSlot(slot: string): Promise<ActionResult> {
  if (!id.safeParse(slot).success) return fail("Class not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.from("timetable_slots").delete().eq("id", slot);
  if (error) return fail("Couldn't delete. Try again.");
  return { ok: true, data: undefined };
}

export type DayWindows = { day: string; windows: Window[] };

/**
 * Phase 6 task 6: common free time, Monday to Saturday, for you and the chosen connections.
 * The database returns only busy times of connections who share them.
 */
export async function freeTogether(people: string[]): Promise<ActionResult<DayWindows[]>> {
  const ids = z.array(z.uuid()).min(1, "Pick at least one person").max(10).safeParse(people);
  if (!ids.success) return fail(ids.error.issues[0]?.message ?? "Pick people");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data, error } = await s.supabase.rpc("busy_slots", { p_users: [s.user.id, ...ids.data] });
  if (error) return fail("Couldn't work out free time. Try again.");
  const busy = data ?? [];
  return {
    ok: true,
    data: DAYS.slice(0, 6).map((day, i) => ({ day, windows: freeWindows(busy, i) })),
  };
}

/** "I'm on campus" for a few hours (0 to clear). */
export async function setOnCampus(hours: number): Promise<ActionResult<string | null>> {
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data, error } = await s.supabase.rpc("set_on_campus", { p_hours: Math.round(hours) });
  if (error) return fail("Couldn't update. Try again.");
  return { ok: true, data: data ?? null };
}

/** Appear in "Who's free now" (when on campus and not in class). */
export async function setShowFreeNow(on: boolean): Promise<ActionResult> {
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase
    .from("privacy_settings")
    .update({ show_free_now: on })
    .eq("user_id", s.user.id);
  if (error) return fail("Couldn't update. Try again.");
  return { ok: true, data: undefined };
}

/** Phase 6 task 7: "You free?" — a 2-hour chat. */
export async function sendPing(target: string): Promise<ActionResult<string>> {
  if (!id.safeParse(target).success) return fail("Student not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data, error } = await s.supabase.rpc("send_ping", { p_target: target });
  if (error || !data) return fail(friendly(error, "Couldn't ping. Try again."));
  return { ok: true, data };
}

/** Phase 6 task 8: mentoring. */
export async function setMentor(on: boolean): Promise<ActionResult> {
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("set_mentor", { p_on: on });
  if (error) return fail(friendly(error, "Couldn't update. Try again."));
  return { ok: true, data: undefined };
}

export async function requestMentor(mentor: string, message?: string): Promise<ActionResult> {
  if (!id.safeParse(mentor).success) return fail("Mentor not found");
  if (message && message.length > 300) return fail("Keep it under 300 characters");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("request_mentor", {
    p_mentor: mentor,
    p_message: message?.trim() || undefined,
  });
  if (error) return fail(friendly(error, "Couldn't send the request. Try again."));
  return { ok: true, data: undefined };
}

export async function respondMentorship(mentee: string, accept: boolean): Promise<ActionResult> {
  if (!id.safeParse(mentee).success) return fail("Request not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("respond_mentorship", {
    p_mentee: mentee,
    p_accept: accept,
  });
  if (error) return fail(friendly(error, "Couldn't answer. Try again."));
  return { ok: true, data: undefined };
}
