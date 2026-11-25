import type { Metadata } from "next";
import { CheckCircle2, GraduationCap } from "lucide-react";
import { OnboardingShell } from "@/components/onboarding/shell";
import { TermsAgree } from "@/components/onboarding/terms-agree";
import { WaitlistDialog } from "@/components/onboarding/waitlist-dialog";
import { createPublicClient, getUniversity } from "@/lib/supabase/public";
import { switchOn } from "@/lib/switches.server";

export const metadata: Metadata = { title: "Your university" };
export const revalidate = 300;

/** University and campus (Section 7, screen 2). UoS main campus only at launch. */
export default async function CampusPage() {
  const [uni, signupsOn] = await Promise.all([
    getUniversity(),
    switchOn(createPublicClient(), "signups"),
  ]);
  const campus = uni?.campuses.find((c) => c.is_main)?.name ?? "Main Campus, Sargodha";

  return (
    <OnboardingShell
      back="/"
      step={1}
      title="Where do you study?"
      subtitle="One campus for now, so everyone here is nearby."
    >
      <div
        role="radio"
        aria-checked="true"
        className="flex items-center gap-4 rounded-card border-2 border-accent bg-surface p-4 shadow-card"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-field bg-fill text-on-fill">
          <GraduationCap className="size-6" />
        </span>
        <span className="grid flex-1 gap-0.5">
          <span className="font-bold">{uni?.name ?? "University of Sargodha"}</span>
          <span className="text-sm text-sec">{campus}</span>
        </span>
        <CheckCircle2 aria-hidden className="size-6 text-accent" />
      </div>

      <p className="text-sm text-sec">Sub-campuses are coming later.</p>

      <div className="mt-auto grid gap-3">
        {signupsOn ? (
          <TermsAgree next="/start/email" />
        ) : (
          // Switched off by an admin (launch fix 3); the database refuses new accounts too.
          <p
            role="status"
            className="rounded-card bg-tint p-4 text-center text-subhead font-semibold text-tint-text"
          >
            New sign-ups are paused right now. Check back soon.
          </p>
        )}
        <WaitlistDialog />
      </div>
    </OnboardingShell>
  );
}
