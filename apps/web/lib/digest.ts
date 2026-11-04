import { createHmac, timingSafeEqual } from "node:crypto";

/** Signed one-click unsubscribe tokens for the weekly digest (Phase 9 task 4). */
export function digestToken(userId: string, secret: string) {
  return createHmac("sha256", secret).update(`digest:${userId}`).digest("hex").slice(0, 32);
}

export function checkDigestToken(userId: string, token: string, secret: string) {
  const expected = Buffer.from(digestToken(userId, secret));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
