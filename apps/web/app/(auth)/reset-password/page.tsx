import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { OnboardingShell } from "@/components/onboarding/shell";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage() {
  const { user } = await getSession();
  if (!user) redirect("/login?error=link");

  return (
    <OnboardingShell
      title="Choose a new password"
      subtitle="This also logs out your other devices."
    >
      <ResetPasswordForm />
    </OnboardingShell>
  );
}
