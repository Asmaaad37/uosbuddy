import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  BUDDY_SYSTEM,
  FALLBACK,
  historyMessages,
  parseSource,
  questionContent,
  type Excerpt,
  type Source,
} from "@/lib/ai/buddy";
import { MODEL, aiEnabled, aiFake, claude } from "@/lib/ai/claude.server";
import { embed, toVector } from "@/lib/ai/embed.server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  threadId: z.uuid().optional(),
  courseId: z.uuid(),
  message: z.string().trim().min(1).max(2000),
});

/** One line of the answer stream (NDJSON). */
export type BuddyEvent =
  | { type: "thread"; threadId: string }
  | { type: "text"; text: string }
  | { type: "source"; source: Source }
  | { type: "done"; remaining: number }
  | { type: "error"; error: string };

const json = (status: number, error: string) => NextResponse.json({ error }, { status });

/**
 * Phase 7 task 3: AI Buddy. Searches the course's files, then streams Claude Haiku's answer
 * with citations. Quota and course access are enforced in the database.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, "Ask a question (up to 2,000 characters).");
  if (!aiEnabled()) return json(503, "AI Buddy isn't switched on yet.");
  const { supabase, user } = await getSession();
  if (!user) return json(401, "Your session expired. Log in again.");
  const { courseId, message } = parsed.data;

  const { data: enrolled } = await supabase.rpc("my_courses");
  if (!enrolled?.some((c) => c.id === courseId)) return json(403, "Add this course first.");

  // An existing thread must be the student's own (RLS) and about this course: a thread can't
  // carry one course's conversation into another course's files.
  let threadId = parsed.data.threadId;
  if (threadId) {
    const { data: t } = await supabase
      .from("ai_threads")
      .select("id, course_id")
      .eq("id", threadId)
      .maybeSingle();
    if (!t || t.course_id !== courseId) return json(404, "Chat not found.");
  }

  const { data: remaining, error: quotaError } = await supabase.rpc("use_ai", { p_kind: "buddy" });
  if (quotaError) {
    return json(
      quotaError.code === "54000" ? 429 : 400,
      quotaError.code === "54000" ? quotaError.message : "Couldn't start. Try again.",
    );
  }
  // A question that fails, or never reaches the model, gives the student their go back.
  let refunded = false;
  const refund = async () => {
    if (refunded) return;
    refunded = true;
    await createAdminClient().rpc("refund_ai", { p_user: user.id, p_kind: "buddy" });
  };

  // The thread (new or the student's own) and their message.
  if (!threadId) {
    const { data: t, error } = await supabase
      .from("ai_threads")
      .insert({ user_id: user.id, course_id: courseId, title: message.slice(0, 80) })
      .select("id")
      .single();
    if (error || !t) {
      await refund();
      return json(500, "Couldn't start a chat. Try again.");
    }
    threadId = t.id;
  }
  const { data: history } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(10);
  await supabase
    .from("ai_messages")
    .insert({ thread_id: threadId, role: "user", content: message });

  // Search the course's files: by meaning (when embeddings are up) and by keywords.
  const {
    data: { session: auth },
  } = await supabase.auth.getSession();
  const [vector] = (await embed([message], auth?.access_token ?? "")) ?? [];
  const { data: found } = await supabase.rpc("search_course_chunks", {
    p_course: courseId,
    p_query: message,
    p_embedding: vector ? toVector(vector) : undefined,
    p_k: 6,
  });
  const excerpts: Excerpt[] = found ?? [];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: BuddyEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      const sources: Source[] = [];
      const seen = new Set<string>();
      const addSource = (source: string, title: string | null, quote: string) => {
        const where = parseSource(source);
        if (!where || seen.has(source)) return;
        seen.add(source);
        const s = { ...where, title: title ?? "Course file", quote: quote.slice(0, 300) };
        sources.push(s);
        send({ type: "source", source: s });
      };
      let answer = "";
      let usage: { input_tokens: number; output_tokens: number } | null = null;
      send({ type: "thread", threadId: threadId! });

      try {
        if (!excerpts.length) {
          // Nothing in the course's files matches: say so without spending a model call,
          // or the student's daily allowance.
          answer = FALLBACK;
          send({ type: "text", text: answer });
          await refund();
        } else if (aiFake()) {
          const top = excerpts[0]!;
          answer = `From your course files: ${top.content.slice(0, 200)}`;
          send({ type: "text", text: answer });
          addSource(
            `resource:${top.resource_id}${top.page ? `#p${top.page}` : ""}`,
            top.resource_title,
            top.content,
          );
        } else {
          const messages: Anthropic.MessageParam[] = [
            ...historyMessages(history ?? []),
            { role: "user", content: questionContent(message, excerpts) },
          ];
          const response = claude().messages.stream({
            model: MODEL,
            // A cost cap for a study answer; Haiku 5.5's thinking shares this budget.
            max_tokens: 8000,
            output_config: { effort: "medium" },
            // No prompt caching: each question carries different excerpts, so a cache entry
            // would be written at 1.25x the input price and never read back.
            system: BUDDY_SYSTEM,
            messages,
          });
          for await (const event of response) {
            if (event.type !== "content_block_delta") continue;
            if (event.delta.type === "text_delta") {
              answer += event.delta.text;
              send({ type: "text", text: event.delta.text });
            } else if (event.delta.type === "citations_delta") {
              const c = event.delta.citation;
              if (c.type === "search_result_location") addSource(c.source, c.title, c.cited_text);
            }
          }
          const final = await response.finalMessage();
          usage = final.usage;
          if (final.stop_reason === "refusal") {
            const note = "\n\nI can't help with that one.";
            answer += note;
            send({ type: "text", text: note });
          }
        }
        await supabase.from("ai_messages").insert({
          thread_id: threadId!,
          role: "assistant",
          content: answer || FALLBACK,
          sources,
          tokens_in: usage?.input_tokens ?? null,
          tokens_out: usage?.output_tokens ?? null,
        });
        await supabase
          .from("ai_threads")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", threadId!);
        send({ type: "done", remaining: (remaining ?? 0) + (refunded ? 1 : 0) });
      } catch (error) {
        console.error(
          "[buddy] answer failed",
          error instanceof Anthropic.APIError ? error.status : error,
        );
        await refund().catch(() => {});
        send({
          type: "error",
          error:
            error instanceof Anthropic.RateLimitError
              ? "AI Buddy is busy right now. Try again in a minute."
              : "AI Buddy couldn't answer. Try again.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
