import type { Metadata } from "next";
import Link from "next/link";
import { EmailCodeForm } from "@/components/auth/email-code-form";
import { GoogleButton } from "@/components/auth/google-button";
import { OnboardingShell } from "@/components/onboarding/shell";
import { getUniversity } from "@/lib/supabase/public";

export const metadata: Metadata = { title: "Sign in with your UoS email" };

/** Sign in with UoS email (Section 7, screen 4a): Google, with an email-code fallback. */
export default async function UniEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, uni] = await Promise.all([searchParams, getUniversity()]);
  const domains = uni?.domains.length ? uni.domains : ["uos.edu.pk"];

  return (
    <OnboardingShell
      back="/start/email"
      step={3}
      steps={3}
      title="Sign in with your UoS email"
      subtitle="You'll be verified instantly. Nobody sees your email."
    >
      {error === "not_uni" && (
        <div role="alert" className="rounded-md border border-danger/40 bg-danger/10 p-4 text-sm">
          <p className="font-semibold">That isn&apos;t a UoS email.</p>
          <p className="mt-1 text-ink-2">
            Pick your @{domains[0]} account, or{" "}
            <Link href="/start/freshman" className="font-semibold text-brand">
              join as a fresher instead
            </Link>
            .
          </p>
        </div>
      )}

      {uni?.googleLive && (
        <>
          <GoogleButton domain={domains[0]!} />
          <div className="flex items-center gap-3 text-sm text-ink-2">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <EmailCodeForm domains={domains} secondary={uni?.googleLive} />
    </OnboardingShell>
  );
}
