import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding/shell";
import { ProofForm } from "@/components/onboarding/proof-form";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Your proof" };

/** Join as a fresher, part 2: student ID and proof. Also "Edit submission" from /pending. */
export default async function ProofPage() {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) redirect("/login?next=/start/freshman/proof");

  const [{ data: pii }, { data: uni }, { data: request }] = await Promise.all([
    supabase
      .from("private_profile")
      .select("roll_no, registration_no, whatsapp")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("universities")
      .select("roll_no_regex, registration_no_regex")
      .eq("id", profile.university_id ?? "")
      .maybeSingle(),
    supabase
      .from("verification_requests")
      .select("status, decision_reason")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const editing = profile.verification_status !== "unverified";
  const reason =
    request && ["needs_info", "rejected"].includes(request.status) ? request.decision_reason : null;

  return (
    <OnboardingShell
      back={editing ? "/pending" : undefined}
      step={editing ? undefined : 4}
      title={editing ? "Update your submission" : "Show you're at UoS"}
      subtitle="A real person checks this, usually within 12 hours."
    >
      {reason && (
        <div
          role="status"
          className="rounded-md border border-warning/50 bg-warning/10 p-4 text-sm"
        >
          <p className="font-semibold">The reviewer said:</p>
          <p className="mt-1">{reason}</p>
        </div>
      )}
      <ProofForm
        formats={{
          roll: uni?.roll_no_regex ?? null,
          registration: uni?.registration_no_regex ?? null,
        }}
        defaults={{
          fullName: profile.full_name ?? "",
          studentId: pii?.roll_no ?? pii?.registration_no ?? "",
          whatsapp: pii?.whatsapp ?? "",
        }}
      />
    </OnboardingShell>
  );
}
