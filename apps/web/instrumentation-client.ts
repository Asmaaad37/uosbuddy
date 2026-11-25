// Client error tracking. Disabled (and never downloaded) when NEXT_PUBLIC_SENTRY_DSN is unset.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  void Promise.all([import("@sentry/nextjs"), import("@/lib/sentry-scrub")]).then(
    ([Sentry, { scrubEvent }]) => {
      Sentry.init({
        dsn,
        tracesSampleRate: 0.1,
        beforeSend: (event) => scrubEvent(event),
        // Strip query strings from breadcrumbs: they can carry handles or invite codes.
        beforeBreadcrumb(crumb) {
          if (typeof crumb.data?.url === "string") crumb.data.url = crumb.data.url.split("?")[0];
          return crumb;
        },
      });
    },
  );
}
