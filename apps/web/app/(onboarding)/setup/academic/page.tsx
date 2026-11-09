import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OnboardingShell } from "@/components/onboarding/shell";
import { AcademicForm } from "@/components/setup/academic-form";
import { getSession } from "@/lib/auth/session";
import { batchYearFromStudentId, isEditing } from "@/lib/setup";

export const metadata: Metadata = { title: "Your studies" };

const EDIT_PATH = "/setup/academic?edit=1";

/** Screen 6: department → program → session → semester → section → shift. */
export default async function AcademicPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; change?: string }>;
}) {
  const { supabase, user, profile } = await getSession();
  if (!user || !profile) redirect("/login?next=/setup/academic");
  const params = await searchParams;
  const editing = isEditing(params.edit, profile.onboarding_step);

  const [{ data: departments }, { data: programs }, { data: pii }, { data: request }] =
    await Promise.all([
      supabase.from("departments").select("id, name, faculty, aliases").order("name"),
      supabase.from("programs").select("id, department_id, name, duration_semesters").order("name"),
      supabase
        .from("private_profile")
        .select("roll_no, registration_no")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("studies_change_requests")
        .select("status, decision_reason")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const pending = request?.status === "pending";
  const used = !!profile.studies_changed_at;
  const changing = editing && params.change === "1" && !pending && !used;

  return (
    <OnboardingShell
      back={changing ? EDIT_PATH : editing ? "/me" : undefined}
      step={editing ? undefined : 1}
      title={changing ? "Change your studies" : "What do you study?"}
      subtitle={
        changing
          ? "Choose your new details and add proof. An admin checks it, and you can only do this once."
          : "This is how your batchmates and section find you."
      }
    >
      {editing && !changing && (
        <p className="mb-5 rounded-field bg-raised p-3 text-footnote text-sec">
          {pending ? (
            "Your change is waiting for an admin to check your proof. We'll let you know."
          ) : used ? (
            "You've already changed your department, session, section or shift once. To change them again, ask an admin."
          ) : (
            <>
              {request?.status === "rejected" && request.decision_reason && (
                <>We couldn&apos;t make your last change: {request.decision_reason} </>
              )}
              Changing your department, session, section or shift needs proof.{" "}
              <Link href={`${EDIT_PATH}&change=1`} className="font-semibold text-accent">
                Ask for a change
              </Link>
            </>
          )}
        </p>
      )}
      <AcademicForm
        departments={departments ?? []}
        programs={programs ?? []}
        initial={{
          departmentId: profile.department_id ?? "",
          programId: profile.program_id ?? "",
          // A fresher's roll number already says which session they joined.
          batchYear:
            profile.batch_year ??
            batchYearFromStudentId(pii?.roll_no ?? pii?.registration_no) ??
            null,
          semester: profile.semester ?? null,
          section: profile.section ?? "",
          shift: profile.shift ?? null,
        }}
        mode={changing ? "proof" : editing ? "locked" : "free"}
        next={changing ? EDIT_PATH : editing ? "/me" : undefined}
        submitLabel={changing ? "Send for review" : editing ? "Save" : undefined}
      />
    </OnboardingShell>
  );
}
