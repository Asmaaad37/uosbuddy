import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { GpaCalculator } from "@/components/gpa/calculator";

export const metadata: Metadata = { title: "GPA calculator" };

/** Phase 6 task 9: GPA and CGPA with the UoS grading table. */
export default function GpaPage() {
  return (
    <AppShell back="/me">
      <div className="grid gap-1">
        <h1 className="text-large-title">GPA calculator</h1>
        <p className="text-sec">Enter your marks per course to see your GPA and CGPA.</p>
      </div>
      <GpaCalculator />
    </AppShell>
  );
}
