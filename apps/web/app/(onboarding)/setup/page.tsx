import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { SETUP_STEPS, resumeStep } from "@/lib/setup";

/** Resume setup at the first unfinished step (Phase 2: autosave per step). */
export default async function SetupPage() {
  const { profile } = await getSession();
  const done = profile?.onboarding_step ?? 0;
  // Finished students have nothing to resume; edits go through /me.
  if (done >= SETUP_STEPS.length) redirect("/explore");
  redirect(`/setup/${resumeStep(done)}`);
}
