import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@uosbuddy/shared";
import { TERMS_COOKIE, TERMS_VERSION } from "@/lib/terms";

/** Whether this browser ticked "I agree" to the current terms during sign-up. */
export async function agreedToTerms() {
  return (await cookies()).get(TERMS_COOKIE)?.value === TERMS_VERSION;
}

/**
 * Right after sign-in: if this browser agreed during sign-up, save it on the account. Logging
 * in to an existing account without agreeing records nothing. Never blocks sign-in.
 */
export async function recordTermsAcceptance(supabase: SupabaseClient<Database>) {
  if (!(await agreedToTerms())) return;
  const { error } = await supabase.rpc("accept_terms", { p_version: TERMS_VERSION });
  if (error) console.error("[terms] couldn't record acceptance", error.message);
}
