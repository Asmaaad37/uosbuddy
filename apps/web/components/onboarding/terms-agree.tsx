"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TERMS_COOKIE, TERMS_VERSION } from "@/lib/terms";

/** The first sign-up screen's "I agree" box; Continue waits for it. */
export function TermsAgree({ next }: { next: string }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);

  function proceed() {
    const secure = location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${TERMS_COOKIE}=${TERMS_VERSION}; path=/; max-age=86400; samesite=lax${secure}`;
    router.push(next);
  }

  return (
    <div className="grid gap-3">
      <label className="flex items-start gap-3 rounded-field border border-sep bg-surface p-3">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
        />
        <span className="text-sm">
          I agree to the{" "}
          <Link href="/terms" target="_blank" className="font-semibold text-accent">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className="font-semibold text-accent">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      <Button variant="cta" block disabled={!agreed} onClick={proceed}>
        Continue
      </Button>
    </div>
  );
}
