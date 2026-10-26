import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { purgeExpiredDocuments } from "@/lib/retention.server";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest, secret: string) {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Daily document retention job. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: NextRequest) {
  const secret = serverEnv.CRON_SECRET;
  // Fail closed: without a secret, nobody can trigger deletions.
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await purgeExpiredDocuments());
  } catch (error) {
    console.error("[cron] purge-documents failed", error);
    return NextResponse.json({ error: "Purge failed" }, { status: 500 });
  }
}
