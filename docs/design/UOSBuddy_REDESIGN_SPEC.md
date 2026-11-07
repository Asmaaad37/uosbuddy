# UOSBuddy redesign: implementation spec for Claude Code

> Hand this file to Claude Code together with the design canvas link. It replaces **Section 6 (Design system and UI direction)** of `BUILD_PLAN.md`. The retro/pixel/cream direction is retired.
>
> Direction: **"Quiet, campus-native, one accent."** It follows Apple Human Interface principles (from the `apple-design` skill by Emil Kowalski):
> - system type
> - translucent chrome over scrolling content
> - grouped lists
> - spring motion
> - colour used only for what you can act on

---

## 0. Rules for this refactor

1. **Dark is the default, and light must work too.** Build every screen on the CSS variables in §2. Never hard-code hex values in components.
2. **One accent (blue).** Use it only for:
   - primary actions
   - links
   - the selected state
   - the verified badge
   - progress

   No rainbow icon tiles, no neon cyan, no cream cards.
3. **Remove these from the current app:**
   - the pixel font and the marquee ticker
   - the raised cyan centre "Backup" button
   - the cream-filled pills and cards
   - the multicoloured glossy shortcut tiles
   - the duplicated top nav row on desktop
   - the admin "Verification queue" button on Explore (it moves to Me → Admin)
   - the footer disclaimer on every screen (it stays only at the bottom of Me and on the legal pages)
4. **Never show an empty placeholder box.** Every section either has data or has a designed empty state with one next action. If a section has neither, hide it.
5. **Fix the Explore hero bug.** The current "0 from CS 2022 are here" renders a pixel glyph with no number. Replace it with the copy in §5.1.
6. Keep all existing routes and data. This is a presentation refactor plus the UX changes listed per screen.

---

## 1. Principles to apply (from the skill, condensed)

- **Response:** give press feedback on pointer-down (`:active { transform: scale(.97); transition: transform 100ms ease-out }`). Never wait for release.
- **Interruptible motion:**
  - Use springs, never fixed-duration keyframes, for anything gesture-driven.
  - The default spring has damping 1.0 and response 0.35 s, which in Framer Motion is `{ type: 'spring', bounce: 0, duration: 0.35 }`.
  - Sheets and drawers use `bounce: 0.2, duration: 0.3`.
  - Animate only `transform` and `opacity`.
- **Spatial consistency:**
  - Sheets enter and exit from the bottom along the same path.
  - Popovers scale from their trigger, with `transform-origin` set on the trigger.
- **Materials:**
  - The tab bar and sheets are translucent layers with content scrolling underneath: `backdrop-filter: blur(24px) saturate(180%)`.
  - Never stack two translucent surfaces.
  - Use a gradient scroll-edge fade behind floating chrome instead of 1px divider lines.
- **Typography:**
  - Use the system font.
  - Tracking is negative on large text (−0.022em at 34px) and slightly positive on small labels (+0.01em at 11px).
  - Build hierarchy from size and weight, never from colour.
- **Wayfinding:** every screen has a large title (where am I), a tab bar (where can I go), and a clear primary action.
- **Agency:** destructive actions (log out, delete account, block) confirm with a sheet. Everything else is undoable, so show a toast with Undo.
- **Accessibility:**
  - `prefers-reduced-motion` switches to 200 ms opacity fades.
  - `prefers-reduced-transparency` makes the tab bar solid.
  - `prefers-contrast: more` adds a 1px contrasting border to cards.
  - Touch targets are at least 44px.
  - Text contrast is at least 4.5:1. Every value in §2 passes on its own surface.

---

## 2. Tokens

```css
:root {
  /* dark (default) */
  --bg: #0B0F17;          /* app background */
  --surface: #151A24;     /* cards, grouped lists */
  --raised: #1F2635;      /* icon wells, chips, nested fills */
  --track: #1A202C;       /* segmented control track, search field */
  --thumb: #2E3647;       /* segmented control selected thumb */
  --sep: #252C3A;         /* hairlines inside groups */
  --label: #F3F5F9;       /* primary text */
  --sec: #A1A9B8;         /* secondary text */
  --ter: #8A93A6;         /* tertiary text, meta, chevrons */
  --accent: #5B9BFF;      /* links, selected, icons that act */
  --fill: #2563EB;        /* filled primary buttons (white text) */
  --tint: rgba(91,155,255,.16);  /* tinted button / chip bg */
  --tintText: #A9C8FF;    /* text on --tint */
  --danger: #FF8A80;
  --bar: rgba(24,30,42,.72);     /* tab bar material */
  --barBorder: rgba(255,255,255,.08);
}
:root[data-theme="light"] {
  --bg: #F2F4F7; --surface: #FFFFFF; --raised: #F0F2F6; --track: #E3E7ED; --thumb: #FFFFFF;
  --sep: #E6E9EF; --label: #0B1220; --sec: #5A6475; --ter: #6B7486;
  --accent: #2563EB; --fill: #2563EB; --tint: #E8F0FE; --tintText: #1D4ED8; --danger: #B42318;
  --bar: rgba(255,255,255,.78); --barBorder: rgba(11,18,32,.07);
}
@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) { /* same as light block */ } }
```

Settings → Appearance offers **System / Dark / Light**. The default is System; the app is designed dark-first.

**Type** (font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif`; load Inter as the fallback):

| Token | Size / line | Weight | Tracking |
|---|---|---|---|
| largeTitle | 34 / 41 | 700 | −0.022em |
| title2 | 22 / 28 | 700 | −0.012em |
| section | 20 / 25 | 700 | −0.01em |
| headline | 17 / 22 | 600 | 0 |
| body | 17 / 24 | 400 | 0 |
| subhead | 15 / 20–21 | 400 | 0 |
| footnote | 13 / 18 | 400–600 | 0 |
| overline | 13 / 18 | 600 uppercase | +0.02em |
| tabLabel | 11 / 13 | 600 | +0.01em |

Use `rem` in code (1rem = 16px) so Dynamic Type and browser zoom scale.

**Spacing:**
- The scale is 4 · 8 · 12 · 16 · 20 · 24 · 32.
- Screen side gutter is 16.
- Card padding is 16–20.
- Gap between sections is 28–32.
- The large title sits 6px below the 44px toolbar row.

**Radius:**
- 8 for the segmented thumb
- 10 for the segmented track
- 12 for the search field and plain buttons
- 14 for filled buttons
- 16 for icon wells
- 22 for cards and grouped lists
- `999px` for pills, avatars and the tab bar

---

## 3. Components

| Component | Spec |
|---|---|
| **TabBar** | Fixed bottom, 16px side inset, 22px + `env(safe-area-inset-bottom)` from the bottom, 64px tall, capsule shape, `--bar` with blur(24px) saturate(180%), 1px `--barBorder`. Five equal items: Explore, Feed, Backup, Chats, Me (24px icon, 11px label). The active item is `--accent` with a stroke of 2.1 and gets `aria-current="page"`; inactive items are `--sec`. Behind it, a 104px gradient fade from transparent to `--bg`. **Backup is a normal tab**, not a raised floating button. |
| **ScreenHeader** | A 44px toolbar row with right-aligned icon buttons (44px circles on `--surface`), then the largeTitle. On scroll past the title, collapse to a centred 17/600 inline title over a `--bar` material (sticky). |
| **Card** | `--surface`, radius 22, padding 16–20, no border, no shadow in dark mode. In light mode, optionally add `0 1px 2px rgba(11,18,32,.04)`. |
| **GroupedList** | A card containing rows. Each row is at least 52px (60px with a subtitle) with a 22px icon in `--sec`, a 17px title, a 13px `--ter` subtitle and an 18px chevron in `--ter`. Separator: `inset 0 -1px 0 var(--sep)` on the text column only, so it is indented past the icon. A 13/600 uppercase `--ter` group header sits 16px from the edge. |
| **Button** | Primary: `--fill` with white text, 48–52px tall, radius 14, 16–17/600. Tinted: `--tint` with `--tintText`. Plain: transparent with `--accent`. Destructive: `--danger` text on `--surface`. Every button scales to 0.97 on press. |
| **SegmentedControl** | Track `--track` with 2px padding and radius 10. Thumb `--thumb`, radius 8, shadow `0 1px 3px rgba(0,0,0,.18)`, 32px tall, 13px text (600 when selected, 500 otherwise). The thumb slides with a spring (`layoutId`). |
| **Chip** | 36px tall, 1px `--sep` border, transparent. Selected: 1px `--accent` border, `--tint` background, `--tintText` text. |
| **EmptyState** | Inside a Card, centred: a 52–64px circular well on `--raised` with a 24–28px `--sec` icon, a 17/600 title (optional), 15px `--sec` body (maximum about 270px wide) and one plain or tinted action. |
| **Avatar** | Circle with `object-fit: cover`. Sizes are 36 (composer, header), 40 (rows, posts), 44 (stacks) and 64 (Me). In stacks, overlap by −8px with a 3px ring in the surface colour. |
| **VerifiedBadge** | A 16–18px badge-check stroke icon in `--accent` with `aria-label="Verified student"`. It replaces the "VERIFIED" pixel stamp. |
| **Toast** | `--bar` material, radius 16, sits above the tab bar, has an Undo action and disappears after 4 seconds. |

---

## 4. Navigation and layout by breakpoint

- **Up to 767px (phone):** layout as on the canvas, with the bottom tab bar.
- **768–1023px (tablet):** the same single column with a maximum width of 560px, centred, and the bottom tab bar kept.
- **1024px and up (desktop):**
  - Replace the tab bar with a **left sidebar** 248px wide: app wordmark, then the 5 destinations as 44px rows (icon + label; the active row gets a `--tint` background and `--accent` text). The sidebar also holds the bell and avatar.
  - Content column has a maximum width of 600px. Optionally add a right rail (320px) at 1280px and up with "People like you" and "Backup heroes".
  - **Never** render the phone tab bar as a top bar, which is what the current desktop build does.

---

## 5. Screens (match the canvas)

### 5.1 Explore
1. Toolbar with the bell and your avatar, which links to Me. Then the large title "Explore".
2. **Batch card:**
   - Overline "YOUR BATCH", then "CS · Class of 2022" (from the profile's department and batch).
   - An avatar stack of batchmates already joined, with dashed empty slots filling up to 4.
   - Copy depends on how many batchmates have joined:
     - 0–2 batchmates: "You're one of the first here. Invite your batch and this fills up."
     - 3 or more: "**{n} of your batch are here**", followed by a "See your batch" row link.
   - Actions: **Invite batch** (primary, native share sheet with the invite link) and **WhatsApp** (tinted, `wa.me` share).
3. **Shortcuts:** one card, a 4×2 grid with a 52px icon well on `--raised` and a 12px label, all in the same neutral colour. Batch, Courses, Timetable, Rides, Market, Events, Mentors, GPA.
4. **AIBuddy card:** the mascot (76px), "AIBuddy" with a "Soon" tinted pill, one line of description and a "Notify me" button. Once AIBuddy launches, this card opens the chat.
5. **People like you:** a horizontal list of person cards (avatar, name, "CS · 2022", reason chip, Connect). With no suggestions, show an EmptyState with "Invite batchmates".
6. **Find people:** a grouped list with Your section · From Sargodha ("Handy for trips home and Eid travel") · Shared interests · Seniors in CS. Each row opens the directory with that filter. This replaces the empty "From Sargodha" box.

### 5.2 Feed
1. Toolbar: bell, then a **compose** button (a 44px circle on `--fill`). Large title "Feed".
2. A row holding a segmented control **Campus | {Department}** and a small **sort** button (Hot/New, with an up-down chevron icon) that opens a menu.
3. **Composer row:** your avatar, placeholder text ("Share something with campus" or "…with CS") and an image icon. Tapping it opens the composer sheet.
4. **Post card:**
   - Header: avatar 40, name 15/600, verified badge, and a meta line "CS · 2022 · Wed" in `--ter`.
   - A ⋯ menu (Report, Mute, Copy link, and Delete if it's your own post).
   - Body text 17/24.
   - Actions: upvote, score, downvote (each a 44px hit area; the active vote gets a `--tint` circle and `--accent` colour, and the score turns `--accent`), comments with count, and share on the right.
5. At the end of the list: "You're all caught up" between two hairlines.

### 5.3 Backup
1. The large title "Backup", plus the subtitle "Stuck on something? Your batch has your back."
2. **Ask card:**
   - "WHAT DO YOU NEED?" chips: Notes · Explain a topic · Ride · Company · Borrow something · Something else.
   - The selected chip changes the primary button label ("Ask for notes", "Ask for a ride", …) and pre-fills the create sheet.
   - Under the button: "Goes to your course and section first, then the rest of CS." (This explains the fan-out.)
3. **Open near you:** request cards (title, course tag, urgency, time, an "I've got you" tinted button). When empty, show "All quiet right now / When someone in CS needs a hand, it shows up here and we'll ping you." with a "Notification settings" link.
4. **Backup heroes:** the month name on the right, then a ranked list (rank, avatar, name, "CS · 2022", an "N saves" tinted pill), then "Help someone this month to join the list."

### 5.4 Chats
1. Toolbar with a compose button, then the large title "Chats".
2. A search field (40px, `--track`, radius 12) with the placeholder "Search people and chats".
3. A segmented control **Primary | Requests | Groups**.
4. Empty states:
   - Primary: "No chats yet", with a "Find your batch" button.
   - Requests: "No message requests", explaining that requests wait until you accept.
   - Groups: a **Suggested** row for the user's batch chat (`CS · Class of 2022`, "Your batch chat", Join).
5. Chat rows, once there are chats:
   - Avatar 52, name 17/600, last message 15 `--sec` (one line), time 13 `--ter`.
   - Unread chats show a `--accent` dot and a 600-weight preview.
   - Swipe actions: Mute and Delete (Delete confirms first).

### 5.5 Me
1. The large title "Me".
2. **Profile card:** avatar 64, name 20/700 plus the verified badge, "CS · Class of 2022", earned badges as small pills ("First backup"), and a chevron that opens View my profile.
3. **Finish your profile card:**
   - Title, a percentage and a 6px `--accent` progress bar, plus one line of copy.
   - Below that, a checklist of the remaining steps as rows with empty circles. Completed steps disappear.
   - Hide the whole card at 100%.
4. Grouped lists:
   - **PROFILE:** Photo, handle and bio · Studies · Interests and Opening Move
   - **STUDY:** My courses · Timetable · GPA calculator · Mentors
   - **PRIVACY AND SETTINGS:** Privacy · Notifications · Blocked people (also add Appearance: System/Dark/Light)
   - **HELP:** Safety centre · Your data
   - **ADMIN:** shown only to admins and moderators. Admin, with a "Review" pill when the verification queue is not empty.
5. Log out as a full-width destructive row on `--surface`, with a confirmation sheet.
6. The disclaimer and Privacy · Terms · Guidelines links.

---

## 6. Motion map

| Moment | Motion |
|---|---|
| Tab switch | Cross-fade content in 150 ms. The tab icon scales 0.92 → 1 with the default spring. |
| Segmented change | The thumb slides (`layoutId`, spring bounce 0, 0.3 s) and the list content cross-fades. |
| Vote | The icon scales 1 → 1.15 → 1 with a spring, and the score ticks with a vertical number roll. Fire a haptic (`navigator.vibrate(8)`) on the same frame. |
| Open a sheet (compose, ask for backup) | It slides up from the bottom with spring bounce 0.2 over 0.3 s. The page behind scales to 0.96 and dims to 40%. Drag down to dismiss, with velocity handoff and rubber-banding at the top. |
| Backup claimed ("I've got you") | The button morphs into "You're on it ✓", with a single success haptic. Don't play this animation more than once per claim. |
| Large title → inline title | Driven by scroll position, not time, and fully reversible. |
| Reduced motion | All of the above become 200 ms opacity fades. No scale and no slide. |

---

## 7. Build order (in Claude Code)

1. Put the tokens (§2) in `globals.css` and the Tailwind theme, add the ThemeProvider (System/Dark/Light), and delete the old tokens, the pixel font and the marquee.
2. Primitives in `components/ui`: TabBar, Sidebar, ScreenHeader, Card, GroupedList and Row, Button, SegmentedControl, Chip, EmptyState, Avatar and AvatarStack, VerifiedBadge, Toast, Sheet.
3. App shell: the responsive switch between the TabBar (under 1024px) and the Sidebar (1024px and up), safe-area padding, and the scroll-edge fades.
4. Rebuild the screens in this order: Explore → Feed → Backup → Chats → Me. Match the canvas at 390px width.
5. Motion (§6) with Framer Motion, plus the reduced-motion and reduced-transparency media queries.
6. QA:
   - axe accessibility audit
   - contrast check in both themes
   - 44px hit areas
   - keyboard focus rings (2px `--accent` with a 2px offset)
   - Lighthouse at 375px
   - screenshots of every screen in dark and light, compared against the canvas
