import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/lib/env.server";

/** Every AI feature uses Claude Haiku 5.5: the fast, low-cost model (Phase 7 decision). */
export const MODEL = "claude-haiku-5-5";

let client: Anthropic | undefined;

/** "1" in CI: deterministic stand-ins instead of real calls (no key, no cost). */
export const aiFake = () => serverEnv.AI_FAKE === "1";

/** AI features are on when a key is set (or the CI fake is). */
export const aiEnabled = () => aiFake() || !!serverEnv.ANTHROPIC_API_KEY;

export function claude() {
  if (!serverEnv.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  client ??= new Anthropic({ apiKey: serverEnv.ANTHROPIC_API_KEY, maxRetries: 2 });
  return client;
}

/** The text of a response, read by block type (Haiku 5.5 can start with thinking blocks). */
export function textOf(message: Anthropic.Message) {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** A PDF or photo as a content block (base64). */
export function fileBlock(
  data: Buffer,
  mime: string,
): Anthropic.DocumentBlockParam | Anthropic.ImageBlockParam {
  if (mime === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: data.toString("base64") },
    };
  }
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: mime as "image/jpeg" | "image/png" | "image/webp",
      data: data.toString("base64"),
    },
  };
}
