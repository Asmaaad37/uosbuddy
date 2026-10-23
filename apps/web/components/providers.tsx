"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "@/components/ui/toast";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

/** PostHog is loaded lazily and only when a key is configured. No PII in events (Section 3.4). */
function useAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!posthogKey) return;
    void import("posthog-js").then(({ default: posthog }) => {
      if (!posthog.__loaded) {
        posthog.init(posthogKey, {
          api_host: posthogHost,
          capture_pageview: false,
          persistence: "localStorage",
          person_profiles: "identified_only",
          mask_all_text: true,
        });
      }
      posthog.capture("$pageview", { path: pathname });
    });
  }, [pathname]);
}

function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal: the app works without offline support.
    });
  }, []);
}

export function Providers({ children }: { children: React.ReactNode }) {
  useAnalytics();
  useServiceWorker();
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
