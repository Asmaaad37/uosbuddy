/**
 * Shown the instant a signed-in page is opened, while its data loads, so every tap
 * responds immediately. Shaped like AppShell: header, title, then cards.
 */
export default function Loading() {
  return (
    <div className="bg-dotted flex min-h-dvh flex-col" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="gutter mx-auto flex w-full max-w-md items-center justify-between py-4">
        <span className="size-11 rounded-pill bg-surface-2 motion-safe:animate-pulse" />
        <span className="size-11 rounded-pill bg-surface-2 motion-safe:animate-pulse" />
      </div>
      <div className="gutter mx-auto grid w-full max-w-md gap-4 pt-2 motion-safe:animate-pulse">
        <div className="h-8 w-2/3 rounded-md bg-surface-2" />
        <div className="h-4 w-1/2 rounded-md bg-surface-2" />
        <div className="h-12 rounded-pill bg-surface-2" />
        <div className="h-28 rounded-lg bg-surface-2" />
        <div className="h-28 rounded-lg bg-surface-2" />
        <div className="h-28 rounded-lg bg-surface-2" />
      </div>
    </div>
  );
}
