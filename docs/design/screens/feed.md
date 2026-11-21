# Feed

Reference: `docs/design/UOSBuddy_Redesign-png/Feed.png` (layout) and the 60 · 30 · 10 formula.

## Audit (before)

- No orange action: posting is Feed's one main action, but the compose button was plain Midnight.
- The empty state had a second filled-looking button competing with compose, and a 15-word line
  ("Lost something, found a great teacher, or have a question? Ask here.").
- Post names were 15/600 and meta 13/400 in a tertiary grey; the formula wants card titles 16–17/700
  and meta 12–13/600 in Muted.
- The composer row's photo icon was grey; icons are Blue in the formula.

## Plan

1. **Compose (header) is the screen's one orange action** (Kinnow with dark icon). Plain icon
   buttons get the same soft lift as the bell.
2. **Empty state:** "No posts yet" / "Be the first to post here." with a tertiary (Sky) "Write a post".
3. **Post card:** name 16/700, meta 13/600 in Muted. Votes already use Blue on Sky for the active vote.
4. **Composer row:** Blue photo icon.

The segmented Campus | Department control, the Hot/New sort and "You're all caught up" already
follow the formula and are unchanged.
