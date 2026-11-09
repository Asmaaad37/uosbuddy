"use server";

import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/send.server";
import { renderExportEmail } from "@/lib/email/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "./onboarding";

const fail = (error: string) => ({ ok: false, error }) as const;
const id = z.uuid();
const ok = { ok: true, data: undefined } as const;

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

// ---------------------------------------------------------------------------
// Moderation (admins everywhere; moderators in their spaces). Audited in the database.
// ---------------------------------------------------------------------------
const targetTypes = z.enum(["post", "comment", "listing", "resource", "ride", "event"]);

export async function moderateContent(input: {
  type: string;
  id: string;
  action: "hide" | "restore";
  reason?: string;
}): Promise<ActionResult> {
  const type = targetTypes.safeParse(input.type);
  if (!type.success || !id.safeParse(input.id).success) return fail("Not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("moderate_content", {
    p_type: type.data,
    p_id: input.id,
    p_action: input.action,
    p_reason: input.reason?.trim().slice(0, 300) || undefined,
  });
  if (error) return fail(friendly(error, "Couldn't do that. Try again."));
  return ok;
}

export async function dismissReports(type: string, target: string): Promise<ActionResult> {
  if (!id.safeParse(target).success) return fail("Not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("dismiss_reports", { p_type: type, p_id: target });
  if (error) return fail(friendly(error, "Couldn't dismiss. Try again."));
  return ok;
}

export async function warnUser(user: string, message: string): Promise<ActionResult> {
  if (!id.safeParse(user).success) return fail("Student not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("warn_user", { p_user: user, p_message: message });
  if (error) return fail(friendly(error, "Couldn't send the warning. Try again."));
  return ok;
}

export async function setBanned(user: string, banned: boolean, reason = ""): Promise<ActionResult> {
  if (!id.safeParse(user).success) return fail("Student not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  if (banned && reason.trim().length < 3) return fail("Give a reason for the ban");
  const { error } = banned
    ? await s.supabase.rpc("ban_user", { p_user: user, p_reason: reason })
    : await s.supabase.rpc("unban_user", { p_user: user });
  if (error) return fail(friendly(error, "Couldn't update. Try again."));
  return ok;
}

export async function setModerator(user: string, spaces: string[]): Promise<ActionResult> {
  if (!id.safeParse(user).success) return fail("Student not found");
  if (!spaces.every((sp) => /^(campus|department:[0-9a-f-]{36})$/.test(sp))) {
    return fail("Pick the feeds they'll moderate");
  }
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("set_moderator", { p_user: user, p_spaces: spaces });
  if (error) return fail(friendly(error, "Couldn't update. Try again."));
  return ok;
}

/** Let a student correct their department or session one more time. */
export async function allowStudiesChange(user: string): Promise<ActionResult> {
  if (!id.safeParse(user).success) return fail("Student not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("allow_studies_change", { p_user: user });
  if (error) return fail(friendly(error, "Couldn't update. Try again."));
  return ok;
}

export async function setFlag(key: string, enabled: boolean): Promise<ActionResult> {
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("set_flag", { p_key: key, p_enabled: enabled });
  if (error) return fail(friendly(error, "Couldn't update the flag. Try again."));
  return ok;
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------
const departmentSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(3, "Name the department").max(120),
  shortCode: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .regex(/^[A-Za-z0-9&-]+$/, "Short code: letters, numbers, & or -"),
  faculty: z.string().trim().max(120).optional(),
  aliases: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
});

export async function saveDepartment(
  input: z.input<typeof departmentSchema>,
): Promise<ActionResult<string>> {
  const parsed = departmentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the department");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const v = parsed.data;
  const { data, error } = await s.supabase.rpc("save_department", {
    p_id: (v.id ?? null) as string,
    p_name: v.name,
    p_short_code: v.shortCode,
    p_faculty: v.faculty || undefined,
    p_aliases: v.aliases,
  });
  if (error || !data) {
    return fail(
      error?.code === "23505"
        ? "That short code is taken"
        : friendly(error, "Couldn't save. Try again."),
    );
  }
  return { ok: true, data };
}

const programSchema = z.object({
  id: z.uuid().optional(),
  department: z.uuid(),
  name: z.string().trim().min(3, "Name the program").max(160),
  level: z.enum(["associate", "bs", "bs_5th_semester", "ms_mphil", "phd", "other"]),
  semesters: z.number().int().min(1).max(12),
});

export async function saveProgram(input: z.input<typeof programSchema>): Promise<ActionResult> {
  const parsed = programSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the program");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const v = parsed.data;
  const { error } = await s.supabase.rpc("save_program", {
    p_id: (v.id ?? null) as string,
    p_department: v.department,
    p_name: v.name,
    p_level: v.level,
    p_semesters: v.semesters,
  });
  if (error) {
    return fail(
      error.code === "23505" ? "That program already exists" : friendly(error, "Couldn't save."),
    );
  }
  return ok;
}

export async function saveCourse(
  course: string,
  code: string,
  title: string,
): Promise<ActionResult> {
  if (!id.safeParse(course).success) return fail("Course not found");
  if (code.trim().length < 2 || title.trim().length < 2) return fail("Give a code and a title");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("save_course", {
    p_id: course,
    p_code: code.trim().slice(0, 20),
    p_title: title.trim().slice(0, 120),
  });
  if (error) {
    return fail(error.code === "23505" ? "That code is taken" : friendly(error, "Couldn't save."));
  }
  return ok;
}

export async function deleteCourse(course: string): Promise<ActionResult> {
  if (!id.safeParse(course).success) return fail("Course not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("delete_course", { p_id: course });
  if (error) return fail(friendly(error, "Couldn't delete. Try again."));
  return ok;
}

// ---------------------------------------------------------------------------
// Students: guidelines, digest, and Me → Data
// ---------------------------------------------------------------------------
export async function acceptGuidelines(): Promise<ActionResult> {
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("accept_guidelines");
  if (error) return fail("Couldn't save. Try again.");
  return ok;
}

/**
 * Phase 9 task 6: build the export in the database (as the student), store it privately
 * and email a 7-day link. Also returns the link so the page can offer it straight away.
 */
export async function exportMyData(): Promise<ActionResult<{ url: string; emailed: boolean }>> {
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const admin = createAdminClient();
  const { data: recent } = await admin
    .from("data_exports")
    .select("id")
    .eq("user_id", s.user.id)
    .gt("created_at", new Date(Date.now() - 24 * 3_600_000).toISOString())
    .limit(1);
  if (recent?.length) return fail("You already exported today. Check your email for the link.");

  const { data, error } = await s.supabase.rpc("export_my_data");
  if (error || !data) return fail("Couldn't build the export. Try again.");
  const path = `${s.user.id}/${crypto.randomUUID()}.json`;
  const { error: uploadError } = await admin.storage
    .from("data-exports")
    .upload(path, JSON.stringify(data, null, 2), { contentType: "application/json" });
  if (uploadError) return fail("Couldn't save the export. Try again.");
  await admin.from("data_exports").insert({ user_id: s.user.id, path });
  const { data: signed } = await admin.storage
    .from("data-exports")
    .createSignedUrl(path, 7 * 24 * 3600, { download: "uosbuddy-data.json" });
  if (!signed?.signedUrl) return fail("Couldn't make the download link. Try again.");

  const { data: pii } = await admin
    .from("private_profile")
    .select("personal_email, uni_email")
    .eq("user_id", s.user.id)
    .maybeSingle();
  const to = pii?.personal_email ?? pii?.uni_email ?? s.user.email;
  const emailed = to ? await sendEmail(to, renderExportEmail(signed.signedUrl)) : false;
  return { ok: true, data: { url: signed.signedUrl, emailed } };
}

export async function requestDeletion(confirm: string): Promise<ActionResult<string>> {
  if (confirm.trim().toUpperCase() !== "DELETE") return fail("Type DELETE to confirm");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data, error } = await s.supabase.rpc("request_account_deletion");
  if (error || !data) return fail("Couldn't start the deletion. Try again.");
  return { ok: true, data };
}

export async function cancelDeletion(): Promise<ActionResult> {
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("cancel_account_deletion");
  if (error) return fail(friendly(error, "Couldn't cancel. Try again."));
  return ok;
}
