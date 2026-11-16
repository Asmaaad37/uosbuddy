import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EmailCodeForm } from "@/components/auth/email-code-form";
import { GoogleButton } from "@/components/auth/google-button";
import { OnboardingShell } from "@/components/onboarding/shell";
import { getUniversity } from "@/lib/supabase/public";
import { agreedToTerms } from "@/lib/terms.server";

export const metadata: Metadata = { title: "Sign in with your UoS email" };

/** Sign in with UoS email (Section 7, screen 4a): Google, with an email-code fallback. */
export default async function UniEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, uni, agreed] = await Promise.all([
    searchParams,
    getUniversity(),
    agreedToTerms(),
  ]);
  // Sign-up starts by agreeing to the terms; Google sends wrong-domain accounts back here.
  if (!agreed && error !== "not_uni") redirect("/start/campus");
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
        <div
          role="alert"
          className="rounded-field border border-danger/40 bg-danger/10 p-4 text-sm"
        >
          <p className="font-semibold">That isn&apos;t a UoS email.</p>
          <p className="mt-1 text-sec">
            Pick your @{domains[0]} account, or{" "}
            <Link href="/start/freshman" className="font-semibold text-accent">
              join as a fresher instead
            </Link>
            .
          </p>
        </div>
      )}

      {uni?.googleLive && (
        <>
          <GoogleButton domain={domains[0]!} />
          <div className="flex items-center gap-3 text-sm text-sec">
            <span className="h-px flex-1 bg-sep" />
            or
            <span className="h-px flex-1 bg-sep" />
          </div>
        </>
      )}

      <EmailCodeForm domains={domains} secondary={uni?.googleLive} />
    </OnboardingShell>
  );
}
