import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Stamp } from "@/components/ui/badge";
import { SiteFooter } from "@/components/site-footer";
import { getInvitePreview, inviteHeadline } from "@/lib/invites.server";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const preview = await getInvitePreview((await params).code);
  const title = preview ? inviteHeadline(preview) : "Find your batch on UOSBuddy";
  return {
    title,
    description:
      "Verified University of Sargodha students finding their batch before classes start.",
    robots: { index: false },
    openGraph: { title },
  };
}

/** Phase 3 task 6: where an invite link lands. Works for anyone, signed in or not. */
export default async function InvitePage({ params }: Props) {
  const preview = await getInvitePreview((await params).code);

  return (
    <div className="bg-dotted flex min-h-dvh flex-col">
      <main className="gutter mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 py-10">
        <div className="grid gap-4">
          <Stamp tone="verified" className="justify-self-start">
            {preview ? `${preview.firstName} invited you` : "You're invited"}
          </Stamp>
          {preview?.batch ? (
            <>
              <p className="text-[72px] leading-none font-bold tracking-[-0.03em] text-brand">
                {preview.count}
              </p>
              <h1 className="text-[28px] leading-tight font-bold">
                of {preview.batch} {preview.count === 1 ? "is" : "are"} already on UOSBuddy
              </h1>
            </>
          ) : (
            <h1 className="text-[44px] leading-[1.05] font-bold tracking-[-0.03em]">
              FIND YOUR <br />
              BATCH.
            </h1>
          )}
          <p className="text-lg text-ink-2">
            Meet your batch at University of Sargodha before classes start. Verified UoS students
            only.
          </p>
        </div>
        <div className="grid gap-3">
          <Button asChild block>
            {/* A plain link: the route sets the invite cookie, then starts sign-up. */}
            <a href={`/i/${preview?.code ?? "x"}/join`}>Join your batch</a>
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
