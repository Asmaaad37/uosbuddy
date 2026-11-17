import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnboardingShell } from "@/components/onboarding/shell";
import { PendingLive } from "@/components/onboarding/pending-status";
import { getSession } from "@/lib/auth/session";
import { signOut } from "@/actions/onboarding";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Under review" };

const COPY = {
  pending: {
    title: "You're in the queue",
    subtitle: "A reviewer is checking your proof. Usually within 12 hours.",
  },
  needs_info: {
    title: "We need a bit more",
    subtitle: "The reviewer couldn't confirm everything yet. Update your submission below.",
  },
  rejected: {
    title: "We couldn't verify you",
    subtitle: "You can try again with a clearer photo or a different document.",
  },
} as const;

/** Under review (Section 7, screen 5). */
export default async function PendingPage() {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) redirect("/login?next=/pending");

  const status = profile.verification_status;
  if (!(status in COPY)) redirect("/auth/continue");
  const copy = COPY[status as keyof typeof COPY];

  const { data: request } = await supabase
    .from("verification_requests")
    .select("created_at, decision_reason")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const steps = [
    { label: "Submitted", done: true },
    { label: "In review", done: status !== "pending", current: status === "pending" },
    { label: "Decision", done: false, current: status !== "pending" },
  ];

  return (
    <OnboardingShell title={copy.title} subtitle={copy.subtitle}>
      <PendingLive userId={user.id} />

      <ol className="grid gap-0 rounded-card bg-surface p-5 shadow-card contrast-more:border contrast-more:border-label">
        {steps.map((s, i) => (
          <li key={s.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-pill border-2",
                  s.done && "border-accent bg-tint text-tint-text",
                  s.current && "border-accent text-accent",
                  !s.done && !s.current && "border-sep text-sec",
                )}
              >
                {s.done ? (
                  <Check className="size-4" />
                ) : s.current ? (
                  <Hourglass className="size-3.5 motion-safe:animate-pulse" />
                ) : null}
              </span>
              {i < steps.length - 1 && <span className="h-6 w-0.5 bg-sep" />}
            </div>
            <span className={cn("pt-0.5 font-semibold", !s.done && !s.current && "text-sec")}>
              {s.label}
              {i === 0 && request && (
                <span className="block text-footnote font-normal text-sec">
                  {new Date(request.created_at).toLocaleString("en-PK", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Karachi",
                  })}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>

      {status !== "pending" && request?.decision_reason && (
        <div role="status" className="rounded-field border border-danger/50 bg-raised p-4 text-sm">
          <p className="font-semibold">The reviewer said:</p>
          <p className="mt-1">{request.decision_reason}</p>
        </div>
      )}

      <p className="text-sm text-sec">
        This page updates by itself. You can close it; we&apos;ll email you when there&apos;s news.
      </p>

      <div className="mt-auto grid gap-3">
        <Button asChild block variant={status === "pending" ? "tinted" : "primary"}>
          <Link href="/start/freshman/proof">
            {status === "pending" ? "Edit submission" : "Update submission"}
          </Link>
        </Button>
        <form action={signOut}>
          <Button type="submit" block variant="quiet">
            Log out
          </Button>
        </form>
      </div>
    </OnboardingShell>
  );
}
