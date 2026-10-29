import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LinkEmailForm } from "@/components/profile/link-email-form";
import { Stamp } from "@/components/ui/badge";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Link your UoS email" };

/** Phase 2 task 8: a fresher links their UoS email later and earns the UOS EMAIL stamp. */
export default async function LinkEmailPage() {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) redirect("/login?next=/me/email");

  const [{ data: pii }, { data: domains }] = await Promise.all([
    supabase.from("private_profile").select("uni_email").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("university_domains")
      .select("domain")
      .eq("university_id", profile.university_id ?? ""),
  ]);
  if (pii?.uni_email) redirect("/me");

  return (
    <AppShell back="/me">
      <div className="grid gap-3">
        <Stamp tone="email" className="self-start">
          UoS email
        </Stamp>
        <h1 className="text-[28px] leading-tight font-bold">Link your UoS email</h1>
        <p className="text-ink-2">
          Got your student email? Link it to add the UoS email stamp to your profile. You keep
          logging in the way you do now.
        </p>
      </div>
      <LinkEmailForm domain={domains?.[0]?.domain ?? "uos.edu.pk"} />
    </AppShell>
  );
}
