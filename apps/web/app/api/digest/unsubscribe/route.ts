import { NextResponse, type NextRequest } from "next/server";
import { checkDigestToken } from "@/lib/digest";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const page = (title: string, body: string, status = 200) =>
  new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:48px 16px;background:#f2f4f7;color:#0b1220;font-family:Arial,Helvetica,sans-serif;text-align:center">
<h1 style="font-size:24px">${title}</h1><div style="font-size:16px;line-height:1.5">${body}</div>
<p><a href="/me/notifications" style="color:#2563eb;font-weight:bold">Notification settings</a></p></body></html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    },
  );

function verified(request: NextRequest) {
  const user = request.nextUrl.searchParams.get("u") ?? "";
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const secret = serverEnv.CRON_SECRET;
  const ok = !!secret && /^[0-9a-f-]{36}$/.test(user) && checkDigestToken(user, token, secret);
  return ok ? user : null;
}

const broken = () =>
  page(
    "That link didn't work",
    "Turn off the weekly email in your notification settings instead.",
    400,
  );

/** The link from the email: a confirm button, so link scanners can't unsubscribe anyone. */
export async function GET(request: NextRequest) {
  if (!verified(request)) return broken();
  const action = `/api/digest/unsubscribe${request.nextUrl.search}`.replaceAll("&", "&amp;");
  return page(
    "Stop the weekly email?",
    `<form method="post" action="${action}"><button style="padding:12px 24px;border:0;border-radius:999px;background:#2563eb;color:#ffffff;font-size:16px;font-weight:bold">Unsubscribe</button></form>`,
  );
}

/** Phase 9 task 4: unsubscribe (the button above, or a mail client's one-click POST). */
export async function POST(request: NextRequest) {
  const user = verified(request);
  if (!user) return broken();
  const { error } = await createAdminClient().rpc("set_digest", { p_user: user, p_on: false });
  if (error) {
    return page("Something went wrong", "Try again, or use your notification settings.", 500);
  }
  return page("You're unsubscribed", "You won't get the weekly UOSBuddy email any more.");
}
