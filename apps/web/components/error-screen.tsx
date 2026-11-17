"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * What a student sees when a page breaks, styled like the offline page. The reference code
 * matches the server log, so a screenshot is enough to find what went wrong.
 */
export function ErrorScreen({
  error,
  reset,
  home = "/",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  home?: string;
}) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
  }, [error]);

  return (
    <div
      role="alert"
      className="gutter mx-auto grid min-h-[70dvh] max-w-md content-center justify-items-center gap-4 py-10 text-center"
    >
      <span aria-hidden className="text-5xl">
        🛠️
      </span>
      <h1 className="text-large-title">Something went wrong</h1>
      <p className="text-sec">
        That&apos;s on us, not you. Try again, and if it keeps happening, tell us from the Safety
        page.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCw /> Try again
        </Button>
        <Button asChild variant="tinted">
          <Link href={home}>Go home</Link>
        </Button>
      </div>
      {error.digest && <p className="text-footnote text-ter">Reference: {error.digest}</p>}
    </div>
  );
}
