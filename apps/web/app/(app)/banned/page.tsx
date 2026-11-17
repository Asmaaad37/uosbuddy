import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/actions/onboarding";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Account suspended" };

/** Phase 9: what a banned account sees instead of the app. */
export default function BannedPage() {
  return (
    <main className="gutter mx-auto grid min-h-dvh max-w-md content-center gap-4 py-10">
      <h1 className="text-large-title">Your account is suspended</h1>
      <p className="text-sec">
        An admin suspended this account for breaking the{" "}
        <Link href="/guidelines" className="font-semibold text-accent">
          community guidelines
        </Link>
        . You can&apos;t use UOSBuddy while it&apos;s suspended.
      </p>
      <p className="text-sec">
        If you think this is a mistake, reply to any UOSBuddy email or contact us through the{" "}
        <Link href="/safety" className="font-semibold text-accent">
          safety centre
        </Link>
        .
      </p>
      <form action={signOut}>
        <Button type="submit" block variant="tinted">
          Log out
        </Button>
      </form>
    </main>
  );
}
