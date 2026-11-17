# csdeptuos.netlify.app: UoS CS department site research (REA)

**What it is:** a website for the **University of Sargodha Department of Computer Science**.
- **It's student-run.** The footer credits "Made by Ta1al" (ta1al.com), and the CGPA calculator is credited to a second student.
- **It isn't official.** It links to the official `su.edu.pk` department page and faculty profiles.
- **Our rule:** we don't treat its data as official and we don't scrape it. Collaborating with its author is an option (see the plan).

**How this was gathered:**
- REA browser scenarios (Chromium 157, a 390×844 phone viewport, Asia/Karachi time zone), on **2026-11-17**.
- Every page in the brief was loaded. The home page's own links were also tried.
- On the Room finder, a day and time were set, which only changes a filter on the page. Nothing was submitted.
- Network observations are only what the pages loaded themselves.
- Evidence IDs: `ev_e33b788…` (home, about, news, CGPA, rooms), `ev_4da77c7…` (resources, calendar, timetable, FYP), `ev_58b7c3d…` (societies, rooms with a time set).

**The source code was read separately**; see `ta1al-repos-analysis.md`. Statements below marked *(code)* come from reading the repo, not from the live site.

---

## 1. Site-wide
- **Stack:** a static **Astro** multi-page site on Netlify. Pages redirect from `/x` to `/x/` (301).
- **Content editing:** Netlify Identity is loaded on every page, for the Decap CMS admin at `/admin` *(code)*.
- **Analytics:** Google Analytics (GA4) on every page.
- **Navigation:** a header with the UoS logo, "Computer Science Department" and a menu button. The footer reads "© 2025 Computer Science Department. Made by Ta1al."
- **Broken links:** the home page links to **`/calendar` and `/timetable`, and both return 404**. The real pages are `/academics/calendar` and `/academics/timetable`.

## 2. Pages

| Page | Purpose | Elements | Data | Observations |
|---|---|---|---|---|
| `/` | Department landing | Hero ("Computer Science Department"), stats (650+ students, 1,250+ graduates, 3 degree programs, 180+ publications, 500+ alumni), Explore Societies, Learn more, 3 faculty cards, "Important links" cards (News, official dept page, Academic Calendar, Class Timetables, Study Resources, CGPA Calculator), Academic disciplines (BS / MS / PhD in CS, AI and DS, each with **View Study Plan**), PEOs and PLOs | Static HTML | Faculty cards link to official `su.edu.pk/facultyprofile/{id}` pages. Two of the "Important links" cards are 404s. "View Study Plan" buttons go nowhere visible. Stats are unsourced. |
| `/about` | Mission, vision, HOD message, faculty | Mission, core values, vision, HOD message (name, education, research, experience), faculty grid (about 20 cards: name, designation, research areas, degree; links to su.edu.pk) | Static | The faculty directory links out; it doesn't copy official profiles. |
| `/news` | News and announcements | One post card: "Article Writers Needed!" (10/6/2025, Featured) | Markdown via Decap CMS *(code)* | Essentially empty: the only post is a call for writers. |
| `/tools/cgpa-calculator` | CGPA calculator | Tabs **Calculator / Grade Predictor / History**; semesters with name; courses with name, credit hours, obtained/total marks, auto grade and GP; Add course, Export semester, + Add semester, Calculate CGPA, Import full data; feature cards (multiple semesters, grade prediction, export to JSON/PDF); How to use; grading table | Browser storage only | **Grading bands:** 80–100 → A (4.00), 65–79 → B (3.00–3.94), 50–64 → C (2.00–2.93), 40–49 → D (1.00–1.90), below 40 → F. This matches the UoS percentage system our GPA calculator already uses. Adds a **grade predictor** (the GPA needed to reach a target CGPA). |
| `/tools/room-finder` | Free CS rooms at a day and time | Dataset select (`week1.json` – `week4.json`), day chips Mon–Fri, time input (08:00–18:30), **Now**, Clear, "Show rooms freeing in" checkbox with 10–60 min, "Available Rooms at {time} on {day}", Room Schedule dialog per room | Fetches **`/parsed/week4.json`** (parser output) | Outside hours it shows "No data outside teaching hours." Choices are kept in the URL (`?ds=week4.json&time=10:00`). After setting Tue 10:00 by automation it showed "Select a day and time", so either the time field ignored the automated input or the day toggled off. Unresolved. |
| `/tools/study-resources` | Resource library | Search; Category, Course and Sort selects; **Submit a Resource** (`/tools/submit-resource`); resource cards (category, rating, title, description, course code, downloads, uploader, date) | Fetches `/api/resources.json`, which returns **`[]`** | The six visible items (for example "Data Structures Complete Notes … Dr. Ahmed Khan 1/15/2024", "Dr. Robert Wilson") are **hardcoded demo data** in `resourceManager.ts` *(code)*. No real resources exist. |
| `/academics/calendar` | Academic calendar 2026–27 | Fall 2026, Spring 2027 and Summer 2027 sections with dated rows (commencement Sep 01, enrol or change course deadline Sep 14, withdraw deadline Sep 25, thesis deadlines, …), footnotes (* subject to Punjab government holiday, ** subject to the moon, *** off days may be used for exams) | **Hand-typed into the page markup** *(code)* | A transcription of the official UoS calendar. There's no export, no "next date" and no reminders. |
| `/academics/timetable` | Searchable department timetable | Dataset select, **Last updated: 56 days ago**, search ("course, teacher, room…"), Filters, **Export to Google Calendar**, **Download an image**, colour palette; list rows such as "Monday 8:00–9:30 AM · Computer Networks · BS AI · Regular 0 · Ayesha Kausar · Department of Computer Science MAB CR-160" | `/parsed/week4.json` | View state is kept in the URL (`?ds=week4.json&sort=day&mode=simple`). The data stopped updating after week 4 (21 Sep 2026). |
| `/academics/fyp` | Final year projects | — | — | The live URL **redirects to the home page**. A page exists in the source *(code)* but isn't reachable. |
| `/societies` | Student societies | One card: **Programming Society** → `/societies/ps` | Static | A single society. |

## 3. How data is stored and loaded
- **Timetable and rooms:** static JSON files in `public/parsed/week{N}.json`, made by the timetable parser from the department's **weekly PDF** and committed by hand. The site fetches the selected week at runtime.
- **Calendar:** hand-written HTML.
- **News, events and resources:** Markdown content collections, editable through Decap CMS with git-gateway and editorial workflow *(code)*.
- **CGPA:** client-side only.

## 4. What works well
1. **Free rooms from the timetable.** It shows rooms free *now* or at a chosen time, plus "freeing in N minutes", with a per-room schedule.
2. **Search across course, teacher and room** in one box.
3. **Export filtered classes to Google Calendar**, and as an image to share in WhatsApp groups.
4. **Shareable URLs** that keep filters.
5. **Official links rather than copied profiles** for faculty.
6. A CGPA calculator that uses the **UoS grading bands** and adds a **grade predictor**.

## 5. What's broken, confusing or missing
1. **Stale data:** the timetable last changed on 21 Sep 2026, a manual weekly process that stopped. It says so ("56 days ago"), which is honest, but students still see old data.
2. **Week-file datasets** (`week1.json` – `week4.json`) expose the pipeline to users: "which week file do I pick?"
3. **Two 404s** on the home page, a hidden FYP page and "View Study Plan" buttons that go nowhere.
4. **Fake resources** presented as real (demo data with download counts and ratings).
5. No personal view: you can't save "my section" and see only your classes.
6. No notifications when the timetable changes.
7. The room finder only knows rooms that appear in that week's PDF, and uses the device clock rather than Pakistan time *(code)*.
8. News is empty apart from a call for writers.

## 6. Insights: what UoS students actually need, and the gaps UOSBuddy can fill
**Needs this site shows are real at UoS:**
- the **weekly timetable** for my program, section and semester;
- **which room is free right now**;
- the **academic calendar deadlines** (enrol or change course, withdraw, exams);
- a **CGPA calculator** with UoS grading, and a predictor.

**Where UOSBuddy can do better:**
1. **Personal by default.** A student's department, batch, semester and section are already on their verified profile, so "my classes today" needs no picking.
2. **Kept fresh, with accountability.** An admin or data-editor import flow, a preview diff and human approval, plus a visible "last updated" and owner. Not one person's manual commits.
3. **Change alerts.** Push when *my* class moves or is cancelled. The data changes weekly, so this matters.
4. **Calendar as data, not HTML.** "Next 3 dates" on Explore, an .ics export and reminder pushes before deadlines.
5. **Resources are already real in UOSBuddy** (uploads, moderation, AI Buddy search). We shouldn't copy this site's demo pattern.
6. **Free rooms that know the full room list**, including rooms with no classes that week, with building and floor, and Pakistan time.
7. **Hide the week-file plumbing.** Students should see "this week" and "next week", not `week4.json`.

**Collaboration option:** the author already runs a parser and a weekly process for exactly this department. Asking to collaborate, reuse with permission, or share data is worth doing; see the draft message in `docs/plans/academic-features.md`. Without permission we treat the site and repos as **all rights reserved** (neither repo has a licence) and build our own.
