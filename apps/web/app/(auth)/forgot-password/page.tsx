import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { OnboardingShell } from "@/components/onboarding/shell";

export const metadata: Metadata = { title: "Forgot your password" };

export default function ForgotPasswordPage() {
  return (
    <OnboardingShell
      back="/login"
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to choose a new one."
    >
      <ForgotPasswordForm />
    </OnboardingShell>
  );
}
