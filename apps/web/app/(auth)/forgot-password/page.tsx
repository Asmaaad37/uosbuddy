import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { OnboardingShell } from "@/components/onboarding/shell";

export const metadata: Metadata = { title: "Forgot your password" };

export default function ForgotPasswordPage() {
  return (
    <OnboardingShell
      back="/login"
      title="Forgot your password?"
      subtitle="We'll email you a link to set a new one."
    >
      <ForgotPasswordForm />
    </OnboardingShell>
  );
}
