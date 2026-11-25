import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

/**
 * Launch fix 2: for an uptime monitor. 200 when the app can reach the database within 3 s,
 * 503 otherwise. One tiny public read; no personal data in the response.
 */
export async function GET() {
  const started = Date.now();
  try {
    const { error } = await createPublicClient()
      .from("feature_flags")
      .select("key", { head: true, count: "exact" })
      .limit(1)
      .abortSignal(AbortSignal.timeout(3000));
    if (error) throw error;
    return NextResponse.json(
      { ok: true, db_ms: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
