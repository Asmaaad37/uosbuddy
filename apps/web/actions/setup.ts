"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { withinLimit } from "@/lib/abuse.server";
import { getSession } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { OPENING_MOVES, SETUP_STEPS } from "@/lib/setup";
import { INVITE_COOKIE } from "@/lib/invites.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DOC_TYPES } from "@/lib/validation/onboarding";
import { handleSchema } from "@/lib/validation/handle";
import type { ActionResult } from "./onboarding";
import { fail } from "@/lib/action-helpers.server";

const done = { ok: true, data: undefined } as const;
const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Check the form";

const visibility = z.enum(["everyone", "department", "batch", "connections", "nobody"]);

/** The signed-in, verified student, or an error to show. */
async function verifiedSession() {
  const session = await getSession();
  if (!session.user || !session.profile) return { error: "Your session expired. Log in again." };
  if (session.profile.verification_status !== "verified") {
    return { error: "You need to be verified first." };
  }
  return { ...session, user: session.user, profile: session.profile };
}

/** The database explains refusals in plain words (22023/42501); anything else stays generic. */
function saved(error: { code?: string; message: string } | null): ActionResult {
  if (!error) return done;
  if (error.code === "23505") return fail("That handle was just taken. Try another.");
  if (error.code === "22023" || error.code === "42501") return fail(error.message);
  return fail("Couldn't save. Try again.");
}

// ---------------------------------------------------------------------------
// Screen 6: academic
// ---------------------------------------------------------------------------
const academicSchema = z.object({
  departmentId: z.uuid("Choose your department"),
  programId: z.uuid("Choose your program"),
  batchYear: z.coerce.number().int().min(1990).max(2100),
  semester: z.coerce.number().int().min(1, "Choose your semester").max(12),
  section: z.enum(["", "REG", "SS1", "SS2"], { message: "Choose REG, SS1 or SS2" }),
  shift: z.enum(["morning", "evening", "weekend"], { message: "Choose your shift" }),
});

export async function saveAcademic(input: z.input<typeof academicSchema>): Promise<ActionResult> {
  const parsed = academicSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const session = await verifiedSession();
  if ("error" in session) return fail(session.error!);
  const { departmentId, programId, batchYear, semester, section, shift } = parsed.data;

  const { error } = await session.supabase.rpc("save_my_academic", {
    p_department: departmentId,
    p_program: programId,
    p_batch: batchYear,
    p_semester: semester,
    p_section: section,
    p_shift: shift,
  });
  return saved(error);
}

/** Starts the upload of proof for a studies change. Same private bucket as verification. */
export async function createStudiesProofUpload(
  mimeType: string,
): Promise<ActionResult<{ path: string; token: string }>> {
  const session = await verifiedSession();
  if ("error" in session) return fail(session.error!);
  if (!(await withinLimit("proofUpload", session.user.id))) {
    return fail("Too many attempts. Wait a while and try again.");
  }
  const ext = DOC_TYPES[mimeType];
  if (!ext) return fail("Upload a JPG, PNG, WebP or PDF.");

  const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await createAdminClient()
    .storage.from("verification-docs")
    .createSignedUploadUrl(path);
  if (error || !data) return fail("Couldn't start the upload. Try again.");
  return { ok: true, data: { path: data.path, token: data.token } };
}

const studiesChangeSchema = academicSchema.extend({
  docPath: z.string().min(1, "Upload your proof"),
});

/** Asks an admin to change department, session, section or shift. The database checks it all. */
export async function requestStudiesChange(
  input: z.input<typeof studiesChangeSchema>,
): Promise<ActionResult> {
  const parsed = studiesChangeSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const session = await verifiedSession();
  if ("error" in session) return fail(session.error!);
  if (!(await withinLimit("proofSubmit", session.user.id))) {
    return fail("Too many attempts. Wait a while and try again.");
  }
  const { departmentId, programId, batchYear, semester, section, shift, docPath } = parsed.data;

  const { error } = await session.supabase.rpc("request_studies_change", {
    p_department: departmentId,
    p_program: programId,
    p_batch: batchYear,
    p_semester: semester,
    p_section: section,
    p_shift: shift,
    p_doc_path: docPath,
  });
  return saved(error);
}

// ---------------------------------------------------------------------------
// Screen 7: about you
// ---------------------------------------------------------------------------
const aboutSchema = z.object({
  handle: handleSchema,
  bio: z.string().trim().max(280, "Keep your bio under 280 characters"),
  hometown: z.string().trim().max(60, "Keep it under 60 characters"),
  residence: z.enum(["day_scholar", "hostelite", "other"], { message: "Choose one" }),
  avatarUrl: z.string().nullable(),
  photoVisibility: visibility,
});

export async function saveAbout(input: z.input<typeof aboutSchema>): Promise<ActionResult> {
  const parsed = aboutSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const session = await verifiedSession();
  if ("error" in session) return fail(session.error!);
  const { handle, bio, hometown, residence, avatarUrl, photoVisibility } = parsed.data;

  // Only a photo in the student's own avatars folder (uploaded by the cropper).
  const ownFolder = `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${session.user.id}/`;
  if (avatarUrl && !avatarUrl.startsWith(ownFolder)) return fail("Upload your photo again.");

  const { data: available } = await session.supabase.rpc("handle_available", { p_handle: handle });
  if (!available) return fail("That handle is taken. Try another.");

  const { error } = await session.supabase
    .from("privacy_settings")
    .update({ photo_visibility: photoVisibility })
    .eq("user_id", session.user.id);
  if (error) return fail("Couldn't save. Try again.");

  const { error: saveError } = await session.supabase.rpc("save_my_about", {
    p_handle: handle,
    p_bio: bio,
    p_hometown: hometown,
    p_residence: residence,
    p_avatar_url: avatarUrl as string,
  });
  const result = saved(saveError);
  if (result.ok) await removeOldAvatars(session, avatarUrl);
  return result;
}

/** Deletes the student's earlier photos, keeping both sizes of the current one. */
async function removeOldAvatars(
  session: Exclude<Awaited<ReturnType<typeof verifiedSession>>, { error: string }>,
  avatarUrl: string | null,
) {
  const folder = session.user.id;
  const bucket = session.supabase.storage.from("avatars");
  const { data: files } = await bucket.list(folder, { limit: 100 });
  // "{version}-512.webp" → keep everything starting with "{version}-".
  const keep = avatarUrl?.split("/").pop()?.split("-")[0];
  const stale = (files ?? [])
    .filter((f) => !keep || !f.name.startsWith(`${keep}-`))
    .map((f) => `${folder}/${f.name}`);
  // Best effort: a leftover file is harmless, so failures don't fail the save.
  if (stale.length) await bucket.remove(stale);
}

// ---------------------------------------------------------------------------
// Screen 8: interests and Opening Move
// ---------------------------------------------------------------------------
const interestsSchema = z
  .object({
    interestIds: z.array(z.uuid()).min(1, "Pick at least one interest").max(10, "Pick up to 10"),
    prompt: z.union([z.enum(OPENING_MOVES), z.literal("")]),
    answer: z.string().trim().max(200, "Keep your answer under 200 characters"),
  })
  .refine((d) => !d.prompt || d.answer.length > 0, {
    message: "Answer your Opening Move, or pick none",
    path: ["answer"],
  });

export async function saveInterests(input: z.input<typeof interestsSchema>): Promise<ActionResult> {
  const parsed = interestsSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const session = await verifiedSession();
  if ("error" in session) return fail(session.error!);
  const { interestIds, prompt, answer } = parsed.data;

  const { error } = await session.supabase.rpc("set_my_interests", {
    p_interest_ids: interestIds,
  });
  if (error) return fail(error.code === "22023" ? error.message : "Couldn't save. Try again.");

  const { error: moveError } = await session.supabase.rpc("save_my_opening_move", {
    p_prompt: prompt,
    p_answer: answer,
  });
  return saved(moveError);
}

// ---------------------------------------------------------------------------
// Screen 9: privacy
// ---------------------------------------------------------------------------
const privacySchema = z.object({
  profile_visibility: visibility,
  photo_visibility: visibility,
  allow_dms_from: visibility,
  show_hometown: z.boolean(),
  show_in_directory: z.boolean(),
  share_free_time: z.boolean(),
});

export async function savePrivacy(input: z.input<typeof privacySchema>): Promise<ActionResult> {
  const parsed = privacySchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const session = await verifiedSession();
  if ("error" in session) return fail(session.error!);

  const { error } = await session.supabase
    .from("privacy_settings")
    .update(parsed.data)
    .eq("user_id", session.user.id);
  if (error) return fail("Couldn't save. Try again.");
  const finishing = session.profile.onboarding_step < SETUP_STEPS.length;
  const { error: finishError } = await session.supabase.rpc("finish_setup");
  const result = saved(finishError);
  if (result.ok && finishing) await redeemInvite(session);
  return result;
}

/** Joined through someone's invite link: count it once setup is done (Phase 3 task 6). */
async function redeemInvite(
  session: Exclude<Awaited<ReturnType<typeof verifiedSession>>, { error: string }>,
) {
  const jar = await cookies();
  const code = jar.get(INVITE_COOKIE)?.value;
  if (!code) return;
  jar.delete(INVITE_COOKIE);
  // Best effort: a missing or stale code must never block finishing setup.
  await session.supabase.rpc("redeem_invite", { p_code: code });
}
