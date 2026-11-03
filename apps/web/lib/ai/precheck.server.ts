import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Json } from "@uosbuddy/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODEL, aiEnabled, aiFake, claude, fileBlock } from "./claude.server";
import { PRECHECK_SYSTEM, extractionSchema, score, type Extraction } from "./precheck";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

/**
 * Phase 7 task 5: read a student's pending proof and store `ai_precheck` for the admin
 * queue. Runs after the response; failures only leave the request unscored.
 */
export async function precheckVerification(userId: string) {
  if (!aiEnabled()) return;
  const db = createAdminClient();
  const { data: req } = await db
    .from("verification_requests")
    .select("id, doc_path, roll_no_submitted, full_name_submitted")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!req?.doc_path) return;

  try {
    let extracted: Extraction;
    if (aiFake()) {
      // CI stand-in: the document "says" what the student typed.
      extracted = {
        name: req.full_name_submitted,
        roll_no: req.roll_no_submitted,
        university: "University of Sargodha",
        session: null,
        department: null,
        document_type: "Test document",
        readable: true,
        looks_edited: false,
      };
    } else {
      const mime = MIME[req.doc_path.split(".").pop()?.toLowerCase() ?? ""];
      if (!mime) return;
      const { data: file, error } = await db.storage
        .from("verification-docs")
        .download(req.doc_path);
      if (error || !file) throw new Error(`download failed: ${error?.message}`);
      const response = await claude().messages.parse({
        model: MODEL,
        max_tokens: 4000,
        output_config: { effort: "low", format: zodOutputFormat(extractionSchema) },
        system: PRECHECK_SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              fileBlock(Buffer.from(await file.arrayBuffer()), mime),
              { type: "text", text: "Read this proof document." },
            ],
          },
        ],
      });
      if (!response.parsed_output) throw new Error(`no extraction (${response.stop_reason})`);
      extracted = response.parsed_output;
    }

    // The same roll number on another account's open or approved request.
    const { data: dup } = req.roll_no_submitted
      ? await db
          .from("verification_requests")
          .select("user_id")
          .eq("roll_no_submitted", req.roll_no_submitted)
          .neq("user_id", userId)
          .in("status", ["pending", "needs_info", "verified"])
          .limit(1)
          .maybeSingle()
      : { data: null };

    const result = score(
      extracted,
      { name: req.full_name_submitted, rollNo: req.roll_no_submitted },
      dup?.user_id ?? null,
    );
    await db
      .from("verification_requests")
      .update({ ai_precheck: result as unknown as Json })
      .eq("id", req.id);
  } catch (error) {
    console.error("[precheck] failed", error instanceof Error ? error.message : error);
  }
}
