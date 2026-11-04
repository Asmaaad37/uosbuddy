# Deploying UOSBuddy to production

A checklist for the first production launch. Keys and passwords go only into Vercel's
environment settings or the Supabase dashboard, never into the repository or a chat.

**Environments**

|                   | Database                                           | Web app                               | Who uses it |
| ----------------- | -------------------------------------------------- | ------------------------------------- | ----------- |
| Development       | Supabase `pjddiybbcpiywusglysc` (Mumbai)           | `pnpm dev` on your PC                 | You         |
| Preview / staging | The development project (or a second free project) | Vercel preview deployments (every PR) | Testers     |
| Production        | A **new** Supabase project, Pro plan               | Vercel production (your domain)       | Students    |

The AI runs inside the web app (Claude), so there's no separate AI server to host; `apps/ai`
stays as a placeholder.

## 1. Supabase production project

1. Create a project in **Mumbai (ap-south-1)**, Pro plan (daily backups, no pausing). Save the
   database password in a password manager.
2. Apply the schema from your PC:
   ```sh
   npx supabase link --project-ref <prod-ref>
   pnpm db:push
   ```
   Then relink to development afterwards (`pnpm db:link`) so day-to-day work never touches
   production.
3. Deploy the embedding function (JWT check stays on):
   ```sh
   npx supabase functions deploy embed --project-ref <prod-ref> --use-api
   ```
4. **Auth settings** (Dashboard → Authentication):
   - Site URL: `https://<your-domain>`; redirect URLs: `https://<your-domain>/auth/*`.
   - Email: custom SMTP (Resend with your domain is recommended over Gmail's 500/day cap);
     paste the email templates you use in development.
   - Captcha: Turnstile, with the secret key.
5. **Private config** (SQL editor), using fresh random values:
   ```sql
   insert into app_private.config values
     ('push_url', 'https://<your-domain>/api/push'),
     ('push_secret', '<same as PUSH_WEBHOOK_SECRET>'),
     ('moderation_secret', '<same as MODERATION_SECRET>');
   ```
6. Check scheduled jobs exist: `select jobname, schedule from cron.job;` (5 jobs; see the
   runbook).

## 2. Vercel

1. Import the GitHub repository. **Root directory: `apps/web`**, framework Next.js.
2. Production environment variables (mark everything except `NEXT_PUBLIC_*` as Sensitive):

   | Variable                                                                                      | Where it comes from                                                  |
   | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`      | Supabase → Project settings → API                                    |
   | `NEXT_PUBLIC_SITE_URL`                                                                        | `https://<your-domain>`                                              |
   | `NEXT_PUBLIC_SUPPORT_EMAIL`                                                                   | A shared support inbox (not a personal address)                      |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`                          | Your email provider                                                  |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`                                      | Cloudflare Turnstile                                                 |
   | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                          | Upstash (rate limits)                                                |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`                          | `npx web-push generate-vapid-keys`; subject `mailto:<support inbox>` |
   | `CRON_SECRET`, `PUSH_WEBHOOK_SECRET`, `MODERATION_SECRET`                                     | New random values (e.g. `openssl rand -hex 32`)                      |
   | `ANTHROPIC_API_KEY`                                                                           | Anthropic console (set a monthly spend limit)                        |
   | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Optional                                                             |

   Preview environment: the same names, pointing at the development project, with
   `AI_FAKE=1` unless you want real AI in previews.

3. Add your domain and wait for HTTPS. Crons in `vercel.json` start automatically on
   production deployments.

## 3. First run

1. Sign up with your own account, then make it an admin from your PC (with the production
   keys in a temporary env file, deleted afterwards): `pnpm admin:grant you@example.com`.
2. Smoke test on a phone: sign up with a UoS email, upload a proof with another account and
   approve it, post, chat, ask AI Buddy about a shared PDF, install to the home screen, and
   receive a push.
3. Check `/admin` shows the activity, and that a test report appears in `/admin/reports`.

## 4. Before announcing

- [ ] Lighthouse ≥ 90 on the production URL (mobile)
- [ ] Safety centre numbers and ride areas confirmed
- [ ] Privacy, terms and guidelines read by the project owner
- [ ] Support inbox monitored; at least two admins
- [ ] A backup restore tested (runbook §7)
- [ ] Anthropic spend limit and Supabase usage alerts set
