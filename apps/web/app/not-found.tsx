import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <main className="gutter mx-auto grid min-h-dvh max-w-md content-center justify-items-center gap-4 py-10 text-center">
      <span aria-hidden className="text-5xl">
        🧭
      </span>
      <h1 className="text-large-title">Page not found</h1>
      <p className="text-sec">
        The link may be old, or the page has moved. Let&apos;s get you back to campus.
      </p>
      <Button asChild>
        <Link href="/">Go home</Link>
      </Button>
    </main>
  );
}
