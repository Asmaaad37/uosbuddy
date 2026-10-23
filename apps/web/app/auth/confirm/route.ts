import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Password recovery joins this list when the reset screen ships.
const TYPES: EmailOtpType[] = ["signup", "email", "magiclink", "email_change"];

/** Email links (`{{ .TokenHash }}` templates). They work in any browser, unlike PKCE links. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL("/auth/continue", request.url));
  }
  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
