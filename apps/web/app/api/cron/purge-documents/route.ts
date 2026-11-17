import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { purgeExpiredDocuments, purgeOldExports, purgeOrphanFiles } from "@/lib/retention.server";
import { bearerMatches } from "@/lib/bearer.server";

export const dynamic = "force-dynamic";

/**
 * Daily retention job: verification documents, old data exports, and files nothing uses any
 * more. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = serverEnv.CRON_SECRET;
  // Fail closed: without a secret, nobody can trigger deletions.
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!bearerMatches(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const documents = await purgeExpiredDocuments();
    const exports = await purgeOldExports();
    const orphans = await purgeOrphanFiles();
    return NextResponse.json({ ...documents, ...exports, ...orphans });
  } catch (error) {
    console.error("[cron] purge-documents failed", error);
    return NextResponse.json({ error: "Purge failed" }, { status: 500 });
  }
}
