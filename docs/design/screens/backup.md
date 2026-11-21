# Backup

Reference: `docs/design/UOSBuddy_Redesign-png/Backup.png` (layout) and the 60 · 30 · 10 formula.

## Audit (before)

- The ask button ("Ask for notes", following the chosen chip) is the screen's main action, but it
  was a plain filled button with nothing marking it as the one to press.
- Two long lines: "When someone in CS needs a hand, it shows up here and we'll ping you." (14 words)
  and "No saves yet this month. Help someone and you'll top the list." (12 words).
- Chips were the old 36px outlined pills (fixed globally in step 1).

## Plan

1. **"Ask for …" is the one orange action.** Per-request "I've got you" buttons stay tertiary (Sky).
2. **Shorter lines:** "We'll ping you when someone needs a hand." and "No saves yet. Help someone to
   top the list."
3. Kept: the tagline "Stuck on something? Your batch has your back." (voice, not instructions) and
   the 12-word line saying where a request goes (it explains the fan-out, which the UI doesn't show).
