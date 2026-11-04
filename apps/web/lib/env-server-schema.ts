import { z } from "zod";
import { format, optional, publicSchema } from "./env";

/**
 * Server-only variables. Kept out of lib/env.ts so their names never reach a browser
 * bundle (Phase 10 security check); imported only by env.server.ts and its test.
 */
export const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: optional,
  UPSTASH_REDIS_REST_URL: optional,
  UPSTASH_REDIS_REST_TOKEN: optional,
  TURNSTILE_SECRET_KEY: optional,
  // Transactional email over SMTP: Gmail during development, Resend (smtp.resend.com) at launch.
  SMTP_HOST: optional,
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: optional,
  SMTP_PASSWORD: optional,
  EMAIL_FROM: optional,
  VAPID_PRIVATE_KEY: optional,
  VAPID_SUBJECT: optional,
  // Shared secret for scheduled jobs (/api/cron/*); Vercel Cron sends it as a Bearer token.
  CRON_SECRET: optional,
  // Shared with the database (app_private.config.push_secret) so only it can call /api/push.
  PUSH_WEBHOOK_SECRET: optional,
  // Phase 7: Claude (claude-haiku-5-5) for AI Buddy, moderation, timetable and proof checks.
  ANTHROPIC_API_KEY: optional,
  // "1" in CI: a deterministic stand-in for Claude and embeddings (no key, no cost).
  AI_FAKE: optional,
  // Signs moderation decisions; also stored as moderation_secret in app_private.config.
  MODERATION_SECRET: optional,
  AI_SERVICE_URL: optional,
  AI_SERVICE_HMAC_SECRET: optional,
  SENTRY_DSN: optional,
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid server environment variables:\n${format(result.error)}`);
  }
  return result.data;
}
