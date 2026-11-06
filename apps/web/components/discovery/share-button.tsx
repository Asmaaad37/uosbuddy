"use client";

import { useState } from "react";
import { Check, Share } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Native share sheet where the phone has one, otherwise copies the link. */
export function ShareButton({
  url,
  text,
  label = "Invite your batch",
  icon = true,
  ...props
}: { url: string; text: string; label?: string; icon?: boolean } & Omit<
  ButtonProps,
  "onClick"
>) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const link = new URL(url, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title: "UOSBuddy", text, url: link });
      } catch {
        // Closing the share sheet throws; nothing to do.
      }
      return;
    }
    await navigator.clipboard.writeText(`${text} ${link}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <Button type="button" onClick={share} {...props}>
      {copied ? <Check aria-hidden /> : icon && <Share aria-hidden />}
      {copied ? "Link copied" : label}
    </Button>
  );
}
