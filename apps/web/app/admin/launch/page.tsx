import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheck, CircleDashed, CircleX } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { TestPush } from "@/components/admin/test-push";
import { homePath } from "@/lib/auth/routing";
import { getSession } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { redis } from "@/lib/redis.server";

export const metadata: Metadata = { title: "Launch check", robots: { index: false } };

/** The scheduled jobs the migrations create (runbook §5). */
const JOBS = [
  "admin-stats",
  "award-badges",
  "backup-housekeeping",
  "event-reminders",
  "purge-deleted-accounts",
];

type Status = "ok" | "missing" | "optional" | "manual";
type Check = { label: string; status: Status; note?: string; value?: string };

type LaunchStatus = {
  push_url: string | null;
  push_secret: boolean;
  recent_pushes: {
    ok: number;
    failed: number;
    last_status: number | null;
    last_error: string | null;
  } | null;
  crons: { name: string; active: boolean }[];
  my_devices: number;
  devices: number;
  my_push_on: boolean;
  admins: number;
};

const set = (v: string | undefined) => !!v && v.trim() !== "";
const need = (ok: boolean, label: string, note?: string): Check => ({
  label,
  status: ok ? "ok" : "missing",
  note,
});
const nice = (ok: boolean, label: string, note?: string): Check => ({
  label,
  status: ok ? "ok" : "optional",
  note,
});

/** Really asks Redis: the app carries on silently without it, so "the keys exist" proves little. */
async function redisConnected() {
  if (!redis) return false;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000));
  const ping = redis
    .ping()
    .then((answer) => answer === "PONG")
    .catch(() => false);
  return Promise.race([ping, timeout]);
}

function origin(url: string | null | undefined) {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

/** What /api/push answered last time, in words. */
function lastPush(s: LaunchStatus["recent_pushes"]) {
  if (!s || s.ok + s.failed === 0) return "No pushes in the last 6 hours.";
  const tail =
    s.last_status === 401
      ? " Last answer 401: PUSH_WEBHOOK_SECRET in Vercel and push_secret in the database differ."
      : s.last_status === 503
        ? " Last answer 503: PUSH_WEBHOOK_SECRET isn't set in Vercel."
        : s.last_status === 404
          ? " Last answer 404: push_url points at the wrong address."
          : s.last_status === null && s.last_error
            ? ` Last error: ${s.last_error}`
            : "";
  return `Last 6 hours: ${s.ok} delivered to the app, ${s.failed} failed.${tail}`;
}

/**
 * Admin → Launch check: whether the live site's settings are in place. Shows only yes/no
 * (and the push address, which isn't secret), never a key.
 */
export default async function LaunchPage() {
  const { supabase, profile } = await getSession();
  if (profile?.role !== "admin") notFound();
  const [{ data }, redisOk] = await Promise.all([supabase.rpc("launch_status"), redisConnected()]);
  const db = data as LaunchStatus | null;

  const site = publicEnv.NEXT_PUBLIC_SITE_URL;
  const siteOrigin = origin(site);
  const live = siteOrigin?.startsWith("https://") && !siteOrigin.includes("localhost");
  const pushUrlOk = !!db?.push_url && origin(db.push_url) === siteOrigin;
  const jobs = new Map((db?.crons ?? []).map((c) => [c.name, c.active]));
  const lastStatus = db?.recent_pushes?.last_status;

  const groups: { title: string; checks: Check[]; footer?: React.ReactNode }[] = [
    {
      title: "This site",
      checks: [
        need(!!live, "Site address", live ? siteOrigin! : `NEXT_PUBLIC_SITE_URL is ${site}`),
        need(
          set(publicEnv.NEXT_PUBLIC_SUPPORT_EMAIL),
          "Support email",
          "Shown on /privacy and /terms. Use a shared inbox, not a personal one.",
        ),
        need((db?.admins ?? 0) >= 2, "At least two admins", `${db?.admins ?? 0} now`),
      ],
    },
    {
      title: "Bot protection (Cloudflare Turnstile)",
      checks: [
        need(set(publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY), "Site key in Vercel"),
        need(
          set(serverEnv.TURNSTILE_SECRET_KEY),
          "Secret key in Vercel",
          "Checks the freshman waitlist form.",
        ),
        {
          label: "Captcha on in Supabase Auth",
          status: "manual",
          note: "Can't be read from here: Supabase → Authentication → Attack Protection. Turn it on only after the site key above is live.",
        },
      ],
    },
    {
      title: "Push notifications",
      checks: [
        need(
          set(publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY) && set(serverEnv.VAPID_PRIVATE_KEY),
          "VAPID keys in Vercel",
        ),
        need(set(serverEnv.VAPID_SUBJECT), "VAPID subject in Vercel", "mailto:<support inbox>"),
        need(set(serverEnv.PUSH_WEBHOOK_SECRET), "PUSH_WEBHOOK_SECRET in Vercel"),
        need(
          pushUrlOk,
          "push_url in the database",
          db?.push_url
            ? pushUrlOk
              ? db.push_url
              : `${db.push_url} doesn't match ${siteOrigin}`
            : "Not set",
        ),
        need(
          !!db?.push_secret,
          "push_secret in the database",
          "Same value as PUSH_WEBHOOK_SECRET.",
        ),
        need(
          lastStatus == null || (lastStatus >= 200 && lastStatus < 300),
          "Database → app",
          lastPush(db?.recent_pushes ?? null),
        ),
        need(
          (db?.my_devices ?? 0) > 0 && !!db?.my_push_on,
          "Your devices",
          !db?.my_push_on
            ? "Push is off in your notification settings."
            : `${db?.my_devices ?? 0} of yours, ${db?.devices ?? 0} in total. Turn them on in Me → Notifications on your phone.`,
        ),
      ],
      footer: <TestPush />,
    },
    {
      title: "Email and limits",
      checks: [
        need(
          set(serverEnv.SMTP_HOST) &&
            set(serverEnv.SMTP_USER) &&
            set(serverEnv.SMTP_PASSWORD) &&
            set(serverEnv.EMAIL_FROM),
          "Email (SMTP) in Vercel",
          "App emails such as the weekly digest. Login codes use Supabase's own SMTP settings.",
        ),
        {
          label: "Rate limits (Upstash)",
          status: redisOk ? "ok" : "missing",
          value: redisOk ? "Connected" : redis ? "Can't connect" : "Missing",
          note: redisOk
            ? undefined
            : redis
              ? "The keys are set but Redis refused or didn't answer. Copy the REST URL and token from Upstash again."
              : "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel.",
        },
      ],
    },
    {
      title: "Scheduled jobs",
      checks: [
        need(
          set(serverEnv.CRON_SECRET),
          "CRON_SECRET in Vercel",
          "Weekly digest and document clean-up.",
        ),
        ...JOBS.map((j) =>
          need(
            jobs.get(j) === true,
            j,
            jobs.has(j) ? (jobs.get(j) ? undefined : "Paused") : "Missing",
          ),
        ),
      ],
    },
    {
      title: "Optional",
      checks: [
        nice(set(serverEnv.ANTHROPIC_API_KEY), "AI (Anthropic key)", "Off is fine at launch."),
        nice(set(serverEnv.SENTRY_DSN), "Error tracking (Sentry)"),
        nice(set(publicEnv.NEXT_PUBLIC_POSTHOG_KEY), "Analytics (PostHog)"),
      ],
    },
  ];

  const missing = groups.flatMap((g) => g.checks).filter((c) => c.status === "missing").length;

  return (
    <AdminShell current="/admin/launch" isAdmin back={homePath(profile)}>
      <div>
        <h1 className="text-[28px] font-bold">Launch check</h1>
        <p className="text-sec">
          {missing === 0
            ? "Everything that can be checked from here is set."
            : `${missing} ${missing === 1 ? "thing needs" : "things need"} setting up. Settings in Vercel apply after the next deployment.`}
        </p>
      </div>

      {groups.map((g) => (
        <section key={g.title} aria-label={g.title} className="grid gap-2">
          <h2 className="px-1 text-overline text-ter uppercase">{g.title}</h2>
          <div className="overflow-hidden rounded-card bg-surface shadow-card">
            <ul className="divide-y divide-sep">
              {g.checks.map((c) => (
                <li key={c.label} className="flex items-start gap-3 p-4">
                  <StatusIcon status={c.status} />
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="font-semibold break-words">{c.label}</span>
                    {c.note && <span className="text-sm break-words text-sec">{c.note}</span>}
                  </div>
                  <span className="shrink-0 text-sm text-sec">
                    {c.value ??
                      (c.status === "ok"
                        ? "Set"
                        : c.status === "missing"
                          ? "Missing"
                          : c.status === "manual"
                            ? "Check by hand"
                            : "Off")}
                  </span>
                </li>
              ))}
            </ul>
            {g.footer && <div className="border-t border-sep p-4">{g.footer}</div>}
          </div>
        </section>
      ))}

      <section aria-label="Before announcing" className="grid gap-2">
        <h2 className="px-1 text-overline text-ter uppercase">Before announcing (by hand)</h2>
        <ul className="grid list-disc gap-1 rounded-card bg-surface p-4 pl-8 shadow-card">
          <li>Supabase on the Pro plan: daily backups, no pausing. Test a restore once.</li>
          <li>Usage alerts in Supabase, and a monthly spend limit in Anthropic if AI is on.</li>
          <li>
            Emergency numbers on the{" "}
            <Link href="/safety" className="text-accent underline">
              safety page
            </Link>{" "}
            and the ride areas checked by someone from Sargodha.
          </li>
          <li>Privacy, terms and guidelines read by the project owner.</li>
          <li>A phone smoke test: sign up, post, chat, install to the home screen, get a push.</li>
        </ul>
      </section>
    </AdminShell>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "ok") return <CircleCheck aria-hidden className="mt-0.5 size-5 text-accent" />;
  if (status === "missing") return <CircleX aria-hidden className="mt-0.5 size-5 text-danger" />;
  return <CircleDashed aria-hidden className="mt-0.5 size-5 text-ter" />;
}
