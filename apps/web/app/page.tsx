import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Marquee } from "@/components/ui/marquee";
import { Stamp } from "@/components/ui/badge";
import { SiteFooter } from "@/components/site-footer";
import { createPublicClient } from "@/lib/supabase/public";

// Live counters change as students join; refresh at most once a minute.
export const revalidate = 60;

async function getStats() {
  try {
    const { data } = await createPublicClient().rpc("public_stats");
    return data as { students: number; departments: number } | null;
  } catch {
    return null;
  }
}

/** Welcome (Section 7, screen 1). */
export default async function Welcome() {
  const stats = await getStats();
  const items = [
    stats && stats.students >= 50
      ? `${stats.students.toLocaleString("en")} students joined`
      : "Be one of the first in your batch",
    stats ? `${stats.departments} departments` : "Every department",
    "Verified UoS students only",
    "Backup from batchmates and seniors",
  ];

  return (
    <div className="bg-dotted flex min-h-dvh flex-col">
      <main className="gutter mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 py-10">
        <div className="grid gap-4">
          <Stamp tone="verified" className="justify-self-start">
            UoS students
          </Stamp>
          <h1 className="font-pixel text-[44px] leading-[0.95] tracking-tight">
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
      <Marquee items={items} />
      <SiteFooter />
    </div>
  );
}
