# Explore

Reference: `docs/design/explore-v2.png` (approved). Before: `docs/design/explore-v1-before.png`.

## Audit (before)

- No focal point: the batch card is a white card like every other.
- Two equal-weight buttons in the batch card (Invite batch, WhatsApp), and no single primary action.
- Text overload: "You're one of the first here. Invite your batch and this fills up.", a two-line
  AIBuddy description, a subtitle on every Find people row, three Coming up rows.
- An eight-tile shortcut grid: too many equal choices (Hick's law).
- "Class of 2024" reads as a graduation year; the number is the year the student joined.
- Separate toolbar row for the bell and avatar, above the title.

## Plan

1. **Header:** date ("Thursday, 19 Nov", Pakistan time) above the 34/800 title; the bell (orange dot
   or count when there's something new) and the avatar (links to Me) beside the title.
2. **Hero:** a Midnight card. "YOUR BATCH", "CS · Batch 2024", the avatar stack plus "**n** here so
   far" (links to the batch), then the screen's **one orange action, "Invite your batch"**, and a
   square WhatsApp icon button.
3. **Shortcuts:** Timetable, Courses, Rides, Market and **More** (a sheet with Batch, Events,
   Calendar, Mentors, GPA and Resources). 58px Sky wells with Blue icons.
4. **Next class** (only on class days) and **Coming up** (just the next date, with a link to the
   calendar). Both were added after the design; they stay, compact, under the shortcuts.
5. **AIBuddy:** one slim card: mascot, "Ask AIBuddy", "Your course notes, answered", and a "Soon"
   pill. Tapping it while it's off puts you on the waitlist (Undo toast); once on, the pill says
   "On the list". When AI is on, the card opens the chat.
6. **People like you:** taller cards with a 64px avatar, the name, one meta line (the reason, or
   department and year) and a Midnight **Connect** that switches to "Requested" at once (reverted
   with a message if it fails). A dashed **Invite** card ends the row.
7. **Find people:** four chips instead of a list: My section, From Sargodha, Same interests, CS seniors.

Removed text: the batch sentence, the AIBuddy paragraph, every Find people subtitle, the Coming up
rows after the first.

New shared pieces in `components/ui`: `HeroCard`, `ChipLink`, and inline header actions in
`ScreenHeader`. Avatar initials use Sky with Blue text everywhere.

## Proposals (need logic changes, not done)

- Show the bell as a dot without a number, as in the design, if you'd rather not show counts.
