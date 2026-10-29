import { NextResponse, type NextRequest } from "next/server";
import { INVITE_CODE, INVITE_COOKIE } from "@/lib/invites.server";

/** "Get started" from an invite: remember the code for 30 days, then begin sign-up. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toLowerCase();
  const response = NextResponse.redirect(new URL("/start/campus", request.url));
  if (INVITE_CODE.test(code)) {
    response.cookies.set(INVITE_COOKIE, code, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }
  return response;
}
