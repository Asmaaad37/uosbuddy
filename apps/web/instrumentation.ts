// Server error tracking. Disabled when SENTRY_DSN is unset.
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const [Sentry, { scrubEvent }] = await Promise.all([
    import("@sentry/nextjs"),
    import("@/lib/sentry-scrub"),
  ]);
  // No personal data: request bodies, cookies, headers and emails are stripped (launch fix 2).
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    beforeSend: (event) => scrubEvent(event),
    beforeSendTransaction: (event) => scrubEvent(event),
  });
}

export async function onRequestError(...args: unknown[]) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  // @ts-expect-error forwarded verbatim to Sentry's Next.js hook
  Sentry.captureRequestError(...args);
}
