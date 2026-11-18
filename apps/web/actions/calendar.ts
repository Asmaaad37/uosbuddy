"use server";

import { z } from "zod";
import { fail, friendly, session } from "@/lib/action-helpers.server";
import type { ActionResult } from "./onboarding";

const id = z.uuid();
const ok = { ok: true, data: undefined } as const;

/** Phase 11.4: remind me two days before this date (or stop). */
export async function setReminder(eventId: string, on: boolean): Promise<ActionResult> {
  if (!id.safeParse(eventId).success) return fail("Date not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = on
    ? await s.supabase.from("calendar_reminders").insert({ event_id: eventId })
    : await s.supabase.from("calendar_reminders").delete().eq("event_id", eventId);
  if (error && error.code !== "23505") return fail("Couldn't change the reminder. Try again.");
  return ok;
}

/** Reminders for every coming registration, add/drop, withdraw, exam and result date. */
export async function remindAllDeadlines(): Promise<ActionResult<number>> {
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data, error } = await s.supabase.rpc("remind_all_deadlines");
  if (error) return fail(friendly(error, "Couldn't set the reminders. Try again."));
  return { ok: true, data: data ?? 0 };
}

const KINDS = [
  "term",
  "registration",
  "add_drop",
  "withdraw",
  "midterm",
  "final",
  "result",
  "holiday",
  "break",
  "deadline",
  "other",
] as const;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const eventSchema = z
  .object({
    id: z.uuid().nullable(),
    term: z
      .string()
      .regex(/^[0-9]{4}-(fall|spring|summer)$/)
      .nullable(),
    kind: z.enum(KINDS),
    title: z.string().trim().min(3, "Give the date a title").max(140),
    notes: z.string().trim().max(400),
    starts_on: date,
    ends_on: date.nullable(),
    tentative: z.boolean(),
    source: z.string().trim().max(200),
    status: z.enum(["draft", "published"]),
  })
  .refine((e) => !e.ends_on || e.ends_on >= e.starts_on, "The end can't be before the start");
export type CalendarEventInput = z.input<typeof eventSchema>;

/** Editors: add or change a calendar date. Checked and audited in the database. */
export async function saveCalendarEvent(input: CalendarEventInput): Promise<ActionResult> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the date");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const e = parsed.data;
  // The generated types don't mark the nullable arguments as nullable.
  const { error } = await s.supabase.rpc("save_calendar_event", {
    p_id: e.id as string,
    p_term: e.term as string,
    p_kind: e.kind,
    p_title: e.title,
    p_notes: e.notes,
    p_starts_on: e.starts_on,
    p_ends_on: e.ends_on as string,
    p_tentative: e.tentative,
    p_source: e.source,
    p_status: e.status,
  });
  if (error) return fail(friendly(error, "Couldn't save. Try again."));
  return ok;
}

export async function deleteCalendarEvent(eventId: string): Promise<ActionResult> {
  if (!id.safeParse(eventId).success) return fail("Date not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("delete_calendar_event", { p_id: eventId });
  if (error) return fail(friendly(error, "Couldn't delete. Try again."));
  return ok;
}
