import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { GpaCalculator } from "@/components/gpa/calculator";
import { ScreenHeader } from "@/components/ui/screen-header";

export const metadata: Metadata = { title: "GPA calculator" };

/** Phase 6 task 9: GPA and CGPA with the UoS grading table. */
export default function GpaPage() {
  return (
    <AppShell>
      <ScreenHeader
        title="GPA calculator"
        back="/me"
        subtitle={<>Enter your marks to see your GPA and CGPA.</>}
      />
      <GpaCalculator />
    </AppShell>
  );
}
