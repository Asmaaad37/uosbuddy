import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "verification-docs";

/**
 * Deletes verification documents past retention (rule in expired_verification_documents) and
 * stamps doc_deleted_at. Runs daily from /api/cron/purge-documents; safe to run repeatedly.
 */
export async function purgeExpiredDocuments({ days = 30, batch = 100 } = {}) {
  const db = createAdminClient();
  const { data: paths, error } = await db.rpc("expired_verification_documents", {
    p_days: days,
    p_limit: 500,
  });
  if (error) throw error;

  let removed = 0;
  for (let i = 0; i < paths.length; i += batch) {
    const chunk = paths.slice(i, i + batch);
    const { error: removeError } = await db.storage.from(BUCKET).remove(chunk);
    if (removeError) throw removeError;
    await db
      .from("verification_requests")
      .update({ doc_deleted_at: new Date().toISOString() })
      .in("doc_path", chunk)
      .is("doc_deleted_at", null);
    removed += chunk.length;
  }
  return { removed };
}
