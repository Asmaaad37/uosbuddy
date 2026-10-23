import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";

// Phase 0 placeholder. The real welcome screen (Section 7 #1) ships in Phase 1.
export default function Home() {
  return (
    <div className="bg-dotted flex min-h-dvh flex-col">
      <main className="gutter mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 text-center">
        <h1 className="font-pixel text-[40px] leading-none tracking-tight">FIND YOUR BATCH.</h1>
        <p className="text-ink-2">
          Your people at University of Sargodha, before classes even start.
        </p>
        <Button asChild size="lg" block>
          <Link href="/design">View the design system</Link>
        </Button>
      </main>
      <SiteFooter />
    </div>
  );
}
