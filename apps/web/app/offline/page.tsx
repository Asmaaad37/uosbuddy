import type { Metadata } from "next";
import { RetryButton } from "@/components/pwa/retry-button";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };
// Static, so the service worker can keep a copy for when there's no connection.
export const dynamic = "force-static";

/** Phase 10 task 1: what the installed app shows with no connection. */
export default function OfflinePage() {
  return (
    <main className="gutter mx-auto grid min-h-dvh max-w-md content-center justify-items-center gap-4 py-10 text-center">
      <span aria-hidden className="text-5xl">
        📶
      </span>
      <h1 className="text-[28px] leading-tight font-bold">You&apos;re offline</h1>
      <p className="text-ink-2">
        UOSBuddy needs a connection to load new things. Check your data or Wi-Fi, then try again.
      </p>
      <RetryButton />
    </main>
  );
}
