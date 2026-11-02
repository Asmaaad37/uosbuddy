import "server-only";
import { publicEnv } from "@/lib/env";
import { aiFake } from "./claude.server";

export const DIMENSIONS = 384;

/**
 * A stand-in embedding for CI: words hashed into 384 buckets, normalised. Texts sharing
 * words point the same way, which is enough to exercise search end to end.
 */
export function fakeEmbedding(text: string): number[] {
  const v = new Array<number>(DIMENSIONS).fill(0);
  for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    let h = 2166136261;
    for (let i = 0; i < word.length; i++) h = Math.imul(h ^ word.charCodeAt(i), 16777619);
    v[Math.abs(h) % DIMENSIONS]! += 1;
  }
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

/**
 * Embeddings from Supabase's built-in gte-small model (English, 384 dimensions), via the
 * `embed` Edge Function, called with the signed-in student's access token. Returns null
 * when it can't be reached, so callers fall back to keyword search instead of failing.
 */
export async function embed(texts: string[], accessToken: string): Promise<number[][] | null> {
  if (!texts.length) return [];
  if (aiFake()) return texts.map(fakeEmbedding);
  const key = accessToken;
  if (!key) return null;
  try {
    const res = await fetch(`${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        apikey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ texts }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.error("[embed] function returned", res.status);
      return null;
    }
    const { embeddings } = (await res.json()) as { embeddings: number[][] };
    return embeddings?.length === texts.length ? embeddings : null;
  } catch (error) {
    console.error("[embed] failed", error);
    return null;
  }
}

/** pgvector's text form: "[0.1,0.2,…]". */
export const toVector = (v: number[]) => `[${v.map((x) => x.toFixed(6)).join(",")}]`;
