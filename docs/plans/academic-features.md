# Plan: official academic data (timetable, free rooms, calendar, department hub)

**Status: proposal for approval, updated with the project owner's answers (2026-11-17, §6).** Nothing here is built or applied.

- **Research:** `docs/research/vtable-rea.md`, `docs/research/csdeptuos-rea.md` and `docs/research/ta1al-repos-analysis.md`.
- **Design:** follows `docs/design/UOSBuddy_REDESIGN_SPEC.md`.
- **Scope:** CS department first.

## 0. Where we start from

Already built:

- **Personal timetable:** `timetable_slots`, manual entry and AI screenshot import.
- **Free together** and **Who's free now.**
- **GPA calculator** with the UoS grading bands.
- **Courses:** catalogue, enrollments per term, course chats and study groups.
- **Resources and AI Buddy search.**
- **Society events** with .ics export and reminders.
- **Notifications** with push and per-category preferences.
- **Admin, moderators and the audit log.**
- **Profiles** with `department_id`, `program_id`, `batch_year`, `semester`, `section` (REG / SS1 / SS2) and `shift`.

What's missing is **official, shared academic data** with an owner, a review step and change alerts. Every feature below builds on that data.

## 1. Feature matrix

**Priority:** P0 must-have for the first release of this phase, P1 next, P2 later, P3 nice-to-have.
**Effort:** S about a day, M 2–4 days, L a week or more.

| #   | Feature                                                                                                                     | Priority | Phase | Data source                                                                 | Effort |
| --- | --------------------------------------------------------------------------------------------------------------------------- | -------- | ----- | --------------------------------------------------------------------------- | ------ |
| 1   | Data model: terms, buildings, rooms, teachers, class groups, timetable entries, versioning                                  | P0       | 11.1  | —                                                                           | M      |
| 2   | Admin **import flow**: upload PDF → our parser → preview diff → approve → publish                                           | P0       | 11.1  | Official weekly PDF (or a CSV/Excel export, if the department can give one) | L      |
| 3   | **My week** from official data (auto-matched from the profile; manual override; "repeat course" add-ons)                    | P0       | 11.2  | Published entries                                                           | M      |
| 4   | **Now / Next class** card on Explore (course, room, teacher, starts in…)                                                    | P0       | 11.2  | Published entries                                                           | S      |
| 5   | **Change alerts** (moved or cancelled class → push)                                                                         | P1       | 11.3  | Import diff                                                                 | M      |
| 6   | **Lookup** (any class group), **teacher view**, **room view**                                                               | P1       | 11.3  | Published entries                                                           | M      |
| 7   | **Free room finder** (now or a chosen time; free until; freeing soon; building and floor)                                   | P1       | 11.3  | Entries + the full room list                                                | M      |
| 8   | **Academic calendar** (list, month, next 3 dates on Explore, .ics, reminders)                                               | P1       | 11.4  | Official calendar, entered or imported by an editor                         | M      |
| 9   | Existing **Free together / Free now** switched to official data (fall back to personal slots)                               | P1       | 11.4  | Entries + `timetable_slots`                                                 | S      |
| 10  | **Department data editors** (per department, trusted students or CRs) + audit                                               | P0       | 11.1  | —                                                                           | S      |
| 11  | **Department hub**: faculty directory (links to su.edu.pk), programs and study plans (links), societies (existing), notices | P2       | 11.5  | Editor-entered + official links                                             | M      |
| 12  | Crowd-sourced **"actually occupied"** room reports, moderated                                                               | P2       | 11.5  | Students                                                                    | S      |
| 13  | **Exam schedule** (source: REA, vtable "Exams")                                                                             | P2       | later | Official exam schedule                                                      | M      |
| 14  | **GPA grade predictor**, "what do I need next semester" (source: REA, csdeptuos CGPA)                                       | P2       | later | Client-side                                                                 | S      |
| 15  | **Share my week as an image or to Google Calendar** (source: REA, csdeptuos timetable)                                      | P3       | later | Entries                                                                     | S      |
| 16  | **FYP showcase**                                                                                                            | P3       | later | Editor-entered                                                              | M      |

**Out of scope:**

- exam seating plans, until UoS publishes them;
- copying any data from csdeptuos.netlify.app or vtable.site;
- a parallel news site (notices stay short, linking to official pages).

## 2. User stories (by feature)

- **My week.**
  - As a verified CS student, I open Timetable and see _my_ week straight away, with no picking, because my department, program, intake year and section are on my profile.
  - As a student repeating a course, I add that course's other section to my week.
- **Now / Next.** As a student between classes, Explore tells me "Next: Database Systems · 11:00 · MAB CR-161 · Dr. Shehzad · in 25 min".
- **Change alerts.** When this week's timetable moves my Tuesday class to another room, I get a push: "Database Systems moved to MAB CR-163 on Tue 11:00".
- **Lookup, teacher and room views.**
  - As a student, I look up another section's timetable before swapping.
  - I see a teacher's week to find them.
  - I see a room's day before booking a study session.
- **Free rooms.** At 12:40 I ask "free now in MAB" and get rooms free until 14:00, plus "CR-162 frees in 10 min".
- **Calendar.**
  - I see the next 3 deadlines (add/drop, withdraw, mid-terms) on Explore, get a reminder 2 days before each, and can export the term to my phone calendar.
- **Data editor.** As the CS data editor, I upload this week's PDF, review "12 classes changed, 3 rooms renamed", fix two names, and publish. Students are notified.
- **Admin.** I appoint and remove data editors per department, and see every import and edit in the audit log.

## 3. Screens and where they live

| Screen                          | Route                                             | Navigation                                               | Spec components                                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Timetable hub**               | `/timetable` (exists, becomes official-first)     | Explore shortcut "Timetable" (exists)                    | `ScreenHeader` + `SegmentedControl`: **My week · Lookup · Rooms · People free**                                                                                                     |
| My week                         | `/timetable`                                      | Default segment                                          | Day chips Mon–Sat; a grouped list per day (time, course, room · teacher); a "Last updated {date} by CS data editors" footnote; personal slots marked "Added by you"                 |
| Lookup                          | `/timetable?tab=lookup`                           | Segment                                                  | Cascading `Chip` rows: Program → Intake (session) → Section → Day, with next-step empty states (as vtable does, without the blocking modals)                                        |
| Teacher view / Room view        | `/timetable/teacher/[id]`, `/timetable/room/[id]` | From any row                                             | Grouped list by day; room view shows building, floor and capacity                                                                                                                   |
| **Free rooms**                  | `/timetable?tab=rooms`                            | Segment; also an Explore row "Find a free room"          | A "Now · slot 11:00–12:30" banner; building `Chip`s with free counts; a grouped list (room, floor, "free until 14:00" or "frees in 10 min"); a time picker for another day and time |
| **Now / Next card**             | Explore                                           | A card under the batch card                              | `Card`: overline "NEXT CLASS", 17/600 course, room and teacher, "in 25 min"; empty state "No more classes today"                                                                    |
| **Calendar**                    | `/calendar`                                       | An Explore card "Coming up" (next 3 dates) → full screen | `SegmentedControl` **List · Month**; grouped list by month; "Add to calendar" (.ics); per-item reminder toggle                                                                      |
| **Department hub**              | `/department`                                     | An Explore grouped-list row "Your department"            | Grouped lists: Faculty (links to su.edu.pk profiles), Programs and study plans (links), Societies (existing pages), Notices                                                         |
| Data editor: imports            | `/admin/timetable` (and `/admin/calendar`)        | Admin nav (editors see only their department)            | Upload, then a diff preview (added / removed / moved / renamed, with counts), alias fixing, then **Publish**                                                                        |
| Data editor: rooms and teachers | `/admin/timetable/rooms`, `/teachers`             | Admin nav                                                | Alias tables (room label → canonical room; teacher name → teacher)                                                                                                                  |

**Empty states (never a blank screen):**

- **No data for this term:** "CS timetable for Fall 2026 isn't published yet. Your data editors are on it. Meanwhile, add your own classes." with a button **Add my classes**, which opens the existing personal timetable.
- **Profile not matched to a section:** "Tell us your section to see your week", linking to studies.
- **Outside teaching hours (rooms):** "Classes run 08:00–18:30. Pick a time to plan ahead."
- **Loading:** skeleton rows, not "nothing here".

**Motion and themes:**

- Segmented changes, sheets and reduced motion follow spec §6.
- Tokens only; dark and light themes come for free from the existing components.

## 4. Data strategy

### 4.1 Proposed SQL migrations (not applied)

```sql
-- 4.1.a Terms (the existing "2026-fall" codes stay the key, so enrollments keep working).
create table public.academic_terms (
  code text primary key check (code ~ '^[0-9]{4}-(fall|spring|summer)$'),
  university_id uuid not null references public.universities,
  name text not null,                         -- "Fall 2026"
  starts_on date, ends_on date
);

-- 4.1.b Places.
create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities,
  code text not null,                         -- "MAB", "IAH", "SSB"
  name text not null,                         -- "Main Academic Block"
  campus_id uuid references public.campuses,
  unique (university_id, code)
);
create type public.room_kind as enum ('lecture', 'lab', 'hall', 'online', 'office', 'other');
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  building_id uuid references public.buildings,
  code text not null,                         -- canonical: "CR-160", "L-04", "Smart Lab"
  name text,                                  -- display: "MAB CR-160"
  floor smallint, capacity smallint,
  kind public.room_kind not null default 'lecture',
  department_id uuid references public.departments,   -- owner, when known
  aliases text[] not null default '{}',       -- every printed variant seen in imports
  unique (building_id, code)
);

-- 4.1.c People (teachers are public on official timetables; link to official profiles only).
create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments,
  name text not null,
  title text,                                 -- "Assistant Professor"
  profile_url text check (profile_url ~ '^https://su\.edu\.pk/'),
  aliases text[] not null default '{}'
);

-- 4.1.d Who a class is for: matches a profile's department, program, intake and section.
create table public.class_groups (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments,
  program_id uuid references public.programs,
  intake_year smallint not null,              -- from "2024-2028"
  section text not null,                      -- 'REG' | 'SS1' | 'SS2' (same codes as profiles)
  label text not null,                        -- "BS CS · 2024 · Regular 1"
  unique (department_id, program_id, intake_year, section)
);

-- 4.1.e Imports and their staged rows (nothing is live until published).
create type public.import_status as enum ('parsing', 'review', 'published', 'discarded', 'failed');
create table public.timetable_imports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  department_id uuid not null references public.departments,
  term text not null references public.academic_terms,
  week_of date,                               -- null = the term timetable (the usual case); a date = a one-week amendment
  file_path text,                             -- private bucket "timetable-imports"
  source_kind text not null check (source_kind in ('pdf', 'csv', 'xlsx', 'manual')),
  parser_version text not null,
  status public.import_status not null default 'parsing',
  report jsonb,                               -- pages, rooms, sessions, warnings
  diff_summary jsonb,                         -- {added, removed, moved, retimed, renamed}
  created_by uuid references public.profiles,
  published_by uuid references public.profiles,
  published_at timestamptz
);
create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.timetable_imports on delete cascade,
  class_group_id uuid references public.class_groups,
  course_id uuid references public.courses,
  course_code text, course_title text not null,
  teacher_id uuid references public.teachers, teacher_name text,
  room_id uuid references public.rooms, room_label text not null,
  day smallint not null check (day between 0 and 6),            -- 0 = Monday (as timetable_slots)
  start_min smallint not null, end_min smallint not null check (start_min < end_min),
  practical boolean not null default false,
  combined_key text,                          -- same value on every group of a combined class
  stable_key text not null,                   -- group + course + day + start, for diffs
  raw jsonb                                   -- parser output for this row (audit, re-parse)
);
create index timetable_entries_group_idx on public.timetable_entries (class_group_id, day, start_min);
create index timetable_entries_room_idx on public.timetable_entries (room_id, day, start_min);

-- What's live: the latest published import per department, term and week.
create view public.timetable_live with (security_invoker = true) as
  select e.* from public.timetable_entries e
  join public.timetable_imports i on i.id = e.import_id and i.status = 'published'
  where not exists (select 1 from public.timetable_imports n
                    where n.department_id = i.department_id and n.term = i.term
                      and n.week_of is not distinct from i.week_of and n.status = 'published'
                      and n.published_at > i.published_at);

-- 4.1.f Change history (drives alerts and "what changed" in the UI).
create table public.timetable_changes (
  id bigint generated always as identity primary key,
  import_id uuid not null references public.timetable_imports on delete cascade,
  class_group_id uuid references public.class_groups,
  kind text not null check (kind in ('added', 'removed', 'moved', 'retimed', 'teacher')),
  before jsonb, after jsonb
);

-- 4.1.g Students who follow other groups or courses (repeat courses, electives).
create table public.timetable_follows (
  user_id uuid not null references public.profiles on delete cascade,
  class_group_id uuid references public.class_groups,
  course_id uuid references public.courses,
  primary key (user_id, class_group_id, course_id)
);

-- 4.1.h Academic calendar.
create type public.calendar_kind as enum
  ('term', 'registration', 'add_drop', 'withdraw', 'midterm', 'final', 'result', 'holiday', 'deadline', 'other');
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities,
  term text references public.academic_terms,
  kind public.calendar_kind not null,
  title text not null, notes text,
  starts_on date not null, ends_on date,
  tentative boolean not null default false,   -- "subject to moon / Government notification"
  source_url text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid references public.profiles
);

-- 4.1.i Department data editors.
create table public.data_editors (
  user_id uuid not null references public.profiles on delete cascade,
  department_id uuid not null references public.departments,
  scopes text[] not null default '{timetable,calendar}',
  granted_by uuid references public.profiles, granted_at timestamptz not null default now(),
  primary key (user_id, department_id)
);
create or replace function public.is_data_editor(p_department uuid, p_scope text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.data_editors d
    where d.user_id = auth.uid() and d.department_id = p_department and p_scope = any(d.scopes));
$$;

-- 4.1.j Crowd reports (P2): "this room is actually in use", expire after 90 minutes.
create table public.room_occupied_reports (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  reporter_id uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 minutes'
);
```

**RLS (in the §4.4 style):**

- **Public reference data** (buildings, rooms, teachers, class groups, the published `timetable_live`, published calendar events):
  `for select to authenticated using ((select public.is_verified()) and university_id = (select public.my_university_id()))`. Rooms and entries go through their building or department. Unverified users see nothing, as everywhere else.
- **Imports, staged entries and changes:**
  - **read:** `is_data_editor(department_id, 'timetable')`;
  - **no direct writes:** everything goes through `security definer` functions (`start_import`, `stage_rows`, `publish_import`, `discard_import`), which check `is_data_editor` and write to `audit_log`.
- **Calendar:** drafts are visible to editors; only published events are visible to students; writes go through functions.
- **`data_editors`:** read by admins and the person themselves; granted only by admins (`grant_data_editor`), audited.
- **`timetable_follows`:** owner only.
- **Room reports:**
  - insert by verified students, rate-limited;
  - counts visible to everyone, but not who reported;
  - moderated through the existing reports queue.
- **Storage bucket `timetable-imports`:** private, editors only, deleted 90 days after the import is published.

### 4.2 Parser output to our schema (field by field)

| Parser field                                              | Our column                         | Transformation                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| day key ("Monday")                                        | `day`                              | Monday = 0 … Sunday = 6 (as `timetable_slots`)                                                                                                                                                                                                                                                                                                                  |
| room label ("Department of Computer Science MAB CR- 160") | `room_label` (verbatim), `room_id` | Normalise: collapse spaces, remove "Department of …" and parenthetical notes, fix "CR- 160" to "CR-160", split building code (MAB / IAH / IKM / SSB / JB / NAB) from room code. Match against `rooms.code` within the building, then against `rooms.aliases`. **Unmatched means an editor maps it** in the review screen, and the alias is saved for next time. |
| `course_code` ("CSDE-6209")                               | `course_code`, `course_id`         | Upper-case, compare without separators (`CSDE6209`). Match `courses` by department and code; if missing, the editor can create the course.                                                                                                                                                                                                                      |
| `course_title` (may end in "…")                           | `course_title`                     | If truncated and the course matched, use the catalogue title; otherwise keep it and flag it.                                                                                                                                                                                                                                                                    |
| `teacher_name` (may end in "…")                           | `teacher_name`, `teacher_id`       | Normalise spacing, title prefixes (Dr. / Mr. / Ms.) and case. Match `teachers.name` or `aliases`; a truncated name matches on its prefix plus the department. Unmatched names wait for the editor.                                                                                                                                                              |
| `degree` + `program` ("BS" + "Computer Science")          | `class_groups.program_id`          | Map to `programs` by department, level and name (with an alias list: "Computer Science - Specialization in Artificial Intelligence" → BS AI).                                                                                                                                                                                                                   |
| `session` ("2024-2028")                                   | `class_groups.intake_year`         | The first year.                                                                                                                                                                                                                                                                                                                                                 |
| `section` ("Regular 0", "Regular 1", "Self Support 2")    | `class_groups.section`             | "Regular N" (any N, including 0) → `REG`; "Self Support 1" → `SS1`; "Self Support 2" → `SS2` (profile codes). Other values are flagged for the editor. No shift is derived: CS has no morning/evening shifts, and Self Support is an admission category (DECISIONS, 2026-10-23).                                                                                |
| `semester`                                                | stored on the entry's `raw`        | Only for display; the class group comes from intake year.                                                                                                                                                                                                                                                                                                       |
| `start_time` / `end_time`                                 | `start_min` / `end_min`            | "HH:MM" to minutes; the end must be after the start.                                                                                                                                                                                                                                                                                                            |
| `practical`                                               | `practical`                        | —                                                                                                                                                                                                                                                                                                                                                               |
| `combined_class`                                          | `combined_key`                     | Every group named in a combined card gets its own row with the same key.                                                                                                                                                                                                                                                                                        |
| whole row                                                 | `raw`                              | Kept for audit and re-parsing.                                                                                                                                                                                                                                                                                                                                  |
| `timestamp`                                               | `timetable_imports.created_at`     | —                                                                                                                                                                                                                                                                                                                                                               |

### 4.3 Import flow

1. **Upload.** On `/admin/timetable` the editor picks department, term and week, and uploads the PDF, or CSV/Excel if the department provides an export.
2. **Parse.** A TypeScript port of **timetable-parser** (used with permission; see §6 and DECISIONS) running in the admin import route, with `pdfjs-dist` for positioned text. It produces rows and a **diagnostics report**: pages, rooms, sessions, truncated values and warnings. The port is checked against the Python original on the stored sample PDFs (golden tests: same classes, rooms and times).
3. **Normalise and match.** Rooms, teachers, courses and class groups are matched through the alias tables. Anything unmatched is listed for the editor to map; mappings are saved as aliases.
4. **Diff.** Compare the staged rows with the currently live data for the same department, term and week, keyed by `stable_key`, and summarise. For example: "**12 classes changed** (5 moved room, 4 retimed, 3 new teacher), **3 removed**, **2 added**, **3 rooms renamed**, 4 truncated titles filled in from the catalogue".
5. **Review.** The editor sees the diff with links to each changed row, can fix or exclude rows, and must clear blocking warnings (unknown class group, end before start).
6. **Publish.** One click. The import becomes live (`timetable_live`), the change rows are written, and it goes in the audit log. No second approval for now: the project owner is the only editor. It can be added when more editors join.
7. **Alerts.** For each change, notify the students whose class group matches, or who follow that group or course: "Database Systems moved to MAB CR-163 on Tue 11:00". There's a new notification category, **Timetable changes**, respecting preferences and push previews. Changes are batched into one push per student per publish.
8. **Undo.** "Revert to previous" republishes the earlier import, with its own diff and alerts.

### 4.4 Terms with no data yet

- Every screen shows a designed empty state (§3) with the "last published" date, and **falls back to the student's personal timetable**.
- Explore's Now / Next card hides itself rather than showing a gap.
- The free room finder says "Rooms appear once this term's timetable is published".
- Calendar falls back to the previous year's dates, marked **tentative**, only if an editor enters them that way.

## 5. Risks

| Risk                                                                                                                          | Likelihood           | Mitigation                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No reliable official source.** PDFs arrive late or irregularly, and the weekly process goes stale (as it did for csdeptuos) | High                 | Named data editors (more than one per department), a "last updated" date shown to students, a reminder to editors on Mondays, and **ask the department for a direct export** |
| PDF layout changes and the parser breaks silently                                                                             | Medium               | The diagnostics report blocks publishing on structural failure; diff review; parser tests against stored sample PDFs; CSV import as a fallback                               |
| Wrong data published (wrong room, wrong time)                                                                                 | Medium               | Human review of every import, a diff before publish, undo or revert, students can report "this looks wrong"                                                                  |
| Alert fatigue from weekly churn                                                                                               | Medium               | One batched push per publish; only _your_ classes; can be switched off in preferences                                                                                        |
| Truncated or inconsistent names                                                                                               | High (12–87 per PDF) | Course-code lookup into our catalogue, alias tables, editor mapping that's remembered                                                                                        |
| Licence (Ta1al's repos have none)                                                                                             | Certain              | Write our own parser; copy nothing; ask the author; record any permission in `DECISIONS.md`                                                                                  |
| Rooms missing from the timetable never appear free                                                                            | Medium               | Seed a full room list per building (editor-entered); show rooms with no classes as free                                                                                      |
| Profile data not matching a class group (no section, wrong intake)                                                            | Medium               | Match on department, program, intake and section with a manual "pick my section" override; prompt to complete studies                                                        |
| Teacher privacy                                                                                                               | Low                  | Only what's on official timetables (name, room, time); link to official profiles; no personal contact details                                                                |
| Scale: free-room and lookup queries on every Explore load                                                                     | Low                  | Indexed queries per class group and per room; the Now / Next card reads only the student's group                                                                             |
| Realtime connection cap (about 200 on Supabase Free)                                                                          | Known                | Alerts use push, not live sockets; the Supabase Pro move is already planned                                                                                                  |

## 6. Questions, answered by the project owner (2026-11-17)

1. **Official files.**
   - **Timetable:** the department's timetable PDFs are available for UoS departments.
   - **Rooms:** the room list comes from the timetable itself, so rooms are seeded from the room labels in each import. A room that never appears in any timetable won't be listed; editors can add one by hand.
   - **Academic calendar:** the project owner will share the file.
2. **Departments.** **CS first**, then more departments one at a time. The model is per department from the start.
3. **Data editors.** The **project owner is the only editor** at first, already an admin, so no second approval for now. The `data_editors` role is still built so others can be added later.
4. **Sections and shifts.**
   - **"Regular 0" is Regular**, and particular to CS, so any "Regular N" maps to `REG`.
   - **CS has no morning or evening shifts**, so no shift is derived from the timetable.
   - Self Support remains an admission category (`SS1` / `SS2`), as already decided on 2026-10-23.
5. **Weekly or termly.** **The timetable mostly doesn't change.** Imports default to the **term timetable** (`week_of` null). A week-specific amendment is possible but rare, and change alerts fire only when something actually changes.
6. **Department hub.** Not decided yet. It's P2, so it can be settled when that work starts.
7. **Parser.** **We may use Ta1al's timetable-parser.** Ta1al is a friend of the project owner, and they built the CS department site and the parser together. The plan therefore switches from "write our own" to **"port their parser to TypeScript"** (see `ta1al-repos-analysis.md` §4).
   - Credit Ta1al and the project owner in the code and in `DECISIONS.md`.
   - Recommended: add a licence file (for example MIT) to `timetable-parser` so the permission is on record for future contributors.

### Draft message to Ta1al (no longer needed for permission; kept in case it's useful for collaboration)

> Hi there 👋
>
> I'm Asmaad, a UoS student building **UOSBuddy**, an app for verified University of Sargodha students (find your batch, chats, Backup requests, timetable). I came across your CS department site and timetable-parser and really liked the room finder and how you handle the weekly PDFs.
>
> We're planning official timetable and free-room features for CS students inside UOSBuddy, with a review step before anything is published and change alerts for students. I'd love to work together rather than duplicate effort. A few options, whichever suits you:
>
> - compare our results on the same weekly PDFs;
> - share the parsed data, with credit to you;
> - or, if you're open to it, let us reuse parts of your parser under a licence you choose.
>
> Your repos don't have a licence yet, so we haven't used any of your code, and won't without your OK. Happy to talk whenever suits you. Thanks for building this for the department!
>
> Asmaad

_(Add the author's name if you know it, and your contact details when you send it. I haven't included either.)_
