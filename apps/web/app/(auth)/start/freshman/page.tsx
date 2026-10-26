import type { Metadata } from "next";
import { OnboardingShell } from "@/components/onboarding/shell";
import { FreshmanAccountForm } from "@/components/onboarding/freshman-account-form";

export const metadata: Metadata = { title: "Join as a fresher" };

/** Join as a fresher (Section 7, screen 4b), part 1: the account. Proof comes next. */
export default function FreshmanPage() {
  return (
    <OnboardingShell
      back="/start/email"
      step={3}
      title="Join as a fresher"
      subtitle="First your account, then a photo of your proof. A real person checks it."
    >
      <FreshmanAccountForm />
    </OnboardingShell>
  );
}
