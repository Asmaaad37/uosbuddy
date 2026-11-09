import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Long enough to work through the queue, then they expire. */
const MEDIA_LINK_SECONDS = 15 * 60;

/**
 * Links to reported files, keyed by "bucket/path". Staff often can't read these themselves (a
 * chat photo is for its members), so this signs them with the service key. Pass only rows that
 * moderation_queue returned for the signed-in staff member, which is what limits them.
 */
export async function moderationMediaLinks(
  rows: { media_bucket: string | null; media_paths: string[] }[],
) {
  const links = new Map<string, string>();
  const byBucket = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.media_bucket || !r.media_paths.length) continue;
    if (r.media_bucket === "url") for (const url of r.media_paths) links.set(`url/${url}`, url);
    else byBucket.set(r.media_bucket, [...(byBucket.get(r.media_bucket) ?? []), ...r.media_paths]);
  }
  const db = createAdminClient();
  await Promise.all(
    [...byBucket].map(async ([bucket, paths]) => {
      const { data } = await db.storage.from(bucket).createSignedUrls(paths, MEDIA_LINK_SECONDS);
      for (const s of data ?? []) {
        if (s.path && s.signedUrl) links.set(`${bucket}/${s.path}`, s.signedUrl);
      }
    }),
  );
  return links;
}
