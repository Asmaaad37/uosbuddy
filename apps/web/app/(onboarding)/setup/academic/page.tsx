import type { Metadata } from "next";
import { OnboardingShell } from "@/components/onboarding/shell";
import { AcademicForm } from "@/components/setup/academic-form";
import { getSession } from "@/lib/auth/session";
import { batchYearFromStudentId } from "@/lib/setup";

export const metadata: Metadata = { title: "Your studies" };

/** Screen 6: department → program → session → semester → section → shift. */
export default async function AcademicPage() {
  const { supabase, user, profile } = await getSession();

  const [{ data: departments }, { data: programs }, { data: pii }] = await Promise.all([
    supabase.from("departments").select("id, name, faculty, aliases").order("name"),
    supabase.from("programs").select("id, department_id, name, duration_semesters").order("name"),
    supabase
      .from("private_profile")
      .select("roll_no, registration_no")
      .eq("user_id", user?.id ?? "")
      .maybeSingle(),
  ]);

  return (
    <OnboardingShell
      step={1}
      title="What do you study?"
      subtitle="This is how your batchmates and section find you."
    >
      <AcademicForm
        departments={departments ?? []}
        programs={programs ?? []}
        initial={{
          departmentId: profile?.department_id ?? "",
          programId: profile?.program_id ?? "",
          // A fresher's roll number already says which session they joined.
          batchYear:
            profile?.batch_year ??
            batchYearFromStudentId(pii?.roll_no ?? pii?.registration_no) ??
            null,
          semester: profile?.semester ?? null,
          section: profile?.section ?? "",
          shift: profile?.shift ?? null,
        }}
      />
    </OnboardingShell>
  );
}
