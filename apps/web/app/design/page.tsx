import type { Metadata } from "next";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteFooter } from "@/components/site-footer";
import { Showcase } from "./showcase";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false },
};

// Living style guide (Phase 0): every component in light and dark, side by side from xl up.
export default function DesignPage() {
  return (
    <div className="min-h-dvh">
      <header className="gutter sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-bg/90 py-3 backdrop-blur">
        <div>
          <h1 className="text-lg font-bold">UOSBuddy design system</h1>
          <p className="hidden text-sm text-ink-2 sm:block">
            Retro-tactile campus · tokens from BUILD_PLAN §6.2
          </p>
        </div>
        <ThemeToggle />
      </header>
      <main className="grid grid-cols-1 xl:grid-cols-2">
        <Showcase theme="light" />
        <Showcase theme="dark" />
      </main>
      <SiteFooter />
    </div>
  );
}
