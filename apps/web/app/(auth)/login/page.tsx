import type { Metadata } from "next";
import Link from "next/link";
import { EmailCodeForm } from "@/components/auth/email-code-form";
import { GoogleButton } from "@/components/auth/google-button";
import { PasswordLoginForm } from "@/components/auth/password-login-form";
import { OnboardingShell } from "@/components/onboarding/shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUniversity } from "@/lib/supabase/public";
import { safeNext } from "@/lib/auth/routing";

export const metadata: Metadata = { title: "Log in" };

const ERRORS: Record<string, string> = {
  oauth: "Google sign-in didn't finish. Try again.",
  link: "That link has expired or was already used. Log in below.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const [params, uni] = await Promise.all([searchParams, getUniversity()]);
  const next = safeNext(params.next) ?? undefined;
  const error = params.error ? ERRORS[params.error] : undefined;
  const domain = uni?.domains[0] ?? "uos.edu.pk";

  return (
    <OnboardingShell back="/" title="Welcome back">
      {error && (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm">
          {error}
        </p>
      )}
      <Tabs defaultValue="uni">
        <TabsList aria-label="How you joined" className="w-full">
          <TabsTrigger value="uni" className="flex-1">
            UoS email
          </TabsTrigger>
          <TabsTrigger value="password" className="flex-1">
            Personal email
          </TabsTrigger>
        </TabsList>
        <TabsContent value="uni" className="grid gap-4 pt-5">
          {uni?.googleLive && <GoogleButton domain={domain} />}
          <EmailCodeForm next={next} secondary={uni?.googleLive} />
        </TabsContent>
        <TabsContent value="password" className="pt-5">
          <PasswordLoginForm next={next} />
        </TabsContent>
      </Tabs>
      <p className="text-center text-sm text-ink-2">
        New here?{" "}
        <Link href="/start/campus" className="font-semibold text-brand">
          Get started
        </Link>
      </p>
    </OnboardingShell>
  );
}
