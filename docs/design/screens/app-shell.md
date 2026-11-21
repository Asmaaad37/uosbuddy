# App shell and tokens

The first step of the 60 · 30 · 10 redesign. Every screen uses the shared tokens, so changing their
values moves the whole app onto the new palette at once. Screens are then refined one at a time.

## Audit (before)

- Colours are the November "one accent" set: neutral greys, `#2563EB` blue, white primary buttons on
  blue. No Midnight, Sky or Kinnow.
- Icon wells are neutral grey (`--raised`) with grey icons; the formula wants Sky wells with Blue icons.
- Chips are 36px outlined pills; the formula wants 44px pills on Card with a lift shadow.
- Cards have almost no lift in light mode, and no hairline in dark mode.
- Page titles are 34/700 and section titles 20/700; the formula wants 34/800 (−3%) and 21/800 (−2%).
- **Tab bar:** checked at 390×844 at the top, middle and bottom of Explore. It stays fixed 22px above
  the bottom edge at every scroll position, and also while a sheet is open (the sheet scales
  `.app-page`, which doesn't contain the tab bar). The mid-page tab bar in earlier screenshots came
  from full-page captures, which stitch fixed elements into the page. No code change needed.
- Contrast: every text and background pair in the new palette passes 4.5:1 in both themes. The
  lowest are Muted on Sky (4.6) and Muted on Paper (5.2). White on Kinnow would fail (2.4), so text on
  orange is always `#1A1206`.

## Plan

1. **Keep the token names and change their values**, so no component needs editing for colour:
   Paper → `--bg`, Card → `--surface`, Ink → `--label`, Muted → `--sec` and `--ter`, Blue →
   `--accent`, Sky → `--tint`, Blue → `--tintText`, Midnight → `--fill`. New tokens: `--line`,
   `--midnight`, `--kinnow`, `--on-kinnow`, `--sky`, with Tailwind utilities for each.
2. **Orange is opt-in.** A new `cta` button variant (Kinnow with dark text) is used only where a
   redesigned screen chooses its one primary action. The existing `primary` variant becomes Midnight
   with white text, so no screen gets more than one orange button by accident.
3. **Cards:** radius 24 with a soft lift shadow in light mode, and a 1px hairline in dark mode.
4. **Type:** page title 34/800 at −3%, section title 21/800 at −2%.
5. **Shared components:** icon wells (Shortcuts, EmptyState) become 58px, radius 20, Sky with a Blue
   icon; chips become 44px pills on Card with a lift shadow, selected = Midnight with white text and
   600 weight (state isn't shown by colour alone).
6. **Welcome screen, theme colour and manifest** use the new Paper, Midnight and Blue values.

## Not in this step

Per-screen changes (copy cuts, heroes, the one orange action) come screen by screen, starting with
Explore once `explore-v2.png` is available.
