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

/** Phase 9: data exports are kept for 7 days (their links last as long). */
export async function purgeOldExports({ days = 7 } = {}) {
  const db = createAdminClient();
  const before = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data: rows, error } = await db
    .from("data_exports")
    .select("id, path")
    .lt("created_at", before)
    .limit(500);
  if (error) throw error;
  if (!rows.length) return { exports: 0 };
  const { error: removeError } = await db.storage
    .from("data-exports")
    .remove(rows.map((r) => r.path));
  if (removeError) throw removeError;
  await db
    .from("data_exports")
    .delete()
    .in(
      "id",
      rows.map((r) => r.id),
    );
  return { exports: rows.length };
}

/**
 * Files nothing live uses any more (rule in unused_storage_files): photos and files of deleted
 * or removed posts, listings, resources and messages, uploads that were never posted, and
 * whatever a purged account left. SQL picks them; only the Storage API can delete them.
 */
export async function purgeOrphanFiles({ batch = 500, maxBatches = 20 } = {}) {
  const db = createAdminClient();
  let removed = 0;
  for (let i = 0; i < maxBatches; i++) {
    const { data: due, error } = await db.rpc("unused_storage_files", { p_limit: batch });
    if (error) throw error;
    if (!due.length) break;
    const byBucket = new Map<string, string[]>();
    for (const f of due) byBucket.set(f.bucket_id, [...(byBucket.get(f.bucket_id) ?? []), f.name]);
    for (const [bucket, paths] of byBucket) {
      const { error: removeError } = await db.storage.from(bucket).remove(paths);
      if (removeError) throw removeError;
      removed += paths.length;
    }
    if (due.length < batch) break;
  }
  return { orphans: removed };
}
