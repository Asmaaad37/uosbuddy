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
 * Phase 9: when a deleted account is purged (in SQL, after its 14-day grace), its photos
 * stay in Storage, which SQL can't delete. This removes folders whose owner no longer exists.
 */
export async function purgeOrphanFiles({ buckets = ["avatars", "data-exports"] } = {}) {
  const db = createAdminClient();
  let removed = 0;
  for (const bucket of buckets) {
    const { data: folders, error } = await db.storage.from(bucket).list("", { limit: 1000 });
    if (error) throw error;
    const ids = folders.map((f) => f.name).filter((n) => /^[0-9a-f-]{36}$/.test(n));
    if (!ids.length) continue;
    const { data: alive } = await db.from("profiles").select("id").in("id", ids);
    const gone = ids.filter((id) => !alive?.some((p) => p.id === id));
    for (const id of gone) {
      const { data: files } = await db.storage.from(bucket).list(id, { limit: 100 });
      const paths = (files ?? []).map((f) => `${id}/${f.name}`);
      if (paths.length) {
        await db.storage.from(bucket).remove(paths);
        removed += paths.length;
      }
    }
  }
  return { orphans: removed };
}
