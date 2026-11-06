import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Stamp } from "@/components/ui/badge";
import { SiteFooter } from "@/components/site-footer";

/** Welcome (Section 7, screen 1). */
export default function Welcome() {
  return (
    <div className="bg-dotted flex min-h-dvh flex-col">
      <main className="gutter mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 py-10">
        <div className="grid gap-4">
          <Stamp tone="verified" className="justify-self-start">
            UoS students
          </Stamp>
          <h1 className="text-[44px] leading-[1.05] font-bold tracking-[-0.03em]">
            FIND YOUR <br />
            BATCH.
          </h1>
          <p className="text-lg text-ink-2">
            Your people at University of Sargodha, before classes even start.
          </p>
        </div>
        <div className="grid gap-3">
          <Button asChild block>
            <Link href="/start/campus">Get started</Link>
          </Button>
          <Button asChild block variant="ghost">
            <Link href="/login">I already have an account</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
