import type { Metadata } from "next";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteFooter } from "@/components/site-footer";
import { Showcase } from "./showcase";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false },
};

// Living style guide: every primitive in dark and light (docs/design/UOSBuddy_REDESIGN_SPEC.md).
export default function DesignPage() {
  return (
    <div className="min-h-dvh">
      <header className="gutter sticky top-0 z-10 flex items-center justify-between gap-4 bg-bar py-3 backdrop-blur-[24px] backdrop-saturate-[180%]">
        <div>
          <h1 className="text-headline">UOSBuddy design system</h1>
          <p className="hidden text-footnote text-sec sm:block">Quiet, campus-native, one accent</p>
        </div>
        <ThemeToggle />
      </header>
      <main className="grid grid-cols-1 xl:grid-cols-2">
        <Showcase theme="dark" />
        <Showcase theme="light" />
      </main>
      <SiteFooter />
    </div>
  );
}
