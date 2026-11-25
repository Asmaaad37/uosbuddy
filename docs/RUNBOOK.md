# UOSBuddy runbook

For the people who run UOSBuddy day to day: admins, student moderators, and whoever is on call.
Admin tools live at **/admin** (Me → Admin). Every admin and moderator action is recorded in the
audit log (shown on the dashboard).

## 1. Daily checks (10 minutes)

1. **Dashboard** (`/admin`): active students, open reports, verifications waiting.
2. **Verifications** (`/admin/verifications`): clear the queue (see §2).
3. **Reports** (`/admin/reports`): act on everything reported or held (see §3).
4. **Campus** (`/admin/campus`): women-only access requests and societies waiting.
5. Glance at Sentry (if set up) for new errors.

## 2. Verification

- **Target: every submission decided within 12 hours.** At semester start, add a second admin.
- The queue is sorted by the AI pre-check (highest confidence first). The pre-check is a hint
  only: always look at the document yourself.
- **Approve (A)** when the document is a UoS document showing the same name and roll or
  registration number the student typed.
- **Needs info (N)** when it's blurry, cropped, or the details don't match: say exactly what to
  fix (use the templates).
- **Reject (R)** for documents from another university, someone else's document, or clear
  edits. Flags like "Roll number used by another account" mean: check both accounts before
  approving.
- Documents are deleted automatically 30 days after the decision.

## 3. Moderation

| What                                                                     | Who handles it                  | Action                                      |
| ------------------------------------------------------------------------ | ------------------------------- | ------------------------------------------- |
| Spam, insults, off-topic in a feed                                       | Student moderator for that feed | Remove; warn if repeated                    |
| Harassment of a named person, private details shared                     | Admin                           | Remove at once; warn or ban                 |
| Threats of violence, self-harm, sexual content involving anyone under 18 | Admin, immediately              | Remove, ban, and escalate (§4)              |
| Selling exam papers, fake documents, scams                               | Admin                           | Remove and ban                              |
| Anonymous post breaking rules                                            | Admin or moderator              | Same as named: the author is shown to staff |
| A report that's wrong or petty                                           | Moderator                       | Dismiss reports                             |

- Content is held automatically after enough reports (posts: 5, or 2 if anonymous; files and
  listings: 3) and when AI moderation is unsure. Held content is visible only to its author
  ("Under review") until someone restores or removes it.
- **Warnings** send the student a notification with your message. Be specific and kind.
- **Bans** are admin-only. Write the reason; it's recorded. Unban from `/admin/users`.
- **Moderators** are appointed in `/admin/users` → Make moderator → pick their feeds. Choose
  trusted, active students; review their actions in the audit log monthly.

## 4. Escalation

1. **Someone may be in danger** (threats, self-harm): remove the content, ban if needed, and
   tell the university's student affairs office the same day. Point the student to the safety
   centre numbers (15 Police, 1122 Rescue, 1043 Punjab Women's Helpline).
2. **Legal requests** (police, university, court): don't hand over data on a phone call. Ask
   for the request in writing and decide with the project owner.
3. **A student asks for their data or deletion**: they can do both themselves in Me → Data.
   Deletion is final 14 days after they ask.

## 5. Incidents

**Site down or very slow**

1. Check Vercel (deployments, function errors) and Supabase (project status, database CPU).
2. If a deploy caused it, **roll back** in Vercel (Deployments → previous → Promote).
3. If the database is overloaded, check slow queries in Supabase → Reports, and the
   `admin-stats` / `award-badges` cron jobs.

**Something is overloaded or misbehaving** (launch fix 3)

Switch the feature off in `/admin/flags` (no redeploy; it takes effect at once):

| Switch             | What happens when it's off                                      |
| ------------------ | --------------------------------------------------------------- |
| `ai_buddy`         | AIBuddy shows "taking a short break"; nothing is sent to the AI |
| `chat`             | Chats stay readable; nobody can send                            |
| `timetable_alerts` | Publishing a timetable sends no alerts                          |
| `signups`          | No new accounts; existing students still log in                 |

Order when the app is slow: AIBuddy first, then chat.

**A secret leaked** (in a screenshot, a commit, a chat)

1. Rotate it immediately at its source: Supabase (service key / JWT), Anthropic, SMTP,
   Upstash, VAPID, `CRON_SECRET`, `PUSH_WEBHOOK_SECRET`, `MODERATION_SECRET`.
2. Update the value in Vercel and redeploy. For `MODERATION_SECRET` and the push secret, also
   update `app_private.config` in the SQL editor.
3. Note what happened and when.

**Data exposed by a bug**

1. Fix or switch off the feature (a feature flag in `/admin/flags`, or roll back).
2. Find out whose data and what was exposed (logs, audit log).
3. Tell the affected students what happened, plainly, within 72 hours.

**Spam wave or a bad actor making accounts**

1. Ban the accounts; check verification for shared documents or roll numbers.
2. Switch off anonymous posting in `/admin/flags` if it's being abused.
3. Rate limits (posts, messages, requests) already cap each account per day.

## 6. Scheduled jobs

| Job                                    | Where                                   | When (Pakistan time) |
| -------------------------------------- | --------------------------------------- | -------------------- |
| Backup expiry and housekeeping         | pg_cron `backup-housekeeping`           | every 10 minutes     |
| Event reminders                        | pg_cron `event-reminders`               | every 5 minutes      |
| Badges                                 | pg_cron `award-badges`                  | hourly               |
| Dashboard stats                        | pg_cron `admin-stats`                   | hourly               |
| Purge deleted accounts (after 14 days) | pg_cron `purge-deleted-accounts`        | 03:15 daily          |
| Documents, exports and orphan files    | Vercel Cron `/api/cron/purge-documents` | 02:30 daily          |
| Weekly digest email                    | Vercel Cron `/api/cron/weekly-digest`   | Sundays 19:00        |

Check pg_cron runs in the SQL editor: `select jobname, status, start_time from
cron.job_run_details order by start_time desc limit 20;`

## 7. Backups

- Supabase takes daily backups (Pro plan keeps 7 days; point-in-time recovery is an add-on).
- **Once a month, test a restore**: restore the latest backup into a new project, open it, and
  check a few tables have today's data. Note the date here.

| Restore tested | By  | Result |
| -------------- | --- | ------ |
|                |     |        |
