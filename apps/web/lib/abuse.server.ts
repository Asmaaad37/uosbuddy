import "server-only";
import { headers } from "next/headers";
import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { serverEnv } from "@/lib/env.server";

/**
 * Abuse protection for our own server actions (Phase 1 task 9, §3.6 point 5). Sign-up, codes
 * and password login go straight to Supabase Auth, which checks Turnstile itself.
 * Both pieces switch on when their keys are set and are no-ops without them.
 */

const LIMITS = {
  // Per student: a few retries, not a script hammering storage.
  proofUpload: { requests: 10, window: "1 h" },
  proofSubmit: { requests: 10, window: "1 h" },
  // Per IP: the waitlist is the one form anyone can submit without an account.
  waitlist: { requests: 5, window: "1 h" },
} satisfies Record<string, { requests: number; window: Duration }>;

export type LimitName = keyof typeof LIMITS;

const redis =
  serverEnv.UPSTASH_REDIS_REST_URL && serverEnv.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: serverEnv.UPSTASH_REDIS_REST_URL,
        token: serverEnv.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const limiters = new Map<LimitName, Ratelimit>();

/**
 * Sliding-window limit. Returns false when over the limit. Fails open when Redis is down:
 * an Upstash outage shouldn't lock students out; Supabase's own limits still apply.
 */
export async function withinLimit(name: LimitName, key: string): Promise<boolean> {
  if (!redis) return true;
  let limiter = limiters.get(name);
  if (!limiter) {
    const { requests, window } = LIMITS[name];
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(requests, window),
      prefix: `uosbuddy:rl:${name}`,
    });
    limiters.set(name, limiter);
  }
  try {
    return (await limiter.limit(key)).success;
  } catch (error) {
    console.error(`[rate-limit] ${name} check failed; allowing`, error);
    return true;
  }
}

/** The caller's IP as Vercel reports it (first hop of x-forwarded-for). */
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Verifies a Turnstile token server-side. Without a secret configured, every request passes. */
export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<boolean> {
  const secret = serverEnv.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(5000),
    });
    return ((await res.json()) as { success?: boolean }).success === true;
  } catch (error) {
    // Unlike the rate limiter this fails closed: an unverifiable request is treated as a bot.
    console.error("[turnstile] verification failed", error);
    return false;
  }
}
