import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnboardingShell } from "@/components/onboarding/shell";
import { WaitlistDialog } from "@/components/onboarding/waitlist-dialog";
import { getUniversity } from "@/lib/supabase/public";

export const metadata: Metadata = { title: "Your university" };
export const revalidate = 300;

/** University and campus (Section 7, screen 2). UoS main campus only at launch. */
export default async function CampusPage() {
  const uni = await getUniversity();
  const campus = uni?.campuses.find((c) => c.is_main)?.name ?? "Main Campus, Sargodha";

  return (
    <OnboardingShell
      back="/"
      step={1}
      title="Where do you study?"
      subtitle="UOSBuddy starts with one campus, so everyone here is actually near you."
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
        <Button asChild block>
          <Link href="/start/email">Continue</Link>
        </Button>
        <WaitlistDialog />
      </div>
    </OnboardingShell>
  );
}
