"use client";

import { ErrorScreen } from "@/components/error-screen";
import "./globals.css";

/** Only when the root layout itself fails, so it brings its own <html> and <body>. */
export default function GlobalError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <ErrorScreen {...props} />
      </body>
    </html>
  );
}
