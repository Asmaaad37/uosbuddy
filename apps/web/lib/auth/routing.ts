import type { Database } from "@uosbuddy/shared";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type RoutingProfile = Pick<Profile, "verification_status" | "onboarding_step" | "role"> &
  Partial<Pick<Profile, "banned_at" | "deleted_at">>;

/** Steps in /setup (Section 7, screens 6–9). Phase 2 advances onboarding_step to this. */
export const ONBOARDING_STEPS = 4;

/** Pages for signed-out visitors; signed-in users are sent to their home instead. */
const PUBLIC_ONLY = new Set([
  "/",
  "/login",
  "/forgot-password",
  "/start",
  "/start/campus",
  "/start/email",
  "/start/uni-email",
  "/start/freshman",
]);

/** Prefixes that need a session. Each verification state may use only some of them. */
const SIGNED_IN_PREFIXES = [
  "/pending",
  "/setup",
  "/explore",
  "/admin",
  "/me",
  "/people",
  "/chats",
  "/feed",
  "/backup",
  "/notifications",
  "/courses",
  "/timetable",
  "/mentors",
  "/gpa",
  "/buddy",
  "/rides",
  "/market",
  "/events",
  "/resources",
  "/start/freshman/proof",
  "/banned",
];

const ALLOWED: Record<Profile["verification_status"], string[]> = {
  verified: [
    "/setup",
    "/explore",
    "/admin",
    "/me",
    "/people",
    "/chats",
    "/feed",
    "/backup",
    "/notifications",
    "/courses",
    "/timetable",
    "/mentors",
    "/gpa",
    "/buddy",
    "/rides",
    "/market",
    "/events",
    "/resources",
  ],
  unverified: ["/start/freshman/proof"],
  pending: ["/pending", "/start/freshman/proof"],
  needs_info: ["/pending", "/start/freshman/proof"],
  rejected: ["/pending", "/start/freshman/proof"],
};

const matches = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/** Where a user belongs right now (Phase 1 task 8). `null` means signed out. */
export function homePath(profile: RoutingProfile | null): string {
  if (!profile) return "/";
  // Phase 9: a banned account sees only its notice; one awaiting deletion, its data page.
  if (profile.banned_at) return "/banned";
  if (profile.deleted_at) return "/me/data";
  switch (profile.verification_status) {
    case "verified":
      return profile.onboarding_step >= ONBOARDING_STEPS ? "/explore" : "/setup";
    case "unverified":
      return "/start/freshman/proof";
    default:
      return "/pending";
  }
}

/**
 * The redirect for a request, or `null` to let it through. A UX convenience only:
 * RLS and server-side checks are the security boundary.
 */
export function redirectFor(
  path: string,
  signedIn: boolean,
  profile: RoutingProfile | null,
): string | null {
  const target = decide(path, signedIn, profile);
  // Never redirect to the page being requested (e.g. signed in but the profile row is missing).
  return target === path ? null : target;
}

function decide(path: string, signedIn: boolean, profile: RoutingProfile | null): string | null {
  const needsSession = SIGNED_IN_PREFIXES.some((p) => matches(path, p));

  if (!signedIn) return needsSession ? `/login?next=${encodeURIComponent(path)}` : null;
  if (PUBLIC_ONLY.has(path)) return homePath(profile);
  if (!needsSession) return null;
  if (!profile) return "/";

  if (profile.banned_at) return matches(path, "/banned") ? null : "/banned";
  if (profile.deleted_at) return matches(path, "/me/data") ? null : "/me/data";
  if (matches(path, "/banned")) return homePath(profile);
  const allowed = ALLOWED[profile.verification_status].some((p) => matches(path, p));
  if (!allowed) return homePath(profile);
  // Student moderators may use the reports queue; the rest of /admin is for admins.
  const staffPath = matches(path, "/admin/reports") && profile.role === "moderator";
  if (matches(path, "/admin") && profile.role !== "admin" && !staffPath) return homePath(profile);
  return null;
}

/** Whether the middleware needs the profile to decide this request. */
export function needsProfile(path: string) {
  return PUBLIC_ONLY.has(path) || SIGNED_IN_PREFIXES.some((p) => matches(path, p));
}

/** Only same-site relative paths, so `next` can't be used as an open redirect. */
export function safeNext(next: string | null | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : null;
}
