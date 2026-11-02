import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { serverEnv } from "@/lib/env.server";
import { MODEL, aiEnabled, aiFake, claude } from "./claude.server";
import {
  MODERATION_SYSTEM,
  fakeModeration,
  moderationPrompt,
  moderationSchema,
  signDecision,
  type Kind,
  type Moderation,
} from "./moderation";

export type ModerationResult =
  | { ok: false; error: string }
  | { ok: true; held: boolean; params: { p_mod_token?: string; p_mod_status?: string } };

async function classify(body: string, anonymous: boolean, kind: Kind): Promise<Moderation> {
  if (aiFake()) return fakeModeration(body);
  const response = await claude().messages.parse({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(moderationSchema) },
    cache_control: { type: "ephemeral" },
    system: MODERATION_SYSTEM,
    messages: [{ role: "user", content: moderationPrompt(body, anonymous, kind) }],
  });
  if (response.stop_reason === "refusal") {
    return { decision: "hold", categories: ["other"], reason: "Model declined to label it" };
  }
  if (!response.parsed_output) throw new Error("No moderation label");
  return response.parsed_output;
}

/**
 * Phase 7 task 4: label a post or comment before it's saved. Off (everything published)
 * until MODERATION_SECRET is set. If the label can't be fetched, the post is held for a
 * moderator rather than published unchecked.
 */
export async function moderate(
  userId: string,
  body: string,
  anonymous: boolean,
  kind: Kind,
): Promise<ModerationResult> {
  const secret = serverEnv.MODERATION_SECRET;
  if (!secret) return { ok: true, held: false, params: {} };

  let label: Moderation = { decision: "allow", categories: [], reason: "" };
  if (aiEnabled()) {
    try {
      label = await classify(body, anonymous, kind);
    } catch (error) {
      console.error("[moderation] label failed", error instanceof Error ? error.message : error);
      label = { decision: "hold", categories: ["other"], reason: "Label unavailable" };
    }
  }
  if (label.decision === "block") {
    return {
      ok: false,
      error: "This breaks the community rules, so it wasn't posted. Edit it and try again.",
    };
  }
  const status = label.decision === "hold" ? "held" : "published";
  return {
    ok: true,
    held: status === "held",
    params: { p_mod_token: signDecision(userId, body, status, secret), p_mod_status: status },
  };
}
