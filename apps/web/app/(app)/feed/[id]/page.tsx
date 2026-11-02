import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Comments } from "@/components/feed/comments";
import { PostCard } from "@/components/feed/post-card";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Post" };

type Props = { params: Promise<{ id: string }> };

/** Phase 5 task 2: a post and its comments. Reads only the public views. */
export default async function PostPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, user } = await getSession();
  if (!user) redirect(`/login?next=/feed/${id}`);

  const [{ data: post }, { data: comments }, { data: flag }] = await Promise.all([
    supabase.from("posts_public").select("*").eq("id", id).maybeSingle(),
    supabase.from("comments_public").select("*").eq("post_id", id).order("created_at"),
    supabase.from("feature_flags").select("enabled").eq("key", "anonymous_posts").maybeSingle(),
  ]);
  if (!post) notFound();
  const paths = post.media_paths ?? [];
  const { data: urls } = paths.length
    ? await supabase.storage.from("post-media").createSignedUrls(paths, 60 * 60)
    : { data: [] };

  return (
    <AppShell back="/feed">
      <PostCard
        key={`${post.id}:${post.comment_count}`}
        post={post}
        linkToThread={false}
        mediaUrls={Object.fromEntries(
          (urls ?? []).flatMap((u) => (u.path && u.signedUrl ? [[u.path, u.signedUrl]] : [])),
        )}
      />
      <Comments postId={id} comments={comments ?? []} anonymousAllowed={!!flag?.enabled} />
    </AppShell>
  );
}
