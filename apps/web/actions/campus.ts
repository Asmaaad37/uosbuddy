"use server";

import { z } from "zod";
import { moderate } from "@/lib/ai/moderate.server";
import { getSession } from "@/lib/auth/session";
import { LISTING_KIND_KEYS } from "@/lib/campus";
import { GUIDELINES_REQUIRED } from "@/lib/guidelines";
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

// ---------------------------------------------------------------------------
// Rides (Phase 8 task 1)
// ---------------------------------------------------------------------------
const rideSchema = z.object({
  kind: z.enum(["offer", "request"]),
  from: z.string().trim().min(2, "Where from?").max(60),
  to: z.string().trim().min(2, "Where to?").max(60),
  departAt: z.iso.datetime({ message: "Pick a day and time" }),
  seats: z.number().int().min(1).max(8).default(1),
  recurring: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  womenOnly: z.boolean().default(false),
  notes: z.string().trim().max(300, "Keep notes under 300 characters").optional(),
});

export async function createRide(input: z.input<typeof rideSchema>): Promise<ActionResult<string>> {
  const parsed = rideSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the ride");
  const v = parsed.data;
  if (v.from.toLowerCase() === v.to.toLowerCase()) return fail("From and to are the same place");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data, error } = await s.supabase.rpc("create_ride", {
    p_kind: v.kind,
    p_from: v.from,
    p_to: v.to,
    p_depart: v.departAt,
    p_seats: v.seats,
    p_recurring: v.recurring,
    p_women_only: v.womenOnly,
    p_notes: v.notes,
  });
  if (error || !data) return fail(friendly(error, "Couldn't post the ride. Try again."));
  return { ok: true, data };
}

export async function requestSeat(ride: string, message?: string): Promise<ActionResult> {
  if (!id.safeParse(ride).success) return fail("Ride not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("request_seat", {
    p_ride: ride,
    p_message: message?.trim().slice(0, 200) || undefined,
  });
  if (error) return fail(friendly(error, "Couldn't send the request. Try again."));
  return { ok: true, data: undefined };
}

export async function respondSeat(
  request: string,
  accept: boolean,
): Promise<ActionResult<string | null>> {
  if (!id.safeParse(request).success) return fail("Request not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data, error } = await s.supabase.rpc("respond_seat", {
    p_request: request,
    p_accept: accept,
  });
  if (error) return fail(friendly(error, "Couldn't answer. Try again."));
  return { ok: true, data: data ?? null };
}

export async function cancelSeat(ride: string): Promise<ActionResult> {
  if (!id.safeParse(ride).success) return fail("Ride not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("cancel_seat", { p_ride: ride });
  if (error) return fail(friendly(error, "Couldn't cancel. Try again."));
  return { ok: true, data: undefined };
}

export async function cancelRide(ride: string): Promise<ActionResult> {
  if (!id.safeParse(ride).success) return fail("Ride not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("cancel_ride", { p_ride: ride });
  if (error) return fail(friendly(error, "Couldn't cancel the ride. Try again."));
  return { ok: true, data: undefined };
}

export type RideRequest = {
  id: string;
  message: string | null;
  status: string;
  handle: string;
  full_name: string;
  avatar_url: string | null;
};

export async function rideRequests(ride: string): Promise<ActionResult<RideRequest[]>> {
  if (!id.safeParse(ride).success) return fail("Ride not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { data, error } = await s.supabase.rpc("ride_requests_for", { p_ride: ride });
  if (error) return fail("Couldn't load the requests. Try again.");
  return { ok: true, data: data ?? [] };
}

/** Ask an admin to confirm women-only access (Privacy settings). */
export async function requestWomenOnly(note?: string): Promise<ActionResult> {
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("request_women_only", {
    p_note: note?.trim().slice(0, 200) || undefined,
  });
  if (error) return fail(friendly(error, "Couldn't send the request. Try again."));
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Market and lost-and-found (Phase 8 task 2)
// ---------------------------------------------------------------------------
const listingSchema = z
  .object({
    kind: z.enum(LISTING_KIND_KEYS),
    title: z.string().trim().min(3, "Give it a short title").max(80),
    description: z.string().trim().max(1000, "Keep it under 1,000 characters").default(""),
    price: z.number().int().min(0).max(10_000_000).optional(),
    media: z
      .array(z.string().regex(/^listings\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/))
      .max(4)
      .default([]),
    location: z.string().trim().max(80).optional(),
  })
  .refine((v) => v.price === undefined || v.kind === "sell" || v.kind === "buy", {
    message: "Only buying and selling have a price",
  });

export async function createListing(
  input: z.input<typeof listingSchema>,
): Promise<ActionResult<{ id: string; held: boolean }>> {
  const parsed = listingSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the listing");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  if (!s.profile?.guidelines_accepted_at) return fail(GUIDELINES_REQUIRED);
  const v = parsed.data;
  // The database checks the decision against exactly "title\ndescription".
  const check = await moderate(s.user.id, `${v.title}\n${v.description}`, false, "listing");
  if (!check.ok) return fail(check.error);
  const { data, error } = await s.supabase.rpc("create_listing", {
    p_kind: v.kind,
    p_title: v.title,
    p_description: v.description,
    p_price: v.price,
    p_media: v.media,
    p_location: v.location || undefined,
    ...check.params,
  });
  if (error || !data) return fail(friendly(error, "Couldn't post the listing. Try again."));
  return { ok: true, data: { id: data, held: check.held } };
}

export async function markListingDone(listing: string): Promise<ActionResult> {
  if (!id.safeParse(listing).success) return fail("Listing not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("mark_listing_done", { p_listing: listing });
  if (error) return fail(friendly(error, "Couldn't update it. Try again."));
  return { ok: true, data: undefined };
}

export async function deleteListing(listing: string): Promise<ActionResult> {
  if (!id.safeParse(listing).success) return fail("Listing not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("delete_listing", { p_listing: listing });
  if (error) return fail("Couldn't delete it. Try again.");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Societies and events (Phase 8 task 3)
// ---------------------------------------------------------------------------
const societySchema = z.object({
  name: z.string().trim().min(3, "Name the society").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, "Use 3–40 letters, numbers or dashes"),
  description: z.string().trim().max(1000).default(""),
  emoji: z.string().trim().max(8).optional(),
});

export async function createSociety(
  input: z.input<typeof societySchema>,
): Promise<ActionResult<string>> {
  const parsed = societySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the society");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const v = parsed.data;
  const { error } = await s.supabase.rpc("create_society", {
    p_name: v.name,
    p_slug: v.slug,
    p_description: v.description,
    p_emoji: v.emoji || undefined,
  });
  if (error) return fail(friendly(error, "Couldn't create the society. Try again."));
  return { ok: true, data: v.slug };
}

export async function setSocietyMembership(society: string, join: boolean): Promise<ActionResult> {
  if (!id.safeParse(society).success) return fail("Society not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = join
    ? await s.supabase.rpc("join_society", { p_society: society })
    : await s.supabase.rpc("leave_society", { p_society: society });
  if (error) return fail(friendly(error, "Couldn't update. Try again."));
  return { ok: true, data: undefined };
}

export async function setSocietyAdmin(
  society: string,
  user: string,
  admin: boolean,
): Promise<ActionResult> {
  if (!id.safeParse(society).success || !id.safeParse(user).success) return fail("Not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("set_society_admin", {
    p_society: society,
    p_user: user,
    p_admin: admin,
  });
  if (error) return fail(friendly(error, "Couldn't update. Try again."));
  return { ok: true, data: undefined };
}

const eventSchema = z
  .object({
    society: z.uuid().optional(),
    title: z.string().trim().min(3, "Name the event").max(100),
    description: z.string().trim().max(2000).default(""),
    startsAt: z.iso.datetime({ message: "Pick when it starts" }),
    endsAt: z.iso.datetime({ message: "Pick when it ends" }),
    venue: z.string().trim().min(2, "Where is it?").max(100),
    capacity: z.number().int().min(1).max(5000).optional(),
  })
  .refine((v) => v.endsAt > v.startsAt, { message: "It has to end after it starts" });

export async function createEvent(
  input: z.input<typeof eventSchema>,
): Promise<ActionResult<string>> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the event");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const v = parsed.data;
  const { data, error } = await s.supabase.rpc("create_event", {
    // Explicit null (campus-wide, admins only): an omitted argument wouldn't match the function.
    p_society: (v.society ?? null) as string,
    p_title: v.title,
    p_description: v.description,
    p_starts: v.startsAt,
    p_ends: v.endsAt,
    p_venue: v.venue,
    p_capacity: v.capacity,
  });
  if (error || !data) return fail(friendly(error, "Couldn't post the event. Try again."));
  return { ok: true, data };
}

export async function rsvpEvent(
  event: string,
  status: "going" | "interested" | null,
): Promise<ActionResult> {
  if (!id.safeParse(event).success) return fail("Event not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("rsvp_event", {
    p_event: event,
    p_status: (status ?? null) as string,
  });
  if (error) return fail(friendly(error, "Couldn't save that. Try again."));
  return { ok: true, data: undefined };
}

export async function cancelEvent(event: string): Promise<ActionResult> {
  if (!id.safeParse(event).success) return fail("Event not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("cancel_event", { p_event: event });
  if (error) return fail(friendly(error, "Couldn't cancel. Try again."));
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Admin: women-only access and society verification
// ---------------------------------------------------------------------------
export async function decideWomenOnly(user: string, approve: boolean): Promise<ActionResult> {
  if (!id.safeParse(user).success) return fail("Student not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("decide_women_only", { p_user: user, p_approve: approve });
  if (error) return fail(friendly(error, "Couldn't save the decision. Try again."));
  return { ok: true, data: undefined };
}

export async function verifySociety(society: string, verified: boolean): Promise<ActionResult> {
  if (!id.safeParse(society).success) return fail("Society not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("verify_society", {
    p_society: society,
    p_verified: verified,
  });
  if (error) return fail(friendly(error, "Couldn't save the decision. Try again."));
  return { ok: true, data: undefined };
}
