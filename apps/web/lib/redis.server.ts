import "server-only";
import { Redis } from "@upstash/redis";
import { serverEnv } from "@/lib/env.server";

/** Upstash Redis, or null until its keys are set (everything that uses it then degrades). */
export const redis =
  serverEnv.UPSTASH_REDIS_REST_URL && serverEnv.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: serverEnv.UPSTASH_REDIS_REST_URL,
        token: serverEnv.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

/**
 * Read-through cache. Without Redis, or if it fails, `load` simply runs every time:
 * a cache outage should cost speed, not correctness.
 */
export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>) {
  if (!redis) return load();
  try {
    const hit = await redis.get<T>(key);
    if (hit !== null && hit !== undefined) return hit;
  } catch (error) {
    console.error(`[cache] read ${key} failed`, error);
    return load();
  }
  const value = await load();
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (error) {
    console.error(`[cache] write ${key} failed`, error);
  }
  return value;
}
