import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { homePath, safeNext } from "@/lib/auth/routing";
import { recordTermsAcceptance } from "@/lib/terms.server";

/** Lands any freshly signed-in user on the right page for their verification state. */
export async function GET(request: NextRequest) {
  const { supabase, profile } = await getSession();
  if (profile) await recordTermsAcceptance(supabase);
  const next = profile ? safeNext(request.nextUrl.searchParams.get("next")) : null;
  return NextResponse.redirect(new URL(next ?? homePath(profile), request.url));
}
