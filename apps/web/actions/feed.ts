"use server";

import { z } from "zod";
import type { Database } from "@uosbuddy/shared";
import { moderate } from "@/lib/ai/moderate.server";
import { getSession } from "@/lib/auth/session";
import { GUIDELINES_REQUIRED } from "@/lib/guidelines";
import type { ActionResult } from "./onboarding";

export type Post = Database["public"]["Views"]["posts_public"]["Row"];
export type Comment = Database["public"]["Views"]["comments_public"]["Row"];
export type Sort = "hot" | "new";

const fail = (error: string) => ({ ok: false, error }) as const;
const id = z.uuid();
const PAGE = 20;

function friendly(error: { code?: string; message: string } | null, fallback: string) {
  if (error && ["42501", "22023", "P0002", "54000"].includes(error.code ?? ""))
    return error.message;
  return fallback;
}

async function session() {
  const s = await getSession();
  return s.user ? { supabase: s.supabase, user: s.user, profile: s.profile } : null;
}

const feedSchema = z.object({
  space: z.string().regex(/^(campus|department:[0-9a-f-]{36})$/),
  sort: z.enum(["hot", "new"]),
  after: z.object({ score: z.number(), createdAt: z.string(), id: z.uuid() }).optional(),
});

export type FeedPage = { posts: Post[]; next: z.infer<typeof feedSchema>["after"] | null };

/** Phase 5 task 2: one page of a feed, Hot or New (keyset on score or time, then id). */
export async function loadFeed(input: z.input<typeof feedSchema>): Promise<ActionResult<FeedPage>> {
  const parsed = feedSchema.safeParse(input);
  if (!parsed.success) return fail("Feed not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { space, sort, after } = parsed.data;

  let query = s.supabase
    .from("posts_public")
    .select("*")
    // posts_public holds back others' held posts; your own show as "Under review".
    .eq("space", space);
  if (sort === "hot") {
    if (after)
      query = query.or(
        `hot_score.lt.${after.score},and(hot_score.eq.${after.score},id.lt.${after.id})`,
      );
    query = query.order("hot_score", { ascending: false }).order("id", { ascending: false });
  } else {
    if (after) {
      query = query.or(
        `created_at.lt."${after.createdAt}",and(created_at.eq."${after.createdAt}",id.lt.${after.id})`,
      );
    }
    query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
  }
  const { data, error } = await query.limit(PAGE);
  if (error) {
    console.error("[feed] load failed", error.code, error.message);
    return fail("Couldn't load the feed. Try again.");
  }
  const posts = data ?? [];
  const last = posts.at(-1);
  return {
    ok: true,
    data: {
      posts,
      next:
        posts.length === PAGE && last?.id && last.created_at
          ? { score: last.hot_score ?? 0, createdAt: last.created_at, id: last.id }
          : null,
    },
  };
}

const postSchema = z.object({
  space: z.string().regex(/^(campus|department:[0-9a-f-]{36})$/),
  body: z.string().trim().min(1, "Write something").max(2000, "Posts are up to 2,000 characters"),
  media: z
    .array(z.string().regex(/^posts\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/))
    .max(4)
    .default([]),
  poll: z.array(z.string().trim().min(1).max(80)).min(2).max(4).optional(),
  anonymous: z.boolean().default(false),
});

export async function createPost(
  input: z.input<typeof postSchema>,
): Promise<ActionResult<{ id: string; held: boolean }>> {
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your post");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  if (!s.profile?.guidelines_accepted_at) return fail(GUIDELINES_REQUIRED);
  const { space, body, media, poll, anonymous } = parsed.data;
  const check = await moderate(s.user.id, body, anonymous, "post");
  if (!check.ok) return fail(check.error);
  const { data, error } = await s.supabase.rpc("create_post", {
    p_space: space,
    p_body: body,
    p_media: media,
    p_poll: poll ? { options: poll } : undefined,
    p_anonymous: anonymous,
    ...check.params,
  });
  if (error || !data) return fail(friendly(error, "Couldn't post. Try again."));
  return { ok: true, data: { id: data, held: check.held } };
}

export async function votePost(post: string, value: -1 | 0 | 1): Promise<ActionResult> {
  if (!id.safeParse(post).success) return fail("Post not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("vote_post", { p_post: post, p_value: value });
  if (error) return fail(friendly(error, "Couldn't vote. Try again."));
  return { ok: true, data: undefined };
}

export async function votePoll(post: string, option: number): Promise<ActionResult> {
  if (!id.safeParse(post).success) return fail("Poll not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("vote_poll", { p_post: post, p_option: option });
  if (error) return fail(friendly(error, "Couldn't vote. Try again."));
  return { ok: true, data: undefined };
}

export async function deletePost(post: string): Promise<ActionResult> {
  if (!id.safeParse(post).success) return fail("Post not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("delete_post", { p_post: post });
  if (error) return fail("Couldn't delete. Try again.");
  return { ok: true, data: undefined };
}

const commentSchema = z.object({
  post: z.uuid(),
  body: z
    .string()
    .trim()
    .min(1, "Write a comment")
    .max(1000, "Comments are up to 1,000 characters"),
  parent: z.uuid().optional(),
  anonymous: z.boolean().default(false),
});

export async function createComment(
  input: z.input<typeof commentSchema>,
): Promise<ActionResult<{ id: string; held: boolean }>> {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Write a comment");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  if (!s.profile?.guidelines_accepted_at) return fail(GUIDELINES_REQUIRED);
  const { post, body, parent, anonymous } = parsed.data;
  const check = await moderate(s.user.id, body, anonymous, "comment");
  if (!check.ok) return fail(check.error);
  const { data, error } = await s.supabase.rpc("create_comment", {
    p_post: post,
    p_body: body,
    p_parent: parent,
    p_anonymous: anonymous,
    ...check.params,
  });
  if (error || !data) return fail(friendly(error, "Couldn't comment. Try again."));
  return { ok: true, data: { id: data, held: check.held } };
}

export async function deleteComment(comment: string): Promise<ActionResult> {
  if (!id.safeParse(comment).success) return fail("Comment not found");
  const s = await session();
  if (!s) return fail("Your session expired. Log in again.");
  const { error } = await s.supabase.rpc("delete_comment", { p_comment: comment });
  if (error) return fail("Couldn't delete. Try again.");
  return { ok: true, data: undefined };
}
