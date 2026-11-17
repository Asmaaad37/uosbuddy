import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Whether the request carries `Authorization: Bearer <secret>`, compared in constant time. */
export function bearerMatches(request: Request, secret: string) {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
