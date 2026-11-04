import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/actions/onboarding";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Account suspended" };

/** Phase 9: what a banned account sees instead of the app. */
export default function BannedPage() {
  return (
    <main className="gutter mx-auto grid min-h-dvh max-w-md content-center gap-4 py-10">
      <h1 className="text-[28px] leading-tight font-bold">Your account is suspended</h1>
      <p className="text-ink-2">
        An admin suspended this account for breaking the{" "}
        <Link href="/guidelines" className="font-semibold text-brand">
          community guidelines
        </Link>
        . You can&apos;t use UOSBuddy while it&apos;s suspended.
      </p>
      <p className="text-ink-2">
        If you think this is a mistake, reply to any UOSBuddy email or contact us through the{" "}
        <Link href="/safety" className="font-semibold text-brand">
          safety centre
        </Link>
        .
      </p>
      <form action={signOut}>
        <Button type="submit" block variant="secondary">
          Log out
        </Button>
      </form>
    </main>
  );
}
