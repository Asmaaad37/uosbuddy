# vtable.site: UX research (REA)

**What it is:** a timetable app for **FAST NUCES Islamabad** students, built by a student society
("Built with love by Compiler Society"). Studied as a **UX reference only**. Its data belongs to
another university and must not be reused.

**How this was gathered:**
- REA browser scenarios (`capture_browser_scenario`, Chromium 157), in a 390×844 phone viewport.
- Observed on **2026-11-17**.
- REA performed the declared actions itself:
  - load the page;
  - "Continue as guest";
  - close a promo dialog;
  - pick School → Program → Batch → Section → Day;
  - open the Rooms, Faculty, Exams and Today tabs.
- No form was submitted, no account was created and no API was called directly.
- Network observations are only what the pages loaded themselves.
- Evidence IDs:
  - `ev_969ac7f…` (home, network);
  - `ev_9e1e4e9…` and `ev_510baca…` (picker to timetable, rooms);
  - the capture of all tabs, which was saved as a file.

---

## 1. Screens

### 1.1 Welcome / login
- **Purpose:** get in fast; logging in is optional.
- **Elements:**
  - "VTABLE" wordmark and the headline "Stop wandering FAST.";
  - a one-line value statement ("Your timetable, free rooms, faculty and exams — in one place.");
  - **Continue as guest** (primary, with the note "No NU ID needed — you can log in later from your profile");
  - an **NU ID** field (placeholder `22i-1234`) and **Continue**;
  - **FOR FSE** (a separate login for the engineering school);
  - an **install banner** ("Download V Table app", Install / Dismiss) that appears a few seconds after load.
- **Flow:** guest → straight into Lookup (URL `#/lookup`, a hash-routed single-page app).
- **Works well:** guest access first. The ID is only needed for personal features.
- **Confusing:** two different login paths, by school, on the first screen.

### 1.2 Lookup (timetable picker), the main screen
- **Purpose:** find any class's timetable without an account.
- **Elements, top to bottom:**
  1. header "FAST NUCES ISLAMABAD · Lookup", Notifications and Profile buttons;
  2. **School** chips: Computing / Engineering / Business;
  3. **Program** chips: for Computing, BS CS, BS SE, BS AI, BS CY, BS DS, eight MS programs, PhD, "MS (Electives)" and "Unassigned";
  4. **Batch** chips: 2023, 2024, 2025, 2026 and **Repeat** (for students retaking courses);
  5. **Section** chips: A–G;
  6. **Day** chips: Monday–Saturday;
  7. **Course** filter chips, which appear once a section is picked (for example "Algo", "App HCI", "Comp Arch", "Comp Net", "Comp Net Lab", "TBW");
  8. the result (a status region): "BS CS · 2024 · A · TUE", then rows of *start – end · course · room*. For example, *8:30 AM–9:50 AM Algo C-403* and *11:30 AM–2:15 PM Comp Net Lab C-RAWAL 1*. **Labs span several slots** as one long block.
- **Inputs and filters:** a cascading single-select from school down to course. Every level is a row of chips; there are no dropdowns.
- **Empty states:** each level says what to do next: "Nothing to pick here yet", "Pick a program first", "Pick a batch first", "Pick a section first". A status line reads "Pick a school, program, batch, section and day to load a timetable." It never shows a blank screen.
- **Data loading (observed requests):**
  - `GET /api/timetable?school=computing`, about **85 KB**;
  - `…?school=business`, 61 KB;
  - `…?school=engineering`, 19 KB;
  - `…?rooms=cd`, 100 KB.

  The whole school's timetable is fetched once and **filtered in the browser**. Requests add a `cachebust` query, so nothing is cached.
- **Broken or slow:**
  - The first load of the Computing data took **19–50 seconds**, and in headless runs it often never finished. Until then the Program row is empty, with no loading indicator; it just says "Nothing to pick here yet".
  - The exam data (`/api/db?doc=exams/...`) failed or was slow in several runs.
- **Missing:**
  - no "remember my section";
  - no week view in Lookup (one day at a time);
  - no teacher name in the result rows.

### 1.3 Today
- **Purpose:** your own day and week.
- **Elements:** a **Today / Week** segmented control, "My courses — Add or remove repeat courses", and for guests the line "Please login with your nu ID to use this feature" with **Log in**.
- **Insight:** personal features (today, week, repeat courses) are what logging in is for. A guest can browse anything.

### 1.4 Rooms (free rooms)
- **Purpose:** find a free room right now.
- **Elements:**
  - a status line: **"SLOT 6:45 PM – 8:05 PM"** with the current time, or **"OUTSIDE CLASS HOURS"**;
  - "STEP 01 — BLOCK": block buttons with counts ("A 46 free", "B 31 free", "C 44 free", "D 33 free"; outside hours, "A 42 rooms" and so on);
  - a status line: "Pick a block to see which rooms are open."
- **Model inferred from the UI** (an inference, not verified in code):
  - free rooms are computed **per timetable slot**, not per minute;
  - rooms are grouped by **block**, with counts first and then a list.
- **Not observed:** the room list inside a block. The install banner covered the button in automation, so that step timed out; this is recorded as a limitation.
- **Works well:**
  - the time context is explicit (which slot, what time it is now);
  - counts per block before the list.

### 1.5 Faculty
- **Purpose:** find a teacher's office.
- **Elements:**
  - a **Search faculty** box;
  - department chips (All, CS, AI & DS, SE, CY, S&H);
  - about 200 entries, each with initials as an avatar, name, title, and **office room and seat** (for example "D-101 D").
- **Works well:** the office location is the useful fact.

### 1.6 Exams
- **Elements:**
  - tabs **Schedule / Seating / Show-up**;
  - School (FSC / FSE / FSM) → Department → Batch;
  - an empty state: "Pick a department and batch to see the exam schedule."
- **Insight:** **exam seating** is a high-demand feature at exam time.

### 1.7 Other observations
- A **partner promo dialog** (a coding-practice product with a discount code) appears on entry and blocks the screen until dismissed.
- Hidden **mini-games** exist in the page (game-picker buttons found by a locator).
- It's a PWA (manifest, install prompt) with notifications ("Enable notifications" in the profile).
- Analytics: Vercel Insights.
- The Google Fonts stylesheet was **blocked by its own CSP** (console errors), so the page falls back to system fonts.

---

## 2. What works well (to learn from)
1. **Guest-first.** The whole timetable can be browsed without signing in; signing in adds personal views.
2. **Chip-based cascading picker** with explicit next-step hints at every level.
3. **"Repeat" as a batch option**, which acknowledges students who retake courses.
4. **Course chips after section**, to narrow a busy day.
5. **Rooms tied to the current slot**, with counts per block.
6. **One bottom bar for the five jobs** students actually have: Today, Lookup, Rooms, Faculty, Exams.

## 3. What's broken or confusing
1. A very slow first load with no loading state. An empty "Nothing to pick here yet" looks like missing data.
2. Large unfiltered payloads (up to 100 KB per school) with cache-busting, refetched on every visit.
3. A promo modal and an install banner compete for attention and cover controls.
4. A day-at-a-time result, and no teacher names in result rows.
5. Two login paths on the first screen.

## 4. What UOSBuddy should take (UX only)
- **Picker:** department → program → batch (session) → section, plus a "repeat" path, using our `SegmentedControl` and `Chip` components with next-step empty states.
- **"Today / Week" for your own section**, saved once.
- **Free rooms:** a "now" slot banner, then building counts, then a room list with "free until".
- **Faculty office locations**, as links out to official profiles (see the csdeptuos research).
- **Exams:** the schedule first; seating only if UoS publishes it.
- **Avoid:**
  - blocking modals on entry;
  - silent empty states while loading (use skeletons);
  - refetching whole datasets.
