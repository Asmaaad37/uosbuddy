import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { resumeStep } from "@/lib/setup";

/** Resume setup at the first unfinished step (Phase 2: autosave per step). */
export default async function SetupPage() {
  const { profile } = await getSession();
  redirect(`/setup/${resumeStep(profile?.onboarding_step ?? 0)}`);
}
