# UniPal teardown (Phase R)

**Target:** https://www.tryunipal.com/ (public, logged-out surface only)
**Date:** 2026-10-23
**Method:** REA `capture_browser_scenario` (Playwright, headless Chromium 155, 390×844 viewport, dark scheme). Screens were reached by navigation and by clicking the university list button only.
**Limits kept:** No form was filled or submitted, no account was created, no upload was made, the Google button and "Forgot password?" were not clicked, and no Supabase/PostgREST endpoint was called directly. Network rows below are the requests the UI itself made, recorded by endpoint name only (no bodies, no header values).

Screenshots, for internal reference only (they contain UniPal's branding, so do not reuse them in product material): [`unipal-screens/`](unipal-screens/).

### Evidence index

| ID | Scenario |
|---|---|
| `ev_c59b14d9…92d9d` | Welcome `/` |
| `ev_fbee5dec…f89d4` | University picker `/login` |
| `ev_2d624767…42cbb` | Pick COMSATS, then the email fork `/login?u=comsats` |
| `ev_62fa7975…b9b21` | "Not listed" waitlist, then password login |
| `ev_eecc4cdb…d3259` | University-email door, then the freshman form (both tabs) |
| `ev_1823763a…7fd9cd` | Manifest, robots, sitemap, `/privacy`, `/terms`, `/explore` probes |

Each finding below is tagged **[O]** (observed directly), **[I]** (inferred from observations) or **[?]** (unknown).

---

## 1. Route map (logged-out)

| Route | Screen | Notes |
|---|---|---|
| `/` | Welcome | [O] Single CTA "Get started" links to `/login`. Subline: "New this year or coming back · same first question". |
| `/login` | University picker | [O] Searchbox plus a list of about 65 Pakistani universities. **University of Sargodha is not listed.** |
| `/login?u=<slug>` | Email fork | [O] "Do you have your student email?" Yes goes to `?door=email`; "No, not yet" goes to `/signup/freshman?university=<slug>`. |
| `/login?u=<slug>&door=email` | Uni-email sign-in | [O] "Sign in with your COMSATS email" / "Use your @cuilahore.edu.pk address." / "Sign in with Google" / "I don't have my student email". |
| `/login?u=__other__` | Waitlist | [O] "Tell us where you study". |
| `/login?door=password` | Password login | [O] For users who joined with a screenshot. |
| `/signup/freshman?university=<slug>` | Freshman: **Log in tab** | [O] Defaults to the *Log in* tab, even though the user just said they have no email. |
| `/signup/freshman?tab=signup` | Freshman: Sign up tab | [O] The full form. |
| `/login?next=<path>` | Auth gate | [O] `/explore`, `/privacy` and `/terms` all redirect here with `next=`. |
| 404 page | Not found | [O] Shows the **logged-in bottom nav** to anonymous users: Explore `/explore`, Feed `/ask-seniors`, Resources `/resources`, Chats `/chats`, Profile `/profile`. |
| `/robots.txt`, `/sitemap.xml` | n/a | [O] Both return 404. |
| `/manifest.webmanifest` | PWA | [O] `name: UniPal`, `description: "Find your batch before classes start."`, `start_url` and `id` are `/explore`, `display: standalone`, theme and background `#0a0a0a`, 192 and 512 icons plus a maskable 512. |

## 2. Screen-by-screen

### 2.1 Welcome (`/`)
- [O] The UniPal wordmark image, H1 "Welcome to UniPal", paragraph "Find your batch, your people, and your place before classes even start.", and a lime gradient pill "Get started".
- [O] Dark background with blurred olive/lime glows at the corners. There is no social proof, no stats and no illustration.
- [O] The console logs "Banner not shown: beforeinstallpromptevent.preventDefault() called", so the browser's install prompt is captured and deferred for a custom install UI.
- [O] Network: `rpc/my_university_status` (POST, returns 401 when logged out; called twice), `universities?select=id,name,short_name,campuses,departments&live=eq.true` (called twice), plus prefetches of `/login`.

### 2.2 University picker (`/login`)
- [O] H1 "Which university are you at?". Searchbox placeholder "Type its name, like LUMS or GCU". Each row shows a short name in bold with the full name beneath.
- [O] "My university isn't listed" and "Joined with a screenshot? Log in with your email and password".
- [O] The footer on every auth screen reads "If you face any issues, mail us on unipalapp.team@gmail.com".
- [O] Network: `allowed_domains` (`university, domain, campus_name, campus_letter, mail_host, returning_only`), `allowed_domains` (`university, domain`), `auth_providers` (`mail_host, live`) and `universities`.
- [I] The `campus_name` and `campus_letter` columns suggest one university maps to several campus mail domains (for example COMSATS Lahore uses `cuilahore.edu.pk`). `returning_only` suggests some domains are accepted only for returning students. `auth_providers.live` looks like a kill switch for each mail host (Google vs Microsoft).
- [?] We don't know whether `departments` and `campuses` are JSON columns or embedded relations.

### 2.3 Email fork (`/login?u=comsats`)
- [O] A back link labelled with the chosen university ("Not COMSATS?"), H1 "Do you have your student email?", a primary lime pill "Yes" and a secondary dark pill "No, not yet".
- [O] Both choices are plain links with query-string state, so every step is deep-linkable and survives a reload.

### 2.4 University-email sign-in (`?door=email`)
- [O] The required domain is shown up front ("Use your @cuilahore.edu.pk address."), followed by "Sign in with Google" and an escape hatch, "I don't have my student email".
- [?] We don't know what happens after a wrong-domain sign-in, because Google was deliberately not clicked.

### 2.5 Freshman (`/signup/freshman`)
- [O] Log in / Sign up segmented toggle. Intro: "You do not have a COMSATS email yet, so we check your screenshot by hand. It usually takes a few hours."
- [O] **Draft restore banner:** "We kept what you had already typed. Everything except your password, which we never store." plus "Start over instead". It appeared after an earlier page in the same browser session had preselected a university.
- [O] The fields, each with helper text:
  - Full name
  - Email ("Any email you check. Your COMSATS email comes later.")
  - Password ("At least 8 characters.")
  - WhatsApp, **required** and prefilled with `+92` ("With country code, so we can reach you.")
  - University, a native select ("Pick the one you actually attend. You cannot change this later.")
  - Proof screenshot ("Add a screenshot that proves you got in. Your portal page or anything similar.")
  - Roll number ("Your roll number or the unique number on your portal")
- [O] "Submit for review" stays disabled until the form is valid. Privacy footnote: "Your screenshot, email and number are only ever seen by an admin reviewing your account. They are never shown to other students."
- [O] There is no captcha widget visible.
- [I] Validation shown on the client: the password needs at least 8 characters, and the submit button is disabled until all required fields are filled. No roll-number format hint is shown.

### 2.6 Waitlist (`?u=__other__`)
- [O] Copy: "We open one university at a time, and we go where the students already are."
- [O] Fields: "Your university" ("The name everyone calls it"), "Your university email" ("It is how we know which universities to open next") and optional WhatsApp ("Leave it and Hassan, who built UniPal, will message you himself the day your university opens."). The button reads "Put me on the list" and is disabled until valid.

### 2.7 Password login (`?door=password`)
- [O] "Joined with a screenshot? Use the email and password you made then, not your university email." The screen has Email, Password, "Log in" (disabled until valid), "Forgot password?" and "Never signed up? Join with a screenshot".
- [O] The inputs have **no accessible labels** (the a11y tree shows a bare `textbox`).

## 3. Visual and tone notes
- [O] Dark-first (`#0a0a0a`), with a lime/yellow-green gradient for primary pills, dark pills for secondary actions, bold grotesk headings, uppercase micro-labels on the waitlist form and soft radial glows.
- [O] The copy is plain, warm and first person, and it explains *why* each field is asked for. The founder is named in the copy ("Hassan, who built UniPal").

## 4. Announced logged-in features (not observed)
These come from the plan's Section 1.1 and the 404 nav. They could not be verified without an account:
- Explore (batch finder). **Feed lives at `/ask-seniors`** [O from the nav], which suggests the feed is framed as Q&A with seniors [I].
- **Resources** is a top-level tab [O from the nav].
- Chats and Profile [O from the nav].
- Carpool, a PF Tutor/Coach and a C++ runner [from founder posts; not in the nav, so they are probably inside Explore or Resources [I]].

Web searches (2026-10-23) found no press coverage; results were for unrelated apps named "Unipal".

---

## 5. Feature matrix: UniPal vs UOSBuddy (Section 5)

| Area | UniPal | UOSBuddy plan | Verdict |
|---|---|---|---|
| Welcome + single CTA | Yes | #1 | **Have**. Ours adds social proof (marquee stats) and a mascot. |
| University picker | Yes, 65 universities | #2 (UoS preselected) | **Better idea**: UoS only, so skip the list and confirm the campus. |
| "Request your university" | Yes, collects uni email + WhatsApp | #2 | **Have**. Low priority for a single-university app. |
| Email fork | Yes | #3 | **Have** |
| Google sign-in, domain hint shown | Yes | #4 | **Have**. Copy their pattern of showing the exact domain on the button screen. |
| Multi-campus mail domains / provider switch | Yes (`campus_letter`, `mail_host`, `returning_only`, `auth_providers.live`) | Partly (`university_domains.student_only`) | **Missing**. See new feature N1. |
| Freshman manual review | Yes | #5 | **Have** |
| Proof types | "Screenshot" only | Admission letter, portal, challan, card, PDF | **Better idea** (ours) |
| WhatsApp | Required | Optional | **Better idea** (ours: less PII) |
| Captcha | None visible | #14 Turnstile | **Better idea** (ours) |
| Roll number format hint | None | Regex + hint | **Better idea** (ours) |
| Draft restore (no password) | Yes | Not planned | **Missing**. See N2. |
| Deep-linkable auth steps + `next=` return | Yes | Implied | **Missing** as an explicit requirement. See N3. |
| Pending screen | [?] | #6 | Unknown |
| Password login + forgot password | Yes | #7 | **Have** |
| Support email on every auth screen | Yes | Yes (Phase 1 copy) | **Have** |
| Custom PWA install prompt | Yes (deferred `beforeinstallprompt`) | #67 | **Have** |
| Feed framed as "Ask Seniors" | Yes (`/ask-seniors`) | #32 campus feed, #35 Q&A (P1) | **Better idea**: promote Q&A to seniors. See N4. |
| Resources as a top-level tab | Yes | #46 inside course rooms (P1) | **Missing** as a hub. See N5. |
| Carpool | Announced | #57 | **Have** (ours adds women-only) |
| PF Tutor / C++ runner | Announced | #52, #53 | **Have** |
| Public legal pages | **Behind login** | Phase 10 legal pages | **Better idea**: ours must be public. See avoid list. |
| Accessible form labels | Missing on password login | WCAG AA | **Better idea** (ours) |

## 6. New features to add

| # | Feature | Priority | Phase | Why |
|---|---|---|---|---|
| N1 | **Per-campus mail domains and provider kill switch.** Add `campus_id`, `mail_host` (`google`/`microsoft`/`other`) and `returning_only` to `university_domains`, plus a small `auth_providers(mail_host, live)` table that hides the OAuth button and falls back to email OTP when a provider is not live. | P0 | 1 | UoS sub-campuses and the Google vs Microsoft question (Open Question 1) need exactly this. **Schema change: needs your approval before Section 4 is edited.** |
| N2 | **Freshman form draft restore.** Autosave non-secret fields (never the password or file) to `sessionStorage`; show "We kept what you typed" with "Start over". | P0 | 1 | Students on flaky 3G lose long forms; this is cheap. |
| N3 | **URL-driven onboarding state.** Every auth step is deep-linkable, and protected routes redirect to `/start?next=…` and return there after auth (with `next` validated as same-origin). | P0 | 1 | Invite links and push deep links (`/i/[code]`, `/backup/…`) need it. |
| N4 | **"Ask Seniors" lane.** A Q&A feed tab where questions are routed to opted-in seniors in the same department, with an accepted answer. This moves #35 from P1 to P0 and connects it to Backup fan-out. | P0 | 5 | It is UniPal's main feed, so it's the job students most want done. |
| N5 | **Resources hub** `/resources`: a cross-course library (search by course code, teacher, year) on top of #46. | P1 | 6 | UniPal makes it a top-level tab, which signals demand. |
| N6 | **Founder/human touch in copy.** The waitlist and pending screens say a real verifier or team member will reach out ("A student on our team checks every proof by hand"). | P1 | 1 | Builds trust; costs nothing. |

## 7. UX patterns

**Worth copying (as patterns, in our own words and visual style):**
- One question per screen, with a back link that names the current choice ("Not COMSATS?").
- Showing the required email domain on the sign-in screen before the OAuth hop.
- Helper text under every field that explains why it's asked for and who sees it.
- The submit button stays disabled until the form is valid, combined with inline hints.
- A single, persistent support contact on every auth screen.

**Avoid:**
- Legal pages (`/privacy`, `/terms`) behind login. They must be public, and the Phase 10 legal pages should ship as early as Phase 1 because the freshman form collects PII.
- A 404 page that shows the logged-in nav to anonymous visitors. That leaks the app's structure and is confusing.
- "No, not yet" landing on a **Log in** tab. The user just told us they are new.
- A required WhatsApp field. Ours stays optional.
- Calling an auth-only RPC (`my_university_status`) for anonymous visitors, which produces two 401s per page. Skip it when there is no session.
- Fetching the same catalogue query twice per page; deduplicate it.
- Unlabelled inputs on the login form.
- A missing `robots.txt` and `sitemap.xml`. Ours should ship both, with public routes only.

## 8. Unresolved questions
- The logged-in app (`/explore`, `/ask-seniors`, `/resources`, `/chats`, `/profile`), the pending screen, the wrong-domain error and the forgot-password flow were all left unexplored. They need a test account that you own (Phase R step 4).
