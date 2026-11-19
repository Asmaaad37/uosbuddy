/**
 * While a signed-in screen loads: a quiet skeleton in the shape of a screen (title, cards),
 * inside the app frame, so a tap responds at once and the tab bar stays put. On first open
 * the welcome screen (BootSplash) covers this until the real screen is in. No <main> here:
 * the welcome screen waits for one.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="mx-auto grid w-full max-w-[560px] gap-4 px-4 pt-[calc(env(safe-area-inset-top)+56px)] lg:max-w-[600px]"
    >
      <div className="h-9 w-44 rounded-field bg-raised motion-safe:animate-pulse" />
      <div className="h-28 rounded-card bg-surface shadow-card motion-safe:animate-pulse" />
      <div className="h-20 rounded-card bg-surface shadow-card motion-safe:animate-pulse" />
      <div className="h-20 rounded-card bg-surface shadow-card motion-safe:animate-pulse" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
