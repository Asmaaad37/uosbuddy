import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "./env";
import { parseServerEnv } from "./env-server-schema";

const base = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
};

describe("env", () => {
  it("accepts the minimum required public vars and defaults the site URL", () => {
    const env = parsePublicEnv(base);
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    expect(env.NEXT_PUBLIC_POSTHOG_KEY).toBeUndefined();
  });

  it("treats empty optional keys as unset, so services stay disabled", () => {
    const env = parseServerEnv({ ...base, SENTRY_DSN: "", UPSTASH_REDIS_REST_URL: "  " });
    expect(env.SENTRY_DSN).toBeUndefined();
    expect(env.UPSTASH_REDIS_REST_URL).toBeUndefined();
  });

  it("fails loudly with the variable name when a required var is missing", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "not-a-url" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL[\s\S]*NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });
});
