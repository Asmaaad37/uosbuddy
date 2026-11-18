# Ta1al's repos: timetable-parser and cs-dept-website

**Read-only study.** Both were cloned to a scratch folder outside our repo and are not part of
it, its history or its dependencies. Studied on **2026-11-17** at:
- `timetable-parser` @ `308e98d`, last pushed 2026-09-21;
- `cs-dept-website` (Astro), last pushed 2026-09-21.

## 0. Licences (read this first)

| Repo | LICENSE file | `package.json` licence | README | GitHub API `license` | Verdict |
|---|---|---|---|---|---|
| [Ta1al/timetable-parser](https://github.com/Ta1al/timetable-parser) | none | n/a (Python) | no mention | `null` | **No licence: all rights reserved** |
| [Ta1al/cs-dept-website](https://github.com/Ta1al/cs-dept-website) | none | no `license` field | no mention | `null` | **No licence: all rights reserved** |

> **Update, 2026-11-17: permission given.** The project owner co-built the CS department site and the parser with Ta1al, and confirmed we may use the parser. The licence table above still describes the repos as published. Recommended: add a licence file to `timetable-parser` so the permission is written down. See §4 and `docs/DECISIONS.md`.

**Consequences for us (as written before permission was given):**
- We may **read** both to learn how they work.
- We must **not copy code**, prompts, regexes, data files or text into UOSBuddy.
- Reusing anything needs the author's **written permission**, recorded in `docs/DECISIONS.md`. Until then we write our own implementation.
- The descriptions below are in our own words, to inform that design.

---

## 1. timetable-parser

### 1.1 Stack and how to run it
- **Language:** Python, a single module `parser.py` (about 440 lines) plus a CLI `parse_timetable.py`.
- **Dependencies:**
  - **pdfplumber** does all the work.
  - `camelot-py[cv]` is listed in `requirements.txt` and the README, but **isn't imported** anywhere, so the docs are stale.
- **Run:** `python parse_timetable.py <week.pdf> -o <out.json> [--report <report.json>]`.
- **We ran it** in an isolated virtualenv inside the scratch folder (pdfplumber 0.11.10). Nothing was sent anywhere. Results are in §1.8.

### 1.2 Input: the official UoS timetable PDF
- **Format:** an A4-landscape PDF titled **"Weekly Class Timetable for Department of Computer Science"**.
- **Layout:**
  - one grid per page region;
  - **rooms as rows** in a "Room/Lab" column on the left;
  - **days as columns** (Monday–Sunday);
  - each class is a coloured card inside a cell.
- **It's a print of a web system.** The page header includes **"Show All Classes"**, and every card carries a printed **delete icon** (the parser deliberately drops lines containing "delete"). So the PDF is a print of the room view of the university's timetabling system. That system is the real source of truth.
- **Each card has three or more lines:**
  1. *course title* `#` *course code*, for example "Semantic Web #CSDE-6209";
  2. a **program line**, for example "BS in Computer Science Regular 1 ( Fall 2024-2028 ) Semester#5": degree, program, **section** ("Regular N" or "Self Support N"), **session** (intake–graduation years) and **semester number**;
  3. *teacher name* `(HH:MM - HH:MM)`.

  Optional extra lines: a "Combined class" header when two or more programs share a session, and "Practical" for labs.
- **Published weekly:** the website holds `week1` … `week9`, so the timetable is issued **per week** and can change week to week.
- **Where the files come from:** the department (hand-collected PDFs; the repo includes `week2.pdf`, `week3.pdf`, `week4.pdf` and `samples/newweek1.pdf`). No automated source.

### 1.3 Output format
One JSON object per PDF:
```text
{
  "timestamp": ISO time of the parse,
  "rooms": [ { page, region, room, top }, … ],    // every room label seen, with its position
  "Monday": { "<room label>": [ <session>, … ], … },
  "Tuesday": { … }, …
}
```
`<session>` fields:
- `course_title`, `course_code`;
- `program_line` (the raw line), `degree` (BS / MS / PhD), `program` (for example "Computer Science"), `program_code` (always null in the samples);
- `section` ("Regular 1", "Self Support 2"), `session` ("2024-2028"), `semester` (integer);
- `teacher_name`, `start_time`, `end_time` (24-hour "HH:MM");
- `practical` (boolean), `combined_class` (header text or null);
- `*_truncated` flags (course, program, teacher);
- `raw_lines`, the original text lines.

**Notes:**
- There is **no morning/evening field**; the shift is implied by "Regular" versus "Self Support".
- There is **no building field**; the building is inside the room label (`MAB`, `IAH`, `IKM`, `SSB`, `JB`, …).

### 1.4 How it handles the hard parts (described, not copied)
- **Grid recovery:**
  - groups positioned words into visual lines;
  - finds header lines containing two or more day names;
  - takes each day column's horizontal extent as the midpoints between neighbouring day labels;
  - takes the left-hand text before the first day column as room labels.
- **Cells to sessions:** within a day column, lines accumulate until one contains a `(HH:MM - HH:MM)` time range, which closes a session. A large vertical gap resets the buffer.
- **Room assignment:** a session belongs to the nearest room label above or below it. For two adjacent **lab** rows it uses a 40% threshold to choose the lower one.
- **Merged cells and labs over several slots:** there's no explicit merge handling. A lab is one card with a long time range (for example 14:00–17:00), so a long range is how multi-slot labs appear.
- **Multiple sections:** each card names its section; combined classes keep their header.
- **Truncation:** long text is cut off with "…" **in the PDF itself**. The parser flags it, and for program lines it resolves the full text by matching other cards from the same file. Course titles and teacher names stay truncated.
- **Missing semester:** inferred when every other card for the same degree, program, section and session agrees on one semester.
- **Room label clean-up:** whitespace is normalised, and labels whose words come out in column order ("CR-160 Department of …") are reordered. **No canonicalisation:** `CR-160` and `CR- 160`, `IAH L-04 …` and `Department of Physics IAH L- 04 …` stay as different strings.
- **Teacher names:** used as printed; no deduplication or normalisation.

### 1.5 Free rooms
The parser doesn't compute free rooms; the website does (§2.4).

### 1.6 Tests and sample data
- **No automated tests.**
- **Samples:** `week2.pdf` + `.json`, `week3.pdf`, `week4.pdf` + `.json`, `samples/newweek1.pdf` + `.json`.
- An optional **diagnostics report** gives counts by page, region, room and session, plus warnings: unassigned sessions, malformed sessions, missing room labels.

### 1.7 Limitations
- Depends on one exact PDF layout. A change to the timetabling system's print would break it silently.
- Truncated course and teacher names are kept truncated, a problem for search, alerts and teacher views.
- Room names aren't canonical, so room-based features need a mapping table.
- No building or floor data, and no capacity.
- Weekly manual operation: the site's data stopped at week 4 (21 Sep 2026), and git history shows several "fix week2 timetable (again)" commits.

### 1.8 Our run on the sample PDFs

| File | Pages | Rooms | Classes | Status | Truncated entries | Matches the committed JSON |
|---|---|---|---|---|---|---|
| week2.pdf | 7 | 36 | 103 | clean, 0 warnings | 28 | yes (80/80 unique classes) |
| week3.pdf | 5 | 38 | 103 | clean, 0 warnings | 29 | no committed JSON |
| week4.pdf | 5 | 38 | 103 | clean, 0 warnings | 12 | yes (80/80) |
| newweek1.pdf | 10 | 29 | 328 | clean, 0 warnings | 87 | yes (234/234) |

**Data facts from the outputs (useful for our schema):**
- **Sections:** "Regular 1", "Self Support 1", "Self Support 2".
- **Programs:**
  - BS Computer Science, AI and Data Science;
  - MS AI and CS;
  - PhD CS.
- **Common time slots:** 08:00–09:30, 09:30–11:00, 11:00–12:30, 12:30–14:00, 14:00–15:30 and 15:30–17:00, plus 3-hour labs (14:00–17:00).
- **Course codes are mostly present** (missing in 1 of 328), so we can resolve truncated titles through our own course catalogue.
- **Rooms** span several buildings: MAB (CS), IAH (Physics), IKM (Social Work), SSB, Jinnah Block, NAB, plus halls and "Online".

---

## 2. cs-dept-website

### 2.1 Stack and structure
- **Stack:** Astro 5 + TypeScript + Tailwind 4, deployed on Netlify.
- **Optional CMS:** Decap CMS at `/admin`, using git-gateway and an editorial workflow.
- **Structure:**
  - `src/pages`: about, academics (calendar, fyp, timetable), news, events, societies, tools (CGPA, room finder, study resources, submit resource), api (`resources.json.ts`);
  - `src/utils`: timetable helpers, room finder, calendar export, image export, CGPA maths, resource manager;
  - `src/content`: news, events and resources content collections.
- **`timetable-parser` is a git submodule.**

### 2.2 Where each feature's data lives
- **Timetable and room finder:** static `public/parsed/week{N}.json` (parser output), with older weeks under `public/parsed/archived/`. Fetched at runtime by the chosen dataset name.
- **Calendar:** written by hand into `src/pages/academics/calendar.astro`, not data.
- **Study resources:** an Astro content collection exposed at `/api/resources.json`. **It's empty**; the page shows hardcoded demo items from `resourceManager.ts`.
- **News and events:** Markdown collections edited through Decap CMS.

### 2.3 Update pipeline
1. Get that week's PDF from the department.
2. Run the parser locally.
3. Commit the `weekN.json` file.
4. Netlify rebuilds and deploys.

Observed cadence in `git log -- public/parsed`: 2, 6–7, 14 and 21 September 2026, then **nothing**. It's manual, depends on one person, and has no review step beyond the commit.

### 2.4 Free-room logic (described in our words)
- **Rooms considered:** only those that appear in the selected week's file.
- **Free:** a room is free at minute *t* on day *d* if none of its classes that day covers *t*.
- **Free until:** the next class's start time.
- **"Freeing soon":** the current class ends within a chosen window (10–60 minutes) and isn't immediately followed by another class.
- **Teaching window:** fixed at 08:00–18:30. Outside it, there's "no data". Weekends fall back to Monday.
- **Time zone:** uses the **device's local clock**, not Pakistan time.

### 2.5 Room list and building or floor data
None beyond the room label strings. There's no separate room list, capacity, building or floor.

---

## 3. Options

| Option | What it means | For | Against |
|---|---|---|---|
| **(a) Reuse the parser directly** | Run their `parser.py` in our stack | Proven on real UoS PDFs | **Not allowed without a licence.** We also no longer have a Python service (FastAPI was removed in #54), so it would need a separate job runner. |
| **(b) Their output as an upstream feed** | Ingest their `weekN.json` (or a feed they publish) into our tables, with the author's agreement | No parsing for us; shared effort | Depends on one volunteer's manual weekly process, which has already gone stale. Needs the author's permission and some agreement on uptime. |
| **(c) Our own parser, informed by theirs** | A TypeScript parser in our admin import route, using `pdfjs-dist` (Mozilla, Apache-2.0) for positioned text, with the same grid ideas; plus a diagnostics report and **human review of every import** | We own it, no licence issue, runs in our existing Next.js and Vercel stack, and canonicalisation (rooms, teachers, course codes) is built in | We write and maintain it, and must keep up with layout changes |

### Recommendation: (c), with two additions
1. **Write our own parser (c)**, mapped into our schema and with a preview diff before anything goes live. Use the course catalogue and course codes to fill in truncated titles, and an admin-curated **room** and **teacher alias table** to make names canonical.
2. **Ask the department for a structured export.** The PDF is a print of a UoS timetabling system, so a CSV or Excel export from it would make PDF parsing a fallback, not the main path. This is the most robust source, and it's a question for you.
3. **In parallel, contact Ta1al** (a draft message is in the plan) to:
   - compare results on the same PDFs, as a cross-check during our tests;
   - possibly collaborate or share data;
   - with permission, borrow specific techniques.

   If they offer a licence, we can revisit (a) or (b).

An optional fallback for messy pages: Claude Haiku 5.5 with structured output, reading a PDF page into the same schema. Its results would go through the same diff and human approval. It's off by default and cheap, but not needed if the deterministic parser handles the layout.

## 4. Decision after permission (2026-11-17)
With permission, option (a) is open, but it would mean running Python: we removed the FastAPI service in #54, and Vercel's Next.js project has no Python runtime set up. So:

- **Port `timetable-parser` to TypeScript** inside the admin import route, using `pdfjs-dist` for positioned text. It keeps the same approach: day-header detection, room bands, time-range-terminated cells, lab-row threshold, program-line resolution and semester inference.
- **Golden tests** run both: the stored sample PDFs (`week2`–`week4`, `newweek1`) must give the same classes, rooms and times as the Python original.
- **We add what it lacks:** canonical room, teacher and course mapping, the diff, and human review (plan §4.2–4.3).
- **Credit** Ta1al and the project owner in the ported module's header and in `docs/DECISIONS.md`.
- **If a port proves hard** for a layout edge case, the fallback is to run the Python parser as a one-off script the editor uses locally, then upload its JSON. The import flow accepts that JSON shape too.
