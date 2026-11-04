import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { digestToken } from "@/lib/digest";
import { emailEnabled, sendEmail } from "@/lib/email/send.server";
import { renderDigestEmail } from "@/lib/email/templates";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest, secret: string) {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Phase 9 task 4: the weekly digest, Sundays at 7 pm Pakistan time (Vercel Cron). Only
 * students with something new get an email; capped per run to stay inside the SMTP
 * provider's daily limit.
 */
export async function GET(request: NextRequest) {
  const secret = serverEnv.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!emailEnabled()) return NextResponse.json({ sent: 0, skipped: "email is off" });

  const db = createAdminClient();
  const { data: rows, error } = await db.rpc("digest_recipients", { p_limit: 400 });
  if (error) {
    console.error("[cron] digest failed", error.message);
    return NextResponse.json({ error: "Digest failed" }, { status: 500 });
  }
  const site = serverEnv.NEXT_PUBLIC_SITE_URL;
  let sent = 0;
  for (const r of rows ?? []) {
    if (!r.email) continue;
    const unsubscribeUrl = `${site}/api/digest/unsubscribe?u=${r.user_id}&t=${digestToken(r.user_id, secret)}`;
    const mail = renderDigestEmail(
      {
        newBatchmates: r.new_batchmates,
        openBackup: r.open_backup,
        upcomingEvents: r.upcoming_events,
        unread: r.unread_notifications,
      },
      { name: r.full_name, siteUrl: site, unsubscribeUrl },
    );
    if (mail && (await sendEmail(r.email, mail))) sent++;
  }
  return NextResponse.json({ sent, considered: rows?.length ?? 0 });
}
