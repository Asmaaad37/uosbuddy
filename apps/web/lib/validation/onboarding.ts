import { z } from "zod";

/** Shared by the forms (instant feedback) and the server actions (the real check). */

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Enter your full name")
  .max(80, "Keep it under 80 characters");

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email"));

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Keep it under 72 characters");

export const whatsappSchema = z
  .string()
  .transform((v) => v.replace(/[\s()-]/g, ""))
  .refine((v) => v === "" || /^\+?[0-9]{10,13}$/.test(v), "Enter a valid WhatsApp number");

export const otpSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{6,10}$/, "Enter the code from the email");

export function normaliseStudentId(value: string) {
  return value.replace(/\s/g, "").toUpperCase();
}

export type StudentIdFormats = { roll: string | null; registration: string | null };

/** Roll or registration number, per the university's formats (supabase/seed/uos-catalogue.json). */
export function isStudentId(value: string, formats: StudentIdFormats) {
  const id = normaliseStudentId(value);
  return [formats.roll, formats.registration].some((rx) => rx !== null && new RegExp(rx).test(id));
}

export function emailDomain(email: string) {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

/** Verification documents: types and size match the storage bucket's limits. */
export const DOC_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
export const MAX_DOC_BYTES = 8 * 1024 * 1024;

/** 0–4, for the strength meter. Length matters most; variety adds a little. */
export function passwordStrength(password: string) {
  if (password.length < 8) return 0;
  const variety = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) =>
    r.test(password),
  ).length;
  return Math.min(
    4,
    1 + (password.length >= 12 ? 1 : 0) + (variety >= 3 ? 1 : 0) + (variety === 4 ? 1 : 0),
  );
}
