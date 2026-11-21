# Sub-screens

The 60 · 30 · 10 formula applied to the screens behind Explore and Me. Audited at 390px in light;
checked after in light and dark.

## Audit (before)

- Main actions (Add a course, Post a listing, Offer or ask for a ride, Notify me, Email me a code)
  were plain Midnight, so no screen had its one orange action.
- Selected filter chips (Market, Your batch, Timetable → People, Interests) were outlined Sky,
  unlike `Chip` (Midnight when selected).
- Page subtitles and helpers often ran 13–25 words; several repeated the title.
- Accepted UI findings: the calendar repeated the same holiday note on every holiday and used a
  crossed-out bell; "Your own classes" listed six empty days; the GPA footnote was four lines;
  notification hints ran up to 15 words.

## Plan

1. **Study**
   - Calendar: each note shows once, on its first date. Reminder bell is a plain outline bell when
     off and a filled Blue bell on Sky when on (shape changes too, not just colour).
   - Timetable: "Your own classes" shows only days that have classes, then one tertiary "Add your
     own class" (the sheet already has a Day picker; it opens on today).
   - GPA: one-line footnote. Courses: "Add a course" is the orange action. Shorter subtitles on
     GPA, Courses, Resources and Mentors.
2. **Campus**
   - Market "Post a listing", Rides "Offer or ask for a ride", AIBuddy "Notify me" are orange.
   - `FilterChips`, Timetable → People and Interests chips: Card with a lift, selected Midnight
     with heavier text.
   - Shorter subtitles on Market, Rides, Your batch and AIBuddy.
3. **Settings**
   - Notification hints cut to a few words each. Shorter subtitles on Notifications, Privacy,
     Blocked, Muted and UoS email. "Email me a code" is orange.

Features, routes and data are unchanged. The timetable e2e now adds a class through "Add your own
class" and picks Monday in the sheet.
