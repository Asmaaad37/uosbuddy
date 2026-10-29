import { z } from "zod";

/** Names that would look official or collide with routes. */
const RESERVED = [
  "admin",
  "administrator",
  "uosbuddy",
  "uos",
  "support",
  "help",
  "official",
  "moderator",
  "mod",
  "staff",
  "team",
  "root",
  "system",
  "api",
  "auth",
  "login",
  "setup",
  "explore",
  "settings",
  "me",
  "null",
  "undefined",
  "sargodha",
  "university",
];

/**
 * Blocked anywhere in a handle (English and Roman Urdu). Deliberately short: obvious abuse
 * only, to avoid blocking innocent names (no "nazi": it's inside Nazia). Reports and
 * moderation cover the rest.
 */
const BLOCKED = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "whore",
  "slut",
  "porn",
  "chutiya",
  "chutya",
  "harami",
  "haramzad",
  "bhenchod",
  "behenchod",
  "benchod",
  "madarchod",
  "maderchod",
  "gandu",
  "randi",
  "kanjar",
];

export function handleProblem(raw: string): string | null {
  const handle = raw.trim();
  if (handle.length < 3) return "Use at least 3 characters";
  if (handle.length > 20) return "Use at most 20 characters";
  if (!/^[A-Za-z0-9_]+$/.test(handle)) return "Use letters, numbers and underscores only";
  const lower = handle.toLowerCase();
  if (RESERVED.includes(lower.replace(/_/g, ""))) return "That handle is reserved";
  if (BLOCKED.some((word) => lower.includes(word))) return "Pick a different handle";
  return null;
}

export const handleSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const problem = handleProblem(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });
