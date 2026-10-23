// Server error tracking. Disabled when SENTRY_DSN is unset.
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({ dsn, tracesSampleRate: 0.1 });
}

export async function onRequestError(...args: unknown[]) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  // @ts-expect-error forwarded verbatim to Sentry's Next.js hook
  Sentry.captureRequestError(...args);
}
