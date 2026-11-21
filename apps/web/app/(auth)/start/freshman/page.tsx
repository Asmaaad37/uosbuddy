import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding/shell";
import { FreshmanAccountForm } from "@/components/onboarding/freshman-account-form";
import { agreedToTerms } from "@/lib/terms.server";

export const metadata: Metadata = { title: "Join as a fresher" };

/** Join as a fresher (Section 7, screen 4b), part 1: the account. Proof comes next. */
export default async function FreshmanPage() {
  // Sign-up starts by agreeing to the terms.
  if (!(await agreedToTerms())) redirect("/start/campus");
  return (
    <OnboardingShell
      back="/start/email"
      step={3}
      title="Join as a fresher"
      subtitle="Your account first, then a photo of your proof."
    >
      <FreshmanAccountForm />
    </OnboardingShell>
  );
}
