"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { OPENING_MOVES, SETUP_STEPS, stepNumber, type SetupStep } from "@/lib/setup";
import { INVITE_COOKIE } from "@/lib/invites.server";
import { handleSchema } from "@/lib/validation/handle";
import type { ActionResult } from "./onboarding";

const fail = (error: string) => ({ ok: false, error }) as const;
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

/** Saves a step's profile fields and records the step as done (never moves backwards). */
async function saveStep(
  session: Exclude<Awaited<ReturnType<typeof verifiedSession>>, { error: string }>,
  step: SetupStep,
  fields: Record<string, unknown>,
): Promise<ActionResult> {
  const { error } = await session.supabase
    .from("profiles")
    .update({
      ...fields,
      onboarding_step: Math.max(session.profile.onboarding_step, stepNumber(step)),
    })
    .eq("id", session.user.id);
  if (!error) return done;
  if (error.code === "23505") return fail("That handle was just taken. Try another.");
  if (error.code === "22023") return fail(error.message);
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
  section: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{0,3}$/, "Use a short section name, like B or 2"),
  shift: z.enum(["morning", "evening", "weekend"], { message: "Choose your shift" }),
});

export async function saveAcademic(input: z.input<typeof academicSchema>): Promise<ActionResult> {
  const parsed = academicSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const session = await verifiedSession();
  if ("error" in session) return fail(session.error!);
  const { departmentId, programId, batchYear, semester, section, shift } = parsed.data;

  const { data: program } = await session.supabase
    .from("programs")
    .select("duration_semesters")
    .eq("id", programId)
    .maybeSingle();
  if (!program) return fail("Choose your program");
  if (semester > program.duration_semesters) {
    return fail(`That program has ${program.duration_semesters} semesters.`);
  }

  return saveStep(session, "academic", {
    department_id: departmentId,
    program_id: programId,
    batch_year: batchYear,
    semester,
    section: section || null,
    shift,
  });
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

  const result = await saveStep(session, "about", {
    handle,
    bio: bio || null,
    hometown_city: hometown || null,
    residence,
    avatar_url: avatarUrl,
  });
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

  return saveStep(session, "interests", {
    opening_move_prompt: prompt || null,
    opening_move: prompt ? answer : null,
  });
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
  const result = await saveStep(session, "privacy", {});
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
