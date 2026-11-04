# Security review (Phase 10)

What protects students' data in UOSBuddy, and how each guarantee is checked. Re-check this list
before every major release.

## Access control

| Guarantee                                               | How it's enforced                                                                                 | Checked by                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Every table has row-level security                      | RLS on all `public` tables; reads by policy, writes only through security-definer functions       | pgTAP `140_security` (fails if any table lacks RLS) and `supabase db lint` in CI |
| Privileged functions can't be hijacked                  | Every security-definer function sets `search_path = ''`                                           | pgTAP `140_security`                                                             |
| Signed-out visitors can't write                         | No anon write grants except the university waitlist                                               | pgTAP `140_security`                                                             |
| Secrets in the database stay private                    | `app_private.config` is unreachable from the API roles                                            | pgTAP `140_security`                                                             |
| Students see only what privacy allows                   | Views (`profiles_public`, `posts_public`…) and functions apply `visible_at`, blocks and anonymity | pgTAP `020`–`130`                                                                |
| Women-only rides stay women-only                        | RLS plus admin-confirmed access                                                                   | pgTAP `120_campus`                                                               |
| Admin and moderator actions are accountable             | Every one writes `audit_log`                                                                      | pgTAP `130_trust`                                                                |
| Moderation can't be skipped by calling the API directly | AI decisions are HMAC-signed and verified in SQL                                                  | pgTAP `110_ai`                                                                   |

Middleware redirects are a convenience only; the database is the security boundary.

## Secrets

- Server-only keys (service role, Anthropic, SMTP, VAPID private, cron, push and moderation
  secrets) are read only in `*.server.ts` modules. Their schema lives in
  `lib/env-server-schema.ts`, so not even their names reach the browser.
- **CI fails** if any server variable name appears in `.next/static`.
- Cron routes and the push webhook fail closed without their secret, and compare tokens in
  constant time.
- Rotation steps: `docs/RUNBOOK.md` §5.

## Rate limits on writes

Enforced in the database (so they hold even when the API is called directly; errcode 54000):

| Action              | Limit                                             |
| ------------------- | ------------------------------------------------- |
| Posts               | 10 a day (3 anonymous)                            |
| Messages            | 60 a minute                                       |
| Connection requests | 30 a day                                          |
| Backup requests     | 5 a day                                           |
| Course files        | 20 a day; new courses 10 a day; 12 courses a term |
| Study groups        | 3 a day; mentor requests 5 a day; pings 10 a day  |
| Rides               | 5 a day; seat requests 20 a day                   |
| Listings            | 10 a day; societies 2 a day; events 5 a day       |
| AI                  | 30 Buddy questions and 10 timetable imports a day |
| Data export         | 1 a day                                           |

Enforced in the app with Upstash (per user, or per IP for the waitlist): proof uploads and
submissions 10 an hour, UoS-email codes 5 an hour (20 checks), reports 20 a day, waitlist 5
an hour. Sign-up, login and email codes go through Supabase Auth with Turnstile captcha.

## Headers

Strict-Transport-Security, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, nosniff,
strict referrer policy, a narrow Permissions-Policy, and a Content-Security-Policy that limits
scripts, connections and frames to our origin, Supabase, Turnstile, PostHog and Sentry.

**Known gap:** `script-src` still allows `'unsafe-inline'` because Next.js inlines its bootstrap
scripts. A nonce-based policy would make every page dynamic (no static legal or offline pages,
no offline cache). Risk is low: React escapes all output, and the only raw HTML is our own
theme script in the root layout. Revisit if user-generated HTML is ever rendered.

## Dependencies

- `pnpm audit --prod --audit-level high` runs in CI.
- `postcss` is pinned (pnpm override) to a patched version for Next.js.
- Accepted for now (moderate, build-time only): `glob` and `minimatch` inside Sentry's
  build plugin. They only process our own source files during the build. Upgrade once
  patched versions meet the two-week age rule.
- New dependencies must have been published at least two weeks earlier.

## Privacy

- Verification documents are deleted 30 days after the decision; exports after 7 days.
- Account deletion: hidden immediately, purged after 14 days (pgTAP time-travel test).
- AI calls send the minimum (the question and course excerpts; the document being checked);
  files are treated as data, never instructions.
