import "server-only";
import { createPublicClient } from "@/lib/supabase/public";

export const INVITE_COOKIE = "uosb_invite";
export const INVITE_CODE = /^[a-z0-9]{8}$/;

/** What an invite link may show anyone: first name, batch and a count. Null if unknown. */
export async function getInvitePreview(code: string) {
  const normal = code.toLowerCase();
  if (!INVITE_CODE.test(normal)) return null;
  try {
    const { data } = await createPublicClient()
      .rpc("invite_preview", { p_code: normal })
      .abortSignal(AbortSignal.timeout(2500))
      .maybeSingle();
    if (!data) return null;
    const batch =
      data.department_code && data.batch_year ? `${data.department_code} ${data.batch_year}` : null;
    return {
      code: normal,
      firstName: data.first_name || "A classmate",
      batch,
      count: data.batch_count,
    };
  } catch {
    return null;
  }
}

/** "143 of CS 2024 are on UOSBuddy" (or a plain line when the batch isn't known). */
export function inviteHeadline(preview: { batch: string | null; count: number }) {
  if (!preview.batch) return "Your batch is finding each other on UOSBuddy";
  return `${preview.count} of ${preview.batch} ${preview.count === 1 ? "is" : "are"} on UOSBuddy`;
}
